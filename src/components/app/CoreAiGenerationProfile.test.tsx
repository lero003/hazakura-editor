import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoreAiGenerationProfile } from "./CoreAiGenerationProfile";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  listen: vi.fn(),
  listener: null as null | ((profile: unknown) => void),
}));

vi.mock("../../lib/tauri/coreAiModels", () => ({
  getLocalAssistGenerationProfile: mocks.read,
  listenLocalAssistGenerationProfileChanges: mocks.listen,
}));

beforeEach(() => {
  mocks.listen.mockImplementation(async (listener: (profile: unknown) => void) => {
    mocks.listener = listener;
    return () => { mocks.listener = null; };
  });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.listener = null; });

describe("CoreAiGenerationProfile", () => {
  it("shows the observed effective settings instead of a webview copy", async () => {
    mocks.read.mockResolvedValue({
      modelId: "apple:core-ai:gemma-4-e4b-it-int4-v1",
      maximumResponseTokens: 512,
      samplingRequested: "temperature=0.7, topK=64",
      samplingEffective: "temperature=0.7, dropped by engine: topK=64",
      promptTokens: 812,
      outputTokens: 24,
      cachedTokens: 640,
    });
    render(<CoreAiGenerationProfile language="ja" />);

    expect(await screen.findByText("出力の上限")).toBeTruthy();
    // The numbers must come from the Rust-owned record, never from the panel.
    expect(screen.getByText(/512/)).toBeTruthy();
    expect(screen.queryByText(/2048/)).toBeNull();
    expect(screen.getByText(/temperature=0.7, topK=64/)).toBeTruthy();
    expect(screen.getByText(/dropped by engine: topK=64/)).toBeTruthy();
    expect(screen.getByText(/812/)).toBeTruthy();
    expect(screen.getByText(/gemma-4-e4b-it-int4-v1/)).toBeTruthy();
  });

  it("stays honest when nothing has been observed yet", async () => {
    mocks.read.mockResolvedValue(null);
    render(<CoreAiGenerationProfile language="ja" />);

    expect(await screen.findByText(/まだ Core AI の生成を記録していません/)).toBeTruthy();
    expect(screen.queryByText("出力の上限")).toBeNull();
  });

  it("follows the Rust-owned change event while the pane is open", async () => {
    mocks.read.mockResolvedValue(null);
    render(<CoreAiGenerationProfile language="en" />);
    await screen.findByText(/No Core AI generation has been recorded/);

    act(() => {
      mocks.listener?.({
        modelId: "apple:core-ai:gemma-4-12b-it-int8-v1",
        maximumResponseTokens: 2048,
        samplingRequested: "temperature=none(greedy)",
        samplingEffective: "greedy",
        promptTokens: 120,
        outputTokens: 16,
        cachedTokens: null,
      });
    });

    expect(screen.getByText(/2048/)).toBeTruthy();
    expect(screen.getByText(/gemma-4-12b-it-int8-v1/)).toBeTruthy();
  });

  it("subscribes before reading the snapshot, so a run cannot be missed", async () => {
    // 先に読むと、購読が終わる前に走った生成を取り逃し、空状態のまま残る。
    let resolveListen: ((stop: () => void) => void) | undefined;
    mocks.listen.mockImplementation(
      () => new Promise<() => void>((resolve) => { resolveListen = resolve; }),
    );
    mocks.read.mockResolvedValue({
      modelId: "apple:core-ai:gemma-4-e4b-it-int4-v1",
      maximumResponseTokens: 2048,
      samplingRequested: "temperature=none(greedy)",
      samplingEffective: "greedy",
      promptTokens: 812,
      outputTokens: 24,
      cachedTokens: 640,
    });
    render(<CoreAiGenerationProfile language="ja" />);

    await waitFor(() => expect(mocks.listen).toHaveBeenCalledTimes(1));
    expect(mocks.read).not.toHaveBeenCalled();

    act(() => resolveListen?.(() => undefined));

    expect(await screen.findByText(/2048/)).toBeTruthy();
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it("keeps a newer notification when the pending read resolves late", async () => {
    // 通知で新しくなった後に届いた古い取得結果で、表示を巻き戻さない。
    const newer = {
      modelId: "apple:core-ai:gemma-4-12b-it-int8-v1",
      maximumResponseTokens: 4096,
      samplingRequested: "temperature=0.7",
      samplingEffective: "temperature=0.7",
      promptTokens: null,
      outputTokens: null,
      cachedTokens: null,
    };
    const stale = {
      modelId: "apple:core-ai:gemma-4-e4b-it-int4-v1",
      maximumResponseTokens: 2048,
      samplingRequested: "temperature=none(greedy)",
      samplingEffective: "greedy",
      promptTokens: 1,
      outputTokens: 2,
      cachedTokens: 3,
    };
    let resolveRead: ((value: unknown) => void) | undefined;
    mocks.read.mockImplementation(
      () => new Promise((resolve) => { resolveRead = resolve; }),
    );
    render(<CoreAiGenerationProfile language="ja" />);

    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    act(() => { mocks.listener?.(newer); });
    expect(screen.getByText(/4096/)).toBeTruthy();

    act(() => resolveRead?.(stale));

    await waitFor(() => expect(screen.queryByText(/2048/)).toBeNull());
    expect(screen.getByText(/4096/)).toBeTruthy();
    expect(screen.getByText(/gemma-4-12b-it-int8-v1/)).toBeTruthy();
  });
});
