import { describe, expect, it } from "vitest";
import {
  applyAiEditTransaction,
  applyFixtureTransform,
  aiEditTransactionStore,
} from "./aiEditTransactions";
import type { AppleAssistTargetSnapshot } from "../../types";

// The transaction + fixture transform + store are the
// minimum surface for the v0.12 mock: a rough request
// comes in, the body is wrapped, the buffer is rewritten,
// and the latest transaction is recorded per tab.

function target(
  start: number,
  end: number,
  text: string,
  activeDocumentPath = "/tmp/note.md",
): AppleAssistTargetSnapshot {
  return {
    kind: "paragraph",
    start,
    end,
    text,
    label: "",
    activeDocumentPath,
    activeDocumentName: null,
    capturedAtMs: 0,
  };
}

describe("applyFixtureTransform", () => {
  it("wraps the text in a labeled block for 整えて", () => {
    expect(applyFixtureTransform("整えて", "hello")).toBe(
      "【整え】\nhello\n【/整え】",
    );
  });

  it("wraps the text in a labeled block for 自然にして", () => {
    expect(applyFixtureTransform("自然にして", "hi")).toBe(
      "【自然】\nhi\n【/自然】",
    );
  });

  it("appends a draft-continuation note for 続きを書いて", () => {
    expect(applyFixtureTransform("続きを書いて", "first paragraph")).toBe(
      "first paragraph\n\n（…続きのドラフトをここに追加）",
    );
  });

  it("wraps the text for 校正して", () => {
    expect(applyFixtureTransform("校正して", "draft")).toBe(
      "【校正メモ】\ndraft\n【/校正メモ】",
    );
  });

  it("wraps the text for この章を直して", () => {
    expect(applyFixtureTransform("この章を直して", "section body")).toBe(
      "【書き直し案】\nsection body\n【/書き直し案】",
    );
  });

  it("falls back to a generic labeled block for unknown requests", () => {
    expect(applyFixtureTransform("summarize", "x")).toBe(
      "【AI編集メモ】\nx\n【/AI編集メモ】",
    );
  });

  it("survives an empty target", () => {
    expect(applyFixtureTransform("整えて", "")).toBe("【整え】\n(empty)\n【/整え】");
  });
});

describe("applyAiEditTransaction", () => {
  it("rejects when the target snapshot is missing", () => {
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "整えて",
      target: null,
      buffer: "hello",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-bounds target ranges", () => {
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "整えて",
      target: target(0, 999, ""),
      buffer: "hi",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a target snapshot captured from another document", () => {
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "整えて",
      target: target(0, 2, "hi", "/tmp/other.md"),
      buffer: "hi",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("stale");
  });

  it("rejects a target snapshot whose text no longer matches the buffer", () => {
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "整えて",
      target: target(0, 5, "hello"),
      buffer: "hullo",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no longer matches");
  });

  it("rewrites the buffer at the target range and records the transaction", () => {
    const buffer = "alpha\nbeta\ngamma";
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "整えて",
      target: target(6, 10, "beta"),
      buffer,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextBuffer).toBe("alpha\n【整え】\nbeta\n【/整え】\ngamma");
    expect(result.transaction.before).toBe("beta");
    expect(result.transaction.after).toBe("【整え】\nbeta\n【/整え】");
    expect(result.transaction.beforeBuffer).toBe(buffer);
    expect(result.transaction.afterBuffer).toBe(result.nextBuffer);
    expect(result.transaction.tabId).toBe("t1");
  });

  it("uses generated after text when supplied", () => {
    const buffer = "alpha\nbeta\ngamma";
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "自然にして",
      target: target(6, 10, "beta"),
      buffer,
      afterText: "better beta",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextBuffer).toBe("alpha\nbetter beta\ngamma");
    expect(result.transaction.after).toBe("better beta");
  });

  it("rejects generated after text when it is unchanged", () => {
    const buffer = "alpha\nbeta\ngamma";
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "自然にして",
      target: target(6, 10, "beta"),
      buffer,
      afterText: "beta",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no changes");
  });

  it("keeps the prefix and suffix of the buffer untouched", () => {
    const buffer = "## Top\n\nfirst\n\nsecond\n\nthird\n";
    const start = buffer.indexOf("second");
    const end = start + "second".length;
    const result = applyAiEditTransaction({
      tabId: "t1",
      tabName: "note.md",
      tabPath: "/tmp/note.md",
      request: "自然にして",
      target: target(start, end, "second"),
      buffer,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextBuffer.startsWith("## Top\n\nfirst\n\n")).toBe(true);
    expect(result.nextBuffer.endsWith("\n\nthird\n")).toBe(true);
  });
});

describe("aiEditTransactionStore", () => {
  it("records the latest transaction per tab and clears it", () => {
    const tx = {
      id: "tx1",
      tabId: "tabA",
      tabName: "a.md",
      tabPath: "/a.md",
      request: "整えて",
      target: target(0, 1, "x"),
      before: "x",
      after: "【整え】\nx\n【/整え】",
      beforeBuffer: "x",
      afterBuffer: "【整え】\nx\n【/整え】",
      appliedAtMs: 0,
      diff: null,
    };
    aiEditTransactionStore.record(tx);
    expect(aiEditTransactionStore.getLatest("tabA")?.id).toBe("tx1");
    aiEditTransactionStore.clear("tabA");
    expect(aiEditTransactionStore.getLatest("tabA")).toBeNull();
  });
});
