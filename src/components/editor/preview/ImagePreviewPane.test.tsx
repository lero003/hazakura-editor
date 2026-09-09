import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ImagePreviewPane } from "./ImagePreviewPane";
const image = { path: "/workspace/image.png", name: "image.png", url: "blob:first", size: 2400 };
afterEach(cleanup);
it("shows read-only metadata from the loaded image without adding editing controls", () => {
  render(<ImagePreviewPane image={image} title="画像" menuLanguage="ja" />);
  expect(screen.getByText("読み取り専用")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("読み込んでいます");
  const img = screen.getByRole("img");
  Object.defineProperties(img, { naturalWidth: { value: 320 }, naturalHeight: { value: 160 } });
  fireEvent.load(img);
  expect(screen.getByLabelText("画像の実寸").textContent).toBe("320 × 160 px");
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
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
