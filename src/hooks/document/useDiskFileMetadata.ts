import { useEffect, useState } from "react";
import { isTauriRuntime } from "../../lib/tauri/_runtime";
import { getFileMetadata } from "../../lib/tauri/files";

export type DiskFileMetadata = {
  size: number;
  modifiedMs: number | null;
};

/**
 * ディスク上のファイルの実メタデータ（バイト数・最終更新）だけを読む。
 *
 * 保存衝突のダイアログは「このウィンドウの編集」と「ディスク上のファイル」を
 * 同格に見せる（画面14）。バッファ側の文字数は `tab.contents` から実データで
 * 出せるが、ディスク側の文字数は**本文を読まないと分からない**。ここでは本文を
 * 読まずに、既存の `get_file_metadata` が返すバイト数と `modified_ms` だけを使う
 * （モックの「日時・文字数等は得られる実データだけ表示する」に従う）。
 *
 * 読み取りだけなので、衝突の事実・保存状態・本文は変えない。
 */
export function useDiskFileMetadata(path: string | null | undefined): DiskFileMetadata | null {
  const [metadata, setMetadata] = useState<DiskFileMetadata | null>(null);

  useEffect(() => {
    setMetadata(null);
    if (!path || !isTauriRuntime()) {
      return;
    }

    let cancelled = false;
    getFileMetadata(path)
      .then((result) => {
        if (cancelled) return;
        setMetadata({ size: result.size, modifiedMs: result.modified_ms });
      })
      .catch(() => {
        // 読めない場合は数字を出さない（推測で埋めない）。
        if (!cancelled) setMetadata(null);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return metadata;
}
