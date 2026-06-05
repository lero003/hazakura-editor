import type { AppleAssistTargetSnapshot } from "../../types";
import type { CompareViewState } from "../../types";

// v0.12+ Apple Local Assist Writing Companion (slice 4+).
// AI edit transaction data model + session-local store.
//
// An `AiEditTransaction` is the durable record of one
// "AI wrote to the unsaved buffer" event. The Apple Assist
// window fires `APPLY_AI_EDIT_TRANSACTION_EVENT`; the main
// window's listener applies a fixture transform, mutates
// the unsaved buffer in place, and records a transaction
// here. The escape hatch (slice 5) reads `latest` to
// render the "Open Diff" / "Discard" affordances.
//
// The store is session-local and in-memory: closing the
// app drops the list. The data model is intentionally
// minimal — target-slice `before` / `after`, full-buffer
// `beforeBuffer` / `afterBuffer`, the bounded target
// snapshot, and a precomputed `CompareViewState` so
// the escape hatch can render the diff without recomputing
// it on every render. Persisting transactions to disk is
// out of scope for the v0.12 mock.

export type AiEditTransaction = {
  id: string;
  tabId: string;
  tabName: string;
  tabPath: string;
  request: string;
  target: AppleAssistTargetSnapshot;
  before: string;
  after: string;
  beforeBuffer: string;
  afterBuffer: string;
  appliedAtMs: number;
  diff: CompareViewState | null;
};

export type ApplyAiEditTransactionInput = {
  tabId: string;
  tabName: string;
  tabPath: string;
  request: string;
  target: AppleAssistTargetSnapshot | null;
  buffer: string;
};

export type ApplyAiEditTransactionResult =
  | {
      ok: true;
      transaction: AiEditTransaction;
      nextBuffer: string;
    }
  | { ok: false; error: string };

// `applyFixtureTransform` is the mock body of the AI edit
// transaction: it turns a rough request + the target text
// into a visible fixture edit. The shapes are intentionally
// trivial so the user can see the change happen and the
// escape hatch has something to diff. Replace with a real
// Foundation Models binding in a later slice (out of scope
// for the v0.12 mock per
// `docs/apple-local-assist-writing-companion-plan.md`).
export function applyFixtureTransform(
  request: string,
  before: string,
): string {
  const trimmed = before.length === 0 ? "(empty)" : before;
  if (request.includes("整え")) {
    return `【整え】\n${trimmed}\n【/整え】`;
  }
  if (request.includes("自然")) {
    return `【自然】\n${trimmed}\n【/自然】`;
  }
  if (request.includes("続き")) {
    return `${trimmed}\n\n（…続きのドラフトをここに追加）`;
  }
  if (request.includes("校正")) {
    return `【校正メモ】\n${trimmed}\n【/校正メモ】`;
  }
  if (request.includes("章を直し")) {
    return `【書き直し案】\n${trimmed}\n【/書き直し案】`;
  }
  // Fallback: wrap the text in a labeled block so the
  // change is visible regardless of the request.
  return `【AI編集メモ】\n${trimmed}\n【/AI編集メモ】`;
}

// `applyAiEditTransaction` is the pure helper that turns
// the request + target + buffer into a transaction + next
// buffer. It does NOT mutate any global state — the caller
// is responsible for updating the tab's `contents` and
// recording the transaction in the store.
export function applyAiEditTransaction(
  input: ApplyAiEditTransactionInput,
): ApplyAiEditTransactionResult {
  const target = input.target;
  if (!target) {
    return {
      ok: false,
      error: "No Apple Assist target snapshot was supplied with the request.",
    };
  }
  if (target.start < 0 || target.end < target.start) {
    return {
      ok: false,
      error: "Apple Assist target range is invalid.",
    };
  }
  if (target.end > input.buffer.length) {
    return {
      ok: false,
      error: "Apple Assist target range is out of bounds for the active buffer.",
    };
  }
  if (target.activeDocumentPath !== input.tabPath) {
    return {
      ok: false,
      error: "Apple Assist target is stale for the active document.",
    };
  }

  const before = input.buffer.slice(target.start, target.end);
  if (before !== target.text) {
    return {
      ok: false,
      error: "Apple Assist target text no longer matches the active buffer.",
    };
  }

  const after = applyFixtureTransform(input.request, before);
  const nextBuffer =
    input.buffer.slice(0, target.start) +
    after +
    input.buffer.slice(target.end);

  const transaction: AiEditTransaction = {
    id: makeTransactionId(),
    tabId: input.tabId,
    tabName: input.tabName,
    tabPath: input.tabPath,
    request: input.request,
    target,
    before,
    after,
    beforeBuffer: input.buffer,
    afterBuffer: nextBuffer,
    appliedAtMs: Date.now(),
    diff: null,
  };

  return { ok: true, transaction, nextBuffer };
}

function makeTransactionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// `AiEditTransactionStore` is a tiny session-local store
// that holds the *latest* AI edit transaction per tab. The
// escape hatch only ever needs the latest one (the user is
// either going to review it or discard it); the data model
// keeps `Map<tabId, AiEditTransaction>` so switching tabs
// does not lose the pending review.
//
// The store is intentionally not a React hook — it is a
// pure module-level state holder with subscribe / get /
// record / clear, and the consuming hook
// (`useAiEditTransactionStore`) is a thin re-rendering
// wrapper. This matches the pattern in
// `useReviewDeskState` for the manual candidate input.

type Listener = () => void;

class AiEditTransactionStore {
  private byTab = new Map<string, AiEditTransaction>();
  private listeners = new Set<Listener>();

  getLatest(tabId: string): AiEditTransaction | null {
    return this.byTab.get(tabId) ?? null;
  }

  // `record` stores a transaction under its `tabId`,
  // replacing any prior transaction for the same tab. The
  // store retains the most recent transaction only — older
  // transactions are discarded. This keeps the escape
  // hatch simple and the mock data model narrow.
  record(transaction: AiEditTransaction): void {
    this.byTab.set(transaction.tabId, transaction);
    this.emit();
  }

  // `clear` removes the pending transaction for a tab. The
  // escape hatch calls this on Apply / Discard / tab close
  // so the next render does not surface a stale review.
  clear(tabId: string): void {
    if (this.byTab.delete(tabId)) {
      this.emit();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const aiEditTransactionStore = new AiEditTransactionStore();
