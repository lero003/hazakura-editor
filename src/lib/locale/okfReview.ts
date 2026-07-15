import type { MenuLanguage } from "../../types";
import type {
  OkfFindingCode,
  OkfReviewFinding,
} from "../../features/okf";
import { isKanaStyle } from "./_helpers";

export type OkfTruncationCopyKey =
  | "walk-entries"
  | "markdown-files"
  | "file-bytes"
  | "total-bytes"
  | "depth";

export type OkfReviewCopy = {
  title: string;
  diskSnapshotNote: string;
  dirtyTabNote: string;
  noWorkspace: string;
  scanning: string;
  cancelling: string;
  cancel: string;
  rerun: string;
  close: string;
  openConcept: string;
  filesHeading: string;
  findingsHeading: string;
  emptyFiles: string;
  emptyFindings: string;
  findingsTruncated: string;
  findingMessages: Record<OkfFindingCode, string>;
  truncated: string;
  truncationReasons: Record<OkfTruncationCopyKey, string>;
  cancelled: string;
  failures: string;
  advice: string;
  concepts: string;
  indexes: string;
  logs: string;
  unreadable: string;
  kindConcept: string;
  kindIndex: string;
  kindLog: string;
  kindUnreadable: string;
  severityFailure: string;
  severityAdvice: string;
  severityInfo: string;
  openDirty: string;
  contextMenuReview: string;
  statusStarted: string;
  statusDone: string;
  statusFailed: string;
  statusNoWorkspace: string;
};

export function formatOkfFindingMessage(
  copy: OkfReviewCopy,
  finding: OkfReviewFinding,
): string {
  const base = copy.findingMessages[finding.code] ?? finding.message;
  return finding.relatedPath ? `${base}: ${finding.relatedPath}` : base;
}

export function formatOkfTruncationMessage(
  copy: OkfReviewCopy,
  reason: string | undefined | null,
  language: MenuLanguage = "en",
): string {
  if (!reason) {
    return copy.truncated;
  }
  const localized =
    reason in copy.truncationReasons
      ? copy.truncationReasons[reason as OkfTruncationCopyKey]
      : reason;
  if (language === "en") {
    return `${copy.truncated} (${localized}).`;
  }
  return `${copy.truncated}（${localized}）。`;
}

