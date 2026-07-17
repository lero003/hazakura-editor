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
  openForEdit: string;
  /** One explicit next step when required findings exist (no auto-repair). */
  firstFixHeading: string;
  firstFixHint: string;
  filesHeading: string;
  requiredHeading: string;
  conversionHeading: string;
  improvementHeading: string;
  infoHeading: string;
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
  severityConversion: string;
  openDirty: string;
  statusOpenedForEdit: string;
  contextMenuReview: string;
  contextMenuScaffoldMinimal: string;
  contextMenuScaffoldBookLike: string;
  statusStarted: string;
  statusDone: string;
  statusFailed: string;
  statusNoWorkspace: string;
  statusEmpty: string;
  statusPlainMarkdown: string;
  statusPlainMarkdownPreparation: string;
  statusPlainMarkdownFailures: string;
  statusOkfClean: string;
  statusOkfFailures: string;
  statusOkfAdviceOnly: string;
  detailsHeading: string;
  resultsHeading: string;
  moreRequired: string;
  moreConversion: string;
  moreImprovement: string;
  moreInfo: string;
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
      if (presentation.requiredCount > 0) {
        return formatCountMessage(
          copy.statusPlainMarkdownFailures,
          presentation.requiredCount,
          language,
        );
      }
      if (presentation.conversionCount > 0) {
        return formatCountMessage(
          copy.statusPlainMarkdownPreparation,
          presentation.conversionCount,
          language,
        );
      }
      return copy.statusPlainMarkdown;
    case "okf-like":
      if (presentation.requiredCount > 0) {
        return formatCountMessage(
          copy.statusOkfFailures,
          presentation.requiredCount,
          language,
        );
      }
      if (presentation.improvementCount > 0) {
        return formatCountMessage(
          copy.statusOkfAdviceOnly,
          presentation.improvementCount,
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
      rerun: "へんこうしたら もういちど てんけん",
      close: "とぢる",
      openConcept: "ひらく",
      openForEdit: "ひらいて なおす",
      firstFixHeading: "まず ここを なおす",
      firstFixHint:
        "じどうでは なおしません。ひらいて しゅうせいし、ほぞんしてから さいてんけんしてください。",
      filesHeading: "ファイル",
      requiredHeading: "なおした ほうが よいこと",
      conversionHeading: "OKF として ととのえる じゅんび",
      improvementHeading: "にんいの かいぜんあん",
      infoHeading: "さんこうじょうほう",
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
      severityConversion: "じゅんび",
      openDirty: "ひらく（みほぞん）",
      contextMenuReview: "ちしきフォルダ（OKF）を てんけん",
      contextMenuScaffoldMinimal:
        "ちしきフォルダの ひながたを つくる（さいしょう）",
      contextMenuScaffoldBookLike:
        "ちしきフォルダの ひながたを つくる（ほんっぽい しょうだて）",
      statusStarted: "ちしきフォルダ（OKF）を てんけん しています…",
      statusDone: "ちしきフォルダ（OKF）の てんけんが おわりました。",
      statusFailed: "ちしきフォルダ（OKF）の てんけんに しっぱい しました。",
      statusOpenedForEdit:
        "ファイルを ひらきました。なおしたら もういちど「ちしきフォルダ（OKF）を てんけん」で かくにんして ください。",
      statusNoWorkspace: "ところを ひらいてから てんけんして ください。",
      statusEmpty: "この フォルダに Markdown ファイルは ありません。",
      statusPlainMarkdown:
        "この フォルダは ふつうの げんこうフォルダです。Hazakura では いまのまま かけます。",
      statusPlainMarkdownPreparation:
        "この フォルダは ふつうの げんこうフォルダです。いまのまま かけます。OKF として ととのえる ばあいは、じゅんびが {count} けん あります。",
      statusPlainMarkdownFailures:
        "この フォルダは ふつうの げんこうフォルダです。OKF の じゅんびとは べつに、かくにんした ほうが よい点が {count} けん あります。",
      statusOkfClean:
        "ちしきフォルダとして よめます。ごかん上の もんだいは みつかりませんでした。",
      statusOkfFailures:
        "ちしきフォルダとして よむには、なおした ほうが よい点が {count} けん あります。",
      statusOkfAdviceOnly:
        "ちしきフォルダとして よめます。にんいの かいぜんあんが {count} けん あります。",
      detailsHeading: "しょうさい（しよう・けんすう）",
      resultsHeading: "ファイルと さんこうじょうほう",
      moreRequired: "ほかに なおした ほうが よい点が {count} けん あります。",
      moreConversion: "ほかに OKF の じゅんびが {count} けん あります。",
      moreImprovement: "ほかに かいぜんあんが {count} けん あります。",
      moreInfo: "ほかに さんこうが {count} けん あります。",
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
      rerun: "変更後に再点検",
      close: "閉じる",
      openConcept: "開く",
      openForEdit: "開いて修正",
      firstFixHeading: "まずここを直す",
      firstFixHint:
        "自動では直しません。開いて修正し、保存してから再点検してください。",
      filesHeading: "ファイル",
      requiredHeading: "直した方がよいこと",
      conversionHeading: "OKF として整える準備",
      improvementHeading: "任意の改善案",
      infoHeading: "参考情報",
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
      severityConversion: "準備",
      openDirty: "開く（未保存）",
      contextMenuReview: "知識フォルダ（OKF）を点検",
      contextMenuScaffoldMinimal: "知識フォルダのひな形を作成（最小）",
      contextMenuScaffoldBookLike:
        "知識フォルダのひな形を作成（本っぽい章立て）",
      statusStarted: "知識フォルダ（OKF）を点検しています…",
      statusDone: "知識フォルダ（OKF）の点検が終わりました。",
      statusFailed: "知識フォルダ（OKF）の点検に失敗しました。",
      statusOpenedForEdit:
        "ファイルを開きました。修正したら、もう一度「知識フォルダ（OKF）を点検」で確認してください。",
      statusNoWorkspace: "ワークスペースを開いてから点検してください。",
      statusEmpty: "このフォルダに Markdown ファイルはありません。",
      statusPlainMarkdown:
        "このフォルダは通常の原稿フォルダです。Hazakura では今のまま書けます。",
      statusPlainMarkdownPreparation:
        "このフォルダは通常の原稿フォルダです。今のまま書けます。OKF として整える場合は、準備項目が {count} 件あります。",
      statusPlainMarkdownFailures:
        "このフォルダは通常の原稿フォルダです。OKF の準備とは別に、確認した方がよい点が {count} 件あります。",
      statusOkfClean:
        "知識フォルダとして読めます。互換上の問題は見つかりませんでした。",
      statusOkfFailures:
        "知識フォルダとして読むには、直した方がよい点が {count} 件あります。",
      statusOkfAdviceOnly:
        "知識フォルダとして読めます。任意の改善案が {count} 件あります。",
      detailsHeading: "詳細（仕様・件数）",
      resultsHeading: "ファイルと参考情報",
      moreRequired: "ほかに直した方がよい点が {count} 件あります。",
      moreConversion: "ほかに OKF の準備項目が {count} 件あります。",
      moreImprovement: "ほかに改善案が {count} 件あります。",
      moreInfo: "ほかに参考情報が {count} 件あります。",
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
    rerun: "Review changes",
    close: "Close",
    openConcept: "Open",
    openForEdit: "Open to edit",
    firstFixHeading: "Start with this fix",
    firstFixHint:
      "Nothing is auto-repaired. Open, edit, save, then run review again.",
    filesHeading: "Files",
    requiredHeading: "Needs attention",
    conversionHeading: "Prepare as OKF",
    improvementHeading: "Optional improvements",
    infoHeading: "Reference information",
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
    severityConversion: "Prep",
    openDirty: "Open (dirty)",
    contextMenuReview: "Review knowledge folder (OKF)",
    contextMenuScaffoldMinimal: "Create knowledge folder starter (minimal)",
    contextMenuScaffoldBookLike:
      "Create knowledge folder starter (book-like)",
    statusStarted: "Reviewing knowledge folder (OKF)…",
    statusDone: "Knowledge-folder (OKF) review finished.",
    statusFailed: "Knowledge-folder (OKF) review failed.",
    statusOpenedForEdit:
      "Opened the file. After editing, run “Review knowledge folder (OKF)” again to recheck.",
    statusNoWorkspace: "Open a workspace before reviewing a knowledge folder.",
    statusEmpty: "This folder has no Markdown files.",
    statusPlainMarkdown:
      "This is an ordinary manuscript folder. You can keep writing in Hazakura as usual.",
    statusPlainMarkdownPreparation:
      "This is an ordinary manuscript folder and remains writable as-is. Preparing it as OKF would require {count} item(s).",
    statusPlainMarkdownFailures:
      "This is an ordinary manuscript folder. Separate from OKF preparation, {count} item(s) are worth checking.",
    statusOkfClean:
      "Readable as a knowledge folder. No compatibility issues were found.",
    statusOkfFailures:
      "To read this as a knowledge folder, {count} item(s) are worth fixing.",
    statusOkfAdviceOnly:
      "Readable as a knowledge folder. {count} optional improvement(s) available.",
    detailsHeading: "Details (spec and counts)",
    resultsHeading: "Files and reference information",
    moreRequired: "{count} more item(s) need attention.",
    moreConversion: "{count} more OKF preparation item(s).",
    moreImprovement: "{count} more optional improvement(s).",
    moreInfo: "{count} more informational item(s).",
  };
}
