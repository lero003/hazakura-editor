import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import type { TextFileDocument } from "../../lib/tauri";

const tauriMocks = vi.hoisted(() => ({
  openTextFile: vi.fn(),
  pickCandidateTextFile: vi.fn(),
}));

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    openTextFile: tauriMocks.openTextFile,
    pickCandidateTextFile: tauriMocks.pickCandidateTextFile,
  };
});

import {
  useCandidateFileImport,
  type CandidateFileImportTarget,
} from "./useCandidateFileImport";

const openTextFile = tauriMocks.openTextFile as Mock<
  (path: string) => Promise<TextFileDocument>
>;
const pickCandidateTextFile = tauriMocks.pickCandidateTextFile as Mock<
  () => Promise<string | null>
>;

const target: CandidateFileImportTarget = {
  id: "tab-1",
  name: "draft.md",
  path: "/workspace/draft.md",
  contents: "# Draft\n\nold body\n",
};

const copy = {
  candidateColumnLeft: "Current buffer",
  candidateColumnRight: "Candidate",
  candidateSourceFile: (name: string) => `File import: ${name}`,
} as unknown as Parameters<typeof useCandidateFileImport>[0]["copy"];

function makeTextFileDocument(
  overrides: Partial<TextFileDocument> = {},
): TextFileDocument {
  return {
    path: "/tmp/proposal.md",
    name: "proposal.md",
    contents: "# Draft\n\nnew body\n",
    line_ending: "lf",
    encoding: "utf-8",
    size: 18,
    modified_ms: 1,
    fingerprint: "fp-proposal",
    large_file_warning: false,
    ...overrides,
  };
}

function makeRunCandidateCompare(
  impl?: (params: never) => { ok: true } | { ok: false; error: string },
) {
  return vi.fn(impl ?? (() => ({ ok: true as const }))) as unknown as Parameters<
    typeof useCandidateFileImport
  >[0]["runCandidateCompare"];
}

describe("useCandidateFileImport", () => {
  beforeEach(() => {
    openTextFile.mockReset();
    pickCandidateTextFile.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("imports a selected text file into the candidate input and compares it without applying", async () => {
    pickCandidateTextFile.mockResolvedValueOnce("/tmp/proposal.md");
    openTextFile.mockResolvedValueOnce(makeTextFileDocument());
    const setCandidateInputText = vi.fn();
    const runCandidateCompare = makeRunCandidateCompare();
    const { result } = renderHook(() =>
      useCandidateFileImport({
        activeTab: target,
        copy,
        runCandidateCompare,
        setCandidateInputText,
      }),
    );

    let returned: { ok: boolean; candidateText?: string } = { ok: false };
    await act(async () => {
      returned = await result.current.importAndCompare();
    });

    expect(returned).toMatchObject({
      ok: true,
      candidateText: "# Draft\n\nnew body\n",
    });
    expect(pickCandidateTextFile).toHaveBeenCalledTimes(1);
    expect(openTextFile).toHaveBeenCalledWith("/tmp/proposal.md");
    expect(setCandidateInputText).toHaveBeenCalledWith("# Draft\n\nnew body\n");
    expect(runCandidateCompare).toHaveBeenCalledTimes(1);
    expect(
      (runCandidateCompare as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][0],
    ).toMatchObject({
      bufferContents: target.contents,
      documentTabId: target.id,
      documentPath: target.path,
      documentLabel: target.name,
      leftColumnLabel: copy.candidateColumnLeft,
      rightColumnLabel: copy.candidateColumnRight,
      candidateSourceLabel: "File import: proposal.md",
      candidateText: "# Draft\n\nnew body\n",
    });
  });

  it("treats a canceled picker as a no-op", async () => {
    pickCandidateTextFile.mockResolvedValueOnce(null);
    const setCandidateInputText = vi.fn();
    const runCandidateCompare = makeRunCandidateCompare();
    const { result } = renderHook(() =>
      useCandidateFileImport({
        activeTab: target,
        copy,
        runCandidateCompare,
        setCandidateInputText,
      }),
    );

    let returned: { ok: boolean; canceled?: boolean } = { ok: true };
    await act(async () => {
      returned = await result.current.importAndCompare();
    });

    expect(returned).toEqual({ ok: false, canceled: true });
    expect(result.current.error).toBeNull();
    expect(openTextFile).not.toHaveBeenCalled();
    expect(setCandidateInputText).not.toHaveBeenCalled();
    expect(runCandidateCompare).not.toHaveBeenCalled();
  });

  it("rejects before opening a picker when there is no active tab", async () => {
    const { result } = renderHook(() =>
      useCandidateFileImport({
        activeTab: null,
        copy,
        runCandidateCompare: makeRunCandidateCompare(),
        setCandidateInputText: vi.fn(),
      }),
    );

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      returned = await result.current.importAndCompare();
    });

    expect(returned.ok).toBe(false);
    expect(returned.error).toContain("active editor tab");
    expect(result.current.error).toContain("active editor tab");
    expect(pickCandidateTextFile).not.toHaveBeenCalled();
  });

  it("ignores an imported candidate when the active tab changes before compare", async () => {
    pickCandidateTextFile.mockResolvedValueOnce("/tmp/proposal.md");
    let resolveOpen: (document: TextFileDocument) => void = () => {};
    openTextFile.mockImplementation(
      () =>
        new Promise<TextFileDocument>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    const setCandidateInputText = vi.fn();
    const runCandidateCompare = makeRunCandidateCompare();
    const otherTarget: CandidateFileImportTarget = {
      id: "tab-2",
      name: "other.md",
      path: "/workspace/other.md",
      contents: "# Other\n",
    };
    const { result, rerender } = renderHook(
      ({ activeTab }: { activeTab: CandidateFileImportTarget | null }) =>
        useCandidateFileImport({
          activeTab,
          copy,
          runCandidateCompare,
          setCandidateInputText,
        }),
      { initialProps: { activeTab: target } },
    );

    let inFlight: Promise<unknown> = Promise.resolve();
    act(() => {
      inFlight = result.current.importAndCompare();
    });
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ activeTab: otherTarget });

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      resolveOpen(makeTextFileDocument());
      returned = (await inFlight) as { ok: boolean; error?: string };
    });

    expect(returned.ok).toBe(false);
    expect(returned.error).toContain("active editor tab changed");
    expect(result.current.error).toContain("active editor tab changed");
    expect(setCandidateInputText).not.toHaveBeenCalled();
    expect(runCandidateCompare).not.toHaveBeenCalled();
  });

  it("surfaces compare errors without clearing the imported candidate text", async () => {
    pickCandidateTextFile.mockResolvedValueOnce("/tmp/proposal.md");
    openTextFile.mockResolvedValueOnce(makeTextFileDocument());
    const setCandidateInputText = vi.fn();
    const runCandidateCompare = makeRunCandidateCompare(() => ({
      ok: false,
      error: "buffer / candidate combination is too large",
    }));
    const { result } = renderHook(() =>
      useCandidateFileImport({
        activeTab: target,
        copy,
        runCandidateCompare,
        setCandidateInputText,
      }),
    );

    let returned: { ok: boolean; error?: string } = { ok: true };
    await act(async () => {
      returned = await result.current.importAndCompare();
    });

    expect(returned.ok).toBe(false);
    expect(returned.error).toContain("too large");
    expect(result.current.error).toContain("too large");
    expect(setCandidateInputText).toHaveBeenCalledWith("# Draft\n\nnew body\n");
  });
});
