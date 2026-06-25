// v0.34: プレビュー系（PreviewPane / EBookPane）で共通利用する Markdown
// 再描画デバウンス。編集中の連続入力で marked + DOMPurify + DOM 操作が
// 同期実行されてタイピングの引っ掛かりになるのを防ぐ。ソースが止まると
// PREVIEW_RENDER_DEBOUNCE_MS 後に必ず描画されるので、見かけの遅延は小さい。
export const PREVIEW_RENDER_DEBOUNCE_MS = 200;

export function schedulePreviewRender(callback: () => void): () => void {
  const handle = window.setTimeout(callback, PREVIEW_RENDER_DEBOUNCE_MS);
  return () => {
    window.clearTimeout(handle);
  };
}
