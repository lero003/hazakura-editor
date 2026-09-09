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
  it("closes a stale choice when the document changes", () => {
    const view = render(<WorkspaceModeNavigation {...base} reviewTargets={["proposal", "disk"]} />);
    fireEvent.click(screen.getByRole("button", { name: "確認" }));
    view.rerender(<WorkspaceModeNavigation {...base} documentName="次の原稿.md" reviewTargets={["disk"]} />);
    expect(screen.queryByRole("group", { name: "確認する対象" })).toBeNull();
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
