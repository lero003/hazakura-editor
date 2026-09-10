import type { ExportFormatId } from "./ExportFormatNav";

/**
 * 形式ナビの切替で何をするか（画面11）。
 *
 * 3つの書き出しはそれぞれ別の準備処理を持っているので、切替は
 * **いまのダイアログを閉じて、選んだ形式の既存の準備を呼ぶ**だけにする。
 * 新しい書き出し経路は作らない。同じ形式を選んだときは何もしない。
 */
export function exportFormatSwitchPlan(
  current: ExportFormatId,
  next: ExportFormatId,
): { cancel: ExportFormatId; start: ExportFormatId } | null {
  if (current === next) return null;
  return { cancel: current, start: next };
}
