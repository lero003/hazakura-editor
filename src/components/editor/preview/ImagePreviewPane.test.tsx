import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ImagePreviewPane } from "./ImagePreviewPane";
const image = { path: "/workspace/assets/image.png", name: "image.png", url: "blob:first", size: 2400 };
afterEach(cleanup);

function loadImage(naturalWidth = 320, naturalHeight = 160) {
  const img = screen.getByRole("img");
  Object.defineProperties(img, {
    naturalWidth: { value: naturalWidth },
    naturalHeight: { value: naturalHeight },
  });
  fireEvent.load(img);
  return img;
}

describe("ImagePreviewPane", () => {
  it("shows read-only metadata from the loaded image", () => {
    render(<ImagePreviewPane image={image} title="画像" menuLanguage="ja" />);
    expect(screen.getByText("読み取り専用")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("読み込んでいます");
    loadImage();
    expect(screen.getByLabelText("画像の実寸").textContent).toBe("320 × 160 px");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the relative path and format from real data", () => {
    render(
      <ImagePreviewPane image={image} title="画像" menuLanguage="ja" workspaceRootPath="/workspace" />,
    );
    loadImage(1240, 848);

    expect(screen.getByText("assets/image.png")).toBeTruthy();
    expect(screen.getByText("PNG")).toBeTruthy();
  });

  it("does not invent a path when the workspace root is unknown", () => {
    render(<ImagePreviewPane image={image} title="画像" menuLanguage="ja" />);
    loadImage();

    const info = document.querySelector(".image-preview-info");
    expect(info?.textContent).toContain("image.png");
    expect(info?.textContent).not.toContain("assets/image.png");
  });

  it("drops a previous image error and dimensions when another URL is selected", () => {
    const view = render(<ImagePreviewPane image={image} title="Image" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("alert")).toBeTruthy();
    view.rerender(<ImagePreviewPane image={{ ...image, url: "blob:second", name: "next.png" }} title="Image" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:second");
    expect(screen.queryByLabelText("Image dimensions")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("uses kana for new status text", () => {
    render(<ImagePreviewPane image={image} title="がぞう" menuLanguage="kana" />);
    expect(screen.getByText("よみとりせんよう")).toBeTruthy();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("alert").textContent).toContain("がぞうを ひょうじできません");
  });
});

describe("image zoom controls", () => {
  it("offers only display transforms, not editing or saving", () => {
    render(<ImagePreviewPane image={image} title="画像" menuLanguage="ja" />);
    loadImage(1240, 848);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([
      "縮小",
      "拡大",
      "全体を表示",
    ]);
    // 画像そのものを書き換える操作は置かない。
    for (const button of buttons) {
      expect(/保存|書き出|貼り付け|コピー/.test(button.textContent ?? "")).toBe(false);
    }
  });

  it("steps the manual zoom and returns to fit", () => {
    render(<ImagePreviewPane image={image} title="画像" menuLanguage="ja" />);
    loadImage(1240, 848);

    const value = () => screen.getByLabelText("倍率").textContent;
    const fit = screen.getByRole("button", { name: "全体を表示" });
    expect(value()).toBe("100%");
    expect(fit.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    expect(value()).toBe("150%");
    expect(fit.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "縮小" }));
    expect(value()).toBe("100%");

    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    fireEvent.click(fit);
    expect(value()).toBe("100%");
    expect(fit.getAttribute("aria-pressed")).toBe("true");
  });

  it("applies the zoom as a width transform so edges stay reachable", () => {
    render(<ImagePreviewPane image={image} title="画像" menuLanguage="ja" />);
    const img = loadImage(1240, 848);

    expect(img.style.width).toBe("1240px");
    // 100% を超えたら CSS 側の上限で切り捨てられない（端まで送れる）。
    expect(img.style.maxWidth).toBe("none");
    expect(img.style.maxHeight).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByRole("img").style.width).toBe("1860px");
  });
});
