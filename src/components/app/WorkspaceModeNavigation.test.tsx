import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceModeNavigation } from "./WorkspaceModeNavigation";

afterEach(cleanup);
const base = { mode: "write" as const, canNavigate: true, menuLanguage: "ja" as const,
  documentName: "朝の余白.md", reviewTargets: [], onWrite: vi.fn(), onRead: vi.fn(), onReview: vi.fn() };

describe("WorkspaceModeNavigation", () => {
  it("does not dispatch a review without a real target", () => {
    const onReview = vi.fn(); render(<WorkspaceModeNavigation {...base} onReview={onReview} />);
    fireEvent.click(screen.getByRole("button", { name: "確認" }));
    expect(onReview).not.toHaveBeenCalled();
  });
  it("opens one target directly and asks for a choice when several exist", () => {
    const onReview = vi.fn();
    const view = render(<WorkspaceModeNavigation {...base} reviewTargets={["disk"]} onReview={onReview} />);
    fireEvent.click(screen.getByRole("button", { name: "確認" }));
    expect(onReview).toHaveBeenCalledWith("disk");
    onReview.mockClear();
    view.rerender(<WorkspaceModeNavigation {...base} reviewTargets={["disk", "reference"]} onReview={onReview} />);
    fireEvent.click(screen.getByRole("button", { name: "確認" }));
    expect(onReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /保存前の変更.*朝の余白/ }));
    expect(onReview).toHaveBeenCalledWith("disk");
  });
  it("closes a stale choice when a same-named document or target context changes", () => {
    const view = render(<WorkspaceModeNavigation {...base} reviewTargets={["proposal", "disk"]} />);
    fireEvent.click(screen.getByRole("button", { name: "確認" }));
    view.rerender(<WorkspaceModeNavigation {...base} contextKey="new-session" reviewTargets={["proposal", "disk"]} />);
    expect(screen.queryByRole("group", { name: "確認する対象" })).toBeNull();
    view.rerender(<WorkspaceModeNavigation {...base} reviewTargets={["proposal", "disk"]} />);
    expect(screen.queryByRole("group", { name: "確認する対象" })).toBeNull();
  });
  it("identifies the actual reference and retained comparison instead of relabeling them as the active document", () => {
    render(<WorkspaceModeNavigation {...base} reviewTargets={["reference", "comparison"]}
      referenceName="参考資料.txt" comparisonName="別の原稿.md" />);
    fireEvent.click(screen.getByRole("button", { name: "確認" }));
    expect(screen.getByRole("button", { name: /参照ファイル.*朝の余白.md.*参考資料.txt/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /開いている比較.*別の原稿.md/ })).toBeTruthy();
  });
  it("keeps IME Escape for composition and returns focus on ordinary Escape", () => {
    render(<WorkspaceModeNavigation {...base} reviewTargets={["disk", "reference"]} />);
    const trigger = screen.getByRole("button", { name: "確認" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("group", { name: "確認する対象" }), { key: "Escape", isComposing: true });
    expect(screen.getByRole("group", { name: "確認する対象" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("group", { name: "確認する対象" }), { key: "Escape" });
    expect(screen.queryByRole("group", { name: "確認する対象" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("WorkspaceModeNavigation while reading", () => {
  it("keeps 書く pressable and stops 読む・確認 while the reading surface is open", () => {
    // 実機指摘②: 電子書籍モードでも「書く」で編集へ戻れる必要がある。
    const onWrite = vi.fn();
    const onRead = vi.fn();
    render(
      <WorkspaceModeNavigation
        {...base}
        mode="read"
        onRead={onRead}
        onWrite={onWrite}
        readingOpen
        reviewTargets={["disk"]}
      />,
    );

    const write = screen.getByRole("button", { name: "書く" }) as HTMLButtonElement;
    const read = screen.getByRole("button", { name: "読む" }) as HTMLButtonElement;
    const review = screen.getByRole("button", { name: "確認" }) as HTMLButtonElement;

    expect(write.disabled).toBe(false);
    expect(write.getAttribute("title")).toBe("読むのをやめて編集へ戻る");
    expect(read.disabled).toBe(true);
    expect(review.disabled).toBe(true);

    fireEvent.click(write);
    expect(onWrite).toHaveBeenCalledTimes(1);
    fireEvent.click(read);
    expect(onRead).not.toHaveBeenCalled();
  });
});
