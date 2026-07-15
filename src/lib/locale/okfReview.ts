import type { MenuLanguage } from "../../types";
import type {
  OkfFindingCode,
  OkfReviewFinding,
  OkfSurfaceFolderKind,
  OkfSurfacePresentation,
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
  purposeIntro: string;
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
  priorityHeading: string;
  optionalHeading: string;
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
  statusEmpty: string;
  statusPlainMarkdown: string;
  statusOkfClean: string;
  statusOkfFailures: string;
  statusOkfAdviceOnly: string;
  detailsHeading: string;
  morePriority: string;
  moreOptional: string;
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

export function formatOkfSurfaceStatus(
  copy: OkfReviewCopy,
  presentation: OkfSurfacePresentation,
  language: MenuLanguage = "en",
): string {
  switch (presentation.folderKind as OkfSurfaceFolderKind) {
    case "empty":
      return copy.statusEmpty;
    case "plain-markdown":
      return copy.statusPlainMarkdown;
    case "okf-like":
      if (presentation.failureCount > 0) {
        return formatCountMessage(
          copy.statusOkfFailures,
          presentation.failureCount,
          language,
        );
      }
      if (presentation.optionalCount > 0) {
        return formatCountMessage(
          copy.statusOkfAdviceOnly,
          presentation.optionalCount,
          language,
        );
      }
      return copy.statusOkfClean;
  }
}

function formatCountMessage(
  template: string,
  count: number,
  language: MenuLanguage,
): string {
  if (template.includes("{count}")) {
    return template.replaceAll("{count}", String(count));
  }
  // Fallback for accidental missing placeholder.
  if (language === "en") {
    return `${template} (${count})`;
  }
  return `${template}（${count}）`;
}

export function formatOkfMoreCount(
  template: string,
  remaining: number,
): string {
  return template.replaceAll("{count}", String(remaining));
}

function sharedFindingMessages(
  lang: "ja" | "kana" | "en",
): Record<OkfFindingCode, string> {
  if (lang === "kana") {
    return {
      "missing-frontmatter":
        "このノートは concept として よめません。せんとうに YAML（type など）が ひつようです",
      "unparseable-frontmatter":
        "せんとうの YAML を よみとれません。かきかたを なおして ください",
      "missing-type":
        "このノートは concept として よめません。type を かいて ください",
      "invalid-type": "type は からでない もじれつに してください",
      "unknown-type": "作者どくじの type です（ごかん しっぱいでは ありません）",
      "missing-optional-metadata": "あると べんりな メタデータが ありません（にんい）",
      "root-index-version":
        "root の index.md に okf_version: \"0.1\" が あると わかりやすいです（にんい）",
      "nested-index-frontmatter": "したの index.md に frontmatter が あります（さんこう）",
      "index-shape": "index.md の 見出しや リストを かくにんして ください（にんい）",
      "log-shape": "log.md の ひづけ みだしと ならびを かくにんして ください（にんい）",
      "broken-link": "リンクさきの ファイルが ないか、まだ かかれていません",
      "out-of-scope-link": "リンクさきは てんけんした フォルダの そとです",
      "external-link": "そとの リンクです（とりにいきません）",
      "unsupported-link": "このかたちの リンクは たいおうしていません",
      "unreadable-file": "Markdown ファイルを よみとれません",
      "reserved-type-field":
        "index / log の type は Concept はんていに つかいません（さんこう）",
    };
  }
  if (lang === "ja") {
    return {
      "missing-frontmatter":
        "このノートは concept として読めません。先頭に YAML（type など）が必要です",
      "unparseable-frontmatter":
        "先頭の YAML を読み取れません。書き方を直してください",
      "missing-type":
        "このノートは concept として読めません。type を書いてください",
      "invalid-type": "type は空でない文字列にしてください",
      "unknown-type": "作者独自の type です（互換失敗ではありません）",
      "missing-optional-metadata": "あると便利なメタデータがありません（任意）",
      "root-index-version":
        "root の index.md に okf_version: \"0.1\" があると分かりやすいです（任意）",
      "nested-index-frontmatter": "下位の index.md に frontmatter があります（参考）",
      "index-shape": "index.md の見出しやリストを確認してください（任意）",
      "log-shape": "log.md の日付見出しと並びを確認してください（任意）",
      "broken-link": "リンク先のファイルがないか、まだ作成されていません",
      "out-of-scope-link": "リンク先は点検したフォルダの外です",
      "external-link": "外部リンクです（取得しません）",
      "unsupported-link": "この形式のリンクには対応していません",
      "unreadable-file": "Markdown ファイルを読み取れません",
      "reserved-type-field":
        "index / log の type は Concept 判定に使いません（参考）",
    };
  }
  return {
    "missing-frontmatter":
      "This note cannot be read as a concept. Add leading YAML with a type",
    "unparseable-frontmatter":
      "Leading YAML could not be read. Fix the frontmatter syntax",
    "missing-type":
      "This note cannot be read as a concept. Add a type field",
    "invalid-type": "Type must be a non-empty string",
    "unknown-type": "Producer-defined type (not a compatibility failure)",
    "missing-optional-metadata": "Recommended metadata is missing (optional)",
    "root-index-version":
      'Root index.md is clearer with okf_version: "0.1" (optional)',
    "nested-index-frontmatter":
      "A nested index.md contains frontmatter (informational)",
    "index-shape": "Review the index.md headings and lists (optional)",
    "log-shape": "Review the log.md date headings and order (optional)",
    "broken-link": "Link target is missing or not written yet",
    "out-of-scope-link": "Link target is outside the reviewed folder",
    "external-link": "External link (not fetched)",
    "unsupported-link": "Unsupported link destination",
    "unreadable-file": "Markdown file could not be read",
    "reserved-type-field":
      "type in index/log is not used for concept classification (informational)",
  };
}

export function getOkfReviewCopy(lang: MenuLanguage): OkfReviewCopy {
  if (isKanaStyle(lang)) {
    return {
      title: "ちしきフォルダ（OKF）を てんけん",
      purposeIntro:
        "ほんの ならびかえでは ありません。えらんだ フォルダの Markdown が OKF v0.1 Draft として よめるかを かくにんします。じどうでは なおしません。",
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
      findingsHeading: "すべての けんしゅつ",
      priorityHeading: "いま なおすと きくこと",
      optionalHeading: "にんいの かいぜんあん",
      emptyFiles: "Markdown ファイルは ありません。",
      emptyFindings: "けんしゅつは ありません。",
      findingsTruncated:
        "けんしゅつは ひょうじの かぎりまでです。のこりは しょうりゃくしました。",
      findingMessages: sharedFindingMessages("kana"),
      truncated: "よみとり が うちきられました",
      truncationReasons: {
        "walk-entries": "エントリ かずの かぎり",
        "markdown-files": "Markdown ファイル かずの かぎり",
        "file-bytes": "1 ファイル サイズの かぎり",
        "total-bytes": "よみとり そうりょうの かぎり",
        depth: "フォルダ ふかさの かぎり",
      },
      cancelled: "てんけんは ちゅうし されました。",
      failures: "なおした ほうが よい",
      advice: "にんい",
      concepts: "ノート",
      indexes: "index",
      logs: "log",
      unreadable: "よめない",
      kindConcept: "ノート",
      kindIndex: "index",
      kindLog: "log",
      kindUnreadable: "よめない",
      severityFailure: "なおした ほうが よい",
      severityAdvice: "にんい",
      severityInfo: "さんこう",
      openDirty: "ひらく（みほぞん）",
      contextMenuReview: "ちしきフォルダ（OKF）を てんけん",
      statusStarted: "ちしきフォルダ（OKF）を てんけん しています…",
      statusDone: "ちしきフォルダ（OKF）の てんけんが おわりました。",
      statusFailed: "ちしきフォルダ（OKF）の てんけんに しっぱい しました。",
      statusNoWorkspace: "ところを ひらいてから てんけんして ください。",
      statusEmpty: "この フォルダに Markdown ファイルは ありません。",
      statusPlainMarkdown:
        "この フォルダは ふつうの げんこうフォルダとして もんだいありません。OKF として あつかう ときだけ、かくノートの せんとうに type つき YAML が ひつようです。Hazakura は いまのまま かけます。",
      statusOkfClean:
        "ちしきフォルダとして よめます。ごかん上の もんだいは みつかりませんでした。",
      statusOkfFailures:
        "ちしきフォルダとして よむには、なおした ほうが よい点が {count} けん あります。",
      statusOkfAdviceOnly:
        "ちしきフォルダとして よめます。にんいの かいぜんあんが {count} けん あります。",
      detailsHeading: "しょうさい（しよう・けんすう）",
      morePriority: "ほかに なおした ほうが よい点が {count} けん あります。",
      moreOptional: "ほかに にんいの けんが {count} けん あります。",
    };
  }

  if (lang === "ja") {
    return {
      title: "知識フォルダ（OKF）を点検",
      purposeIntro:
        "本の並べ替えではありません。選んだフォルダの Markdown が OKF v0.1 Draft として読めるかを確認します。自動では直しません。",
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
      findingsHeading: "すべての検出",
      priorityHeading: "いま直すと効くこと",
      optionalHeading: "任意の改善案",
      emptyFiles: "Markdown ファイルはありません。",
      emptyFindings: "検出はありません。",
      findingsTruncated:
        "検出結果は表示上限に達したため、残りを省略しました。",
      findingMessages: sharedFindingMessages("ja"),
      truncated: "読み取りが上限により打ち切られました",
      truncationReasons: {
        "walk-entries": "エントリ数の上限",
        "markdown-files": "Markdown ファイル数の上限",
        "file-bytes": "1 ファイルサイズの上限",
        "total-bytes": "読み取り総量の上限",
        depth: "フォルダ深さの上限",
      },
      cancelled: "点検は中止されました。",
      failures: "直した方がよい",
      advice: "任意",
      concepts: "ノート",
      indexes: "index",
      logs: "log",
      unreadable: "読めない",
      kindConcept: "ノート",
      kindIndex: "index",
      kindLog: "log",
      kindUnreadable: "読めない",
      severityFailure: "直した方がよい",
      severityAdvice: "任意",
      severityInfo: "参考",
      openDirty: "開く（未保存）",
      contextMenuReview: "知識フォルダ（OKF）を点検",
      statusStarted: "知識フォルダ（OKF）を点検しています…",
      statusDone: "知識フォルダ（OKF）の点検が終わりました。",
      statusFailed: "知識フォルダ（OKF）の点検に失敗しました。",
      statusNoWorkspace: "ワークスペースを開いてから点検してください。",
      statusEmpty: "このフォルダに Markdown ファイルはありません。",
      statusPlainMarkdown:
        "このフォルダは通常の原稿フォルダとして問題ありません。OKF として扱う場合のみ、各ノートの先頭に type 付き YAML が必要です。Hazakura は今のまま書けます。",
      statusOkfClean:
        "知識フォルダとして読めます。互換上の問題は見つかりませんでした。",
      statusOkfFailures:
        "知識フォルダとして読むには、直した方がよい点が {count} 件あります。",
      statusOkfAdviceOnly:
        "知識フォルダとして読めます。任意の改善案が {count} 件あります。",
      detailsHeading: "詳細（仕様・件数）",
      morePriority: "ほかに直した方がよい点が {count} 件あります。",
      moreOptional: "ほかに任意の項目が {count} 件あります。",
    };
  }

  return {
    title: "Review knowledge folder (OKF)",
    purposeIntro:
      "This is not chapter reordering. It only checks whether Markdown in the selected folder can be read as OKF v0.1 Draft. Nothing is changed automatically.",
    diskSnapshotNote:
      "Results reflect files on disk. An open dirty tab may differ from the scan.",
    dirtyTabNote: "This file is open in a dirty tab.",
    noWorkspace: "Open a workspace before running a knowledge-folder review.",
    scanning: "Reviewing…",
    cancelling: "Cancelling…",
    cancel: "Cancel",
    rerun: "Rerun",
    close: "Close",
    openConcept: "Open",
    filesHeading: "Files",
    findingsHeading: "All findings",
    priorityHeading: "Worth fixing first",
    optionalHeading: "Optional improvements",
    emptyFiles: "No Markdown files.",
    emptyFindings: "No findings.",
    findingsTruncated:
      "The findings display limit was reached; remaining findings were omitted.",
    findingMessages: sharedFindingMessages("en"),
    truncated: "Read was truncated by a scan budget",
    truncationReasons: {
      "walk-entries": "entry count limit",
      "markdown-files": "Markdown file count limit",
      "file-bytes": "per-file size limit",
      "total-bytes": "total bytes limit",
      depth: "directory depth limit",
    },
    cancelled: "Review was cancelled.",
    failures: "Worth fixing",
    advice: "Optional",
    concepts: "Notes",
    indexes: "Indexes",
    logs: "Logs",
    unreadable: "Unreadable",
    kindConcept: "Note",
    kindIndex: "Index",
    kindLog: "Log",
    kindUnreadable: "Unreadable",
    severityFailure: "Worth fixing",
    severityAdvice: "Optional",
    severityInfo: "Info",
    openDirty: "Open (dirty)",
    contextMenuReview: "Review knowledge folder (OKF)",
    statusStarted: "Reviewing knowledge folder (OKF)…",
    statusDone: "Knowledge-folder (OKF) review finished.",
    statusFailed: "Knowledge-folder (OKF) review failed.",
    statusNoWorkspace: "Open a workspace before reviewing a knowledge folder.",
    statusEmpty: "This folder has no Markdown files.",
    statusPlainMarkdown:
      "This looks like an ordinary manuscript folder, which is fine. Only when treating it as OKF do notes need leading YAML with a type. You can keep writing in Hazakura as usual.",
    statusOkfClean:
      "Readable as a knowledge folder. No compatibility issues were found.",
    statusOkfFailures:
      "To read this as a knowledge folder, {count} item(s) are worth fixing.",
    statusOkfAdviceOnly:
      "Readable as a knowledge folder. {count} optional improvement(s) available.",
    detailsHeading: "Details (spec and counts)",
    morePriority: "{count} more item(s) worth fixing.",
    moreOptional: "{count} more optional item(s).",
  };
}
