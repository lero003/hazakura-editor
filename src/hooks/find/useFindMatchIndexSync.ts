import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { SearchOptions } from "../../types";

type UseFindMatchIndexSyncOptions = {
  activeMatchIndex: number;
  documentKey: string;
  findMatchCount: number;
  findQuery: string;
  searchOptions: SearchOptions;
  setActiveMatchIndex: Dispatch<SetStateAction<number>>;
  // 置換直後の位置ベース選択が未処理の間は、件数による丸めを止める。
  // 同じ render で両方が index を書くと、古い index と新しい件数を見た丸めが後勝ちする。
  suppressClamp?: boolean;
};

export function useFindMatchIndexSync({
  activeMatchIndex,
  documentKey,
  findMatchCount,
  findQuery,
  searchOptions,
  setActiveMatchIndex,
  suppressClamp = false,
}: UseFindMatchIndexSyncOptions) {
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [documentKey, findQuery, searchOptions, setActiveMatchIndex]);

  useEffect(() => {
    if (!suppressClamp && activeMatchIndex >= findMatchCount) {
      setActiveMatchIndex(Math.max(findMatchCount - 1, 0));
    }
  }, [activeMatchIndex, findMatchCount, setActiveMatchIndex, suppressClamp]);
}