export function getOkfReviewCopy(lang: MenuLanguage): OkfReviewCopy {
  if (isKanaStyle(lang)) {
    return {
      title: "OKF Draft ごかんを てんけん",
      diskSnapshotNote:
        "けっかは ディスク上の ファイルを みます。ひらいている みほぞんの タブと ちがう ことがあります。",
      dirtyTabNote: "この ファイルは みほぞんの タブで ひらいています。",
      noWorkspace: "ところを ひらいてから てんけんして ください。",
      scanning: "てんけん ちゅう…",
      cancelling: "ちゅうし しています…",
      cancel: "ちゅうし",
      rerun: "もういちど",
      close: "とぢる",
      openConcept: "ひらく",
      filesHeading: "ファイル",
      findingsHeading: "けんしゅつ",
      emptyFiles: "Markdown ファイルは ありません。",
      emptyFindings: "けんしゅつは ありません。",
      findingsTruncated:
        "けんしゅつは ひょうじの かぎりまでです。のこりは しょうりゃくしました。",
      findingMessages: {
        "missing-frontmatter": "せんとうの YAML frontmatter が ありません",
        "unparseable-frontmatter": "YAML frontmatter を よみとれません",
        "missing-type": "ひつような type が ありません",
        "invalid-type": "type は からでない もじれつに してください",
        "unknown-type": "つくりて どくじの type として あつかいます",
        "missing-optional-metadata": "すすめる メタデータが ありません",
        "root-index-version": "root index.md の OKF version を かくにんして ください",
        "nested-index-frontmatter": "したの index.md に frontmatter が あります",
        "index-shape": "index.md の こうせいを かくにんして ください",
        "log-shape": "log.md の ひづけと ならびを かくにんして ください",
        "broken-link": "リンクさきが ないか、まだ かかれていません",
        "out-of-scope-link": "リンクさきは えらんだ バンドルの そとです",
        "external-link": "そとの リンクです",
        "unsupported-link": "たいおうしていない リンクです",
        "unreadable-file": "Markdown ファイルを よみとれません",
        "reserved-type-field": "index / log の type は Concept はんていに つかいません",
      },
      truncated: "よみとり が うちきられました",
      truncationReasons: {
        "walk-entries": "エントリ かずの かぎり",
        "markdown-files": "Markdown ファイル かずの かぎり",
        "file-bytes": "1 ファイル サイズの かぎり",
        "total-bytes": "よみとり そうりょうの かぎり",
        depth: "フォルダ ふかさの かぎり",
      },
      cancelled: "てんけんは ちゅうし されました。",
      failures: "しっぱい",
      advice: "じょげん",
      concepts: "コンセプト",
      indexes: "index",
      logs: "log",
      unreadable: "よめない",
      kindConcept: "コンセプト",
      kindIndex: "index",
      kindLog: "log",
      kindUnreadable: "よめない",
      severityFailure: "しっぱい",
      severityAdvice: "じょげん",
      severityInfo: "じょうほう",
      openDirty: "ひらく（みほぞん）",
      contextMenuReview: "OKF Draft ごかんを てんけん",
      statusStarted: "OKF Draft ごかんを てんけん しています…",
      statusDone: "OKF Draft ごかん てんけんが おわりました。",
      statusFailed: "OKF Draft ごかん てんけんに しっぱい しました。",
      statusNoWorkspace: "ところを ひらいてから OKF を てんけんして ください。",
    };
  }

  if (lang === "ja") {
    return {
      title: "OKF Draft 互換を点検",
      diskSnapshotNote:
        "結果はディスク上のファイルを反映します。開いている未保存タブと異なる場合があります。",
      dirtyTabNote: "このファイルは未保存のタブとして開いています。",
      noWorkspace: "ワークスペースを開いてから点検してください。",
      scanning: "点検中…",
      cancelling: "中止しています…",
      cancel: "中止",
      rerun: "再実行",
      close: "閉じる",
      openConcept: "開く",
      filesHeading: "ファイル",
      findingsHeading: "検出",
      emptyFiles: "Markdown ファイルはありません。",
      emptyFindings: "検出はありません。",
      findingsTruncated:
        "検出結果は表示上限に達したため、残りを省略しました。",
      findingMessages: {
        "missing-frontmatter": "先頭の YAML frontmatter がありません",
        "unparseable-frontmatter": "YAML frontmatter を解析できません",
        "missing-type": "必須の type がありません",
        "invalid-type": "type は空でない文字列にしてください",
        "unknown-type": "producer 独自の type として扱います",
        "missing-optional-metadata": "推奨メタデータがありません",
        "root-index-version": "root index.md の OKF version を確認してください",
        "nested-index-frontmatter": "下位の index.md に frontmatter があります",
        "index-shape": "index.md の構成を確認してください",
        "log-shape": "log.md の日付見出しと並びを確認してください",
        "broken-link": "リンク先がないか、まだ作成されていません",
        "out-of-scope-link": "リンク先は選択した bundle root の外です",
        "external-link": "外部リンクです",
        "unsupported-link": "対応していないリンクです",
        "unreadable-file": "Markdown ファイルを読み取れません",
        "reserved-type-field": "index / log の type は Concept 判定に使いません",
      },
      truncated: "読み取りが上限により打ち切られました",
      truncationReasons: {
        "walk-entries": "エントリ数の上限",
        "markdown-files": "Markdown ファイル数の上限",
        "file-bytes": "1 ファイルサイズの上限",
        "total-bytes": "読み取り総量の上限",
        depth: "フォルダ深さの上限",
      },
      cancelled: "点検は中止されました。",
      failures: "失敗",
      advice: "助言",
      concepts: "Concept",
      indexes: "index",
      logs: "log",
      unreadable: "読めない",
      kindConcept: "Concept",
      kindIndex: "index",
      kindLog: "log",
      kindUnreadable: "読めない",
      severityFailure: "失敗",
      severityAdvice: "助言",
      severityInfo: "情報",
      openDirty: "開く（未保存）",
      contextMenuReview: "OKF Draft 互換を点検",
      statusStarted: "OKF Draft 互換を点検しています…",
      statusDone: "OKF Draft 互換の点検が終わりました。",
      statusFailed: "OKF Draft 互換の点検に失敗しました。",
      statusNoWorkspace: "ワークスペースを開いてから OKF を点検してください。",
    };
  }

  return {
    title: "Review OKF Draft compatibility",
    diskSnapshotNote:
      "Results reflect files on disk. An open dirty tab may differ from the scan.",
    dirtyTabNote: "This file is open in a dirty tab.",
    noWorkspace: "Open a workspace before running an OKF review.",
    scanning: "Reviewing…",
    cancelling: "Cancelling…",
    cancel: "Cancel",
    rerun: "Rerun",
    close: "Close",
    openConcept: "Open",
    filesHeading: "Files",
    findingsHeading: "Findings",
    emptyFiles: "No Markdown files.",
    emptyFindings: "No findings.",
    findingsTruncated:
      "The findings display limit was reached; remaining findings were omitted.",
    findingMessages: {
      "missing-frontmatter": "Leading YAML frontmatter is missing",
      "unparseable-frontmatter": "YAML frontmatter could not be parsed",
      "missing-type": "Required type is missing",
      "invalid-type": "Type must be a non-empty string",
      "unknown-type": "Treated as a producer-defined type",
      "missing-optional-metadata": "Recommended metadata is missing",
      "root-index-version": "Review the OKF version in the root index.md",
      "nested-index-frontmatter": "A nested index.md contains frontmatter",
      "index-shape": "Review the index.md structure",
      "log-shape": "Review the log.md date headings and order",
      "broken-link": "Link target is missing or not written yet",
      "out-of-scope-link": "Link target is outside the selected bundle root",
      "external-link": "External link",
      "unsupported-link": "Unsupported link destination",
      "unreadable-file": "Markdown file could not be read",
      "reserved-type-field": "The type in index/log is not used for concept classification",
    },
    truncated: "Read was truncated by a scan budget",
    truncationReasons: {
      "walk-entries": "entry count limit",
      "markdown-files": "Markdown file count limit",
      "file-bytes": "per-file size limit",
      "total-bytes": "total bytes limit",
      depth: "directory depth limit",
    },
    cancelled: "Review was cancelled.",
    failures: "Failures",
    advice: "Advice",
    concepts: "Concepts",
    indexes: "Indexes",
    logs: "Logs",
    unreadable: "Unreadable",
    kindConcept: "Concept",
    kindIndex: "Index",
    kindLog: "Log",
    kindUnreadable: "Unreadable",
    severityFailure: "Failure",
    severityAdvice: "Advice",
    severityInfo: "Info",
    openDirty: "Open (dirty)",
    contextMenuReview: "Review OKF Draft compatibility",
    statusStarted: "Reviewing OKF Draft compatibility…",
    statusDone: "OKF Draft compatibility review finished.",
    statusFailed: "OKF Draft compatibility review failed.",
    statusNoWorkspace: "Open a workspace before reviewing OKF.",
  };
}
