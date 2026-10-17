import {
  getLocalAssistAction,
  LOCAL_ASSIST_VISIBLE_PRESET_IDS,
  type LocalAssistPreset,
} from "../appleAssist/instruction";
import type { AppleAssistTargetKind, MenuLanguage } from "../../types";

/**
 * Copy table for the detached Hazakura Local Assist window.
 *
 * Moved out of `AppleAssistWindowApp.tsx` so the window component owns
 * behaviour only. The component re-exports every member below, so existing
 * imports (including the copy-contract test) keep working unchanged.
 */

export type OperationFeedbackKind =
  | "ready"
  | "target-acquired"
  | "request-sent"
  | "generation-started"
  | "proposal-ready"
  | "applied"
  | "cancelled"
  | "failed"
  | "unavailable";

// Payload fields for the operation-feedback panel. Only
// non-sensitive, non-document fields are allowed. The
// component does not pass `target.text`, `target.label`,
// or `activeDocumentName` through this payload because
// those are broad document excerpts or section labels and
// would leak authoring content into the feedback trail.
export type OperationFeedbackPayload = {
  targetKind?: AppleAssistTargetKind;
  targetChars?: number;
};

export type AppleAssistWindowCopy = {
  activeDocument: (name: string) => string;
  appliedStatus: (request: string) => string;
  applyButton: string;
  availableDisclosure: string;
  cancelButton: string;
  cancelledStatus: string;
  cancellingStatus: string;
  contextTooLongError: string;
  modelContextTooLongError: string;
  disabledStatus: string;
  emptyRequestError: string;
  generatingButton: string;
  generatingChange: string;
  generatingInMain: (request: string) => string;
  failedStatus: string;
  guardrailError: string;
  localRuntimeUnavailable: (reason: string) => string;
  coreAIModelUnavailable: string;
  externalFolderUnavailable: string;
  localCoreAITestUnavailable: (reason: string) => string;
  longRunningStatus: string;
  modeLabel: string;
  noActiveDocument: string;
  noTarget: string;
  placeholder: string;
  presets: LocalAssistPreset[];
  presetsLabel: string;
  readyStatus: string;
  roughRequestLabel: string;
  selectionTooLongError: string;
  proposalTooLongError: string;
  proposalFormatError: string;
  modelUnavailableError: string;
  modelLanguageError: string;
  generationTimeoutError: string;
  sendingRequest: string;
  subtitle: string;
  targetReadFailed: string;
  targetStaleError: string;
  tauriUnavailableError: string;
  targetBlock: (chars: number) => string;
  targetDocument: (chars: number) => string;
  targetLabel: (label: string) => string;
  targetParagraph: (chars: number) => string;
  targetSection: (chars: number) => string;
  targetSelection: (chars: number) => string;
  throttledError: string;
  unknownError: (raw: string) => string;
  unsupportedStatus: string;
  workingLocally: string;
  streamPreviewHeading: string;
  streamPreviewIdle: string;
  streamPreviewWaiting: string;
  proposalHeading: string;
  proposalReviewDescription: string;
  proposalReviewPlaceholder: string;
  proposalStreamingStatus: string;
  proposalOriginalLabel: string;
  proposalCandidateLabel: string;
  proposalApplyButton: string;
  proposalApplyingStatus: string;
  proposalDiscardButton: string;
  proposalDiscardedStatus: string;
  proposalReadyStatus: string;
  proposalChangeSummary: (additions: number, removals: number) => string;
  conversationHeading: string;
  conversationPinned: string;
  newConversationButton: string;
  newConversationStatus: string;
  // v0.17 operation-feedback panel. The panel shows app-
  // known lifecycle events (target acquired, request sent,
  // generation started, applied, cancelled, failed, unavailable). It
  // intentionally never receives raw Foundation Models
  // prompts, raw model responses, hidden instructions,
  // provider transcripts, model reasoning, broad document
  // excerpts, filesystem paths, or secrets — see
  // docs/archive/operations/app-store-v0.17/apple-local-assist-operation-feedback-request.md.
  feedbackHeading: string;
  feedbackEmpty: string;
  checkingAvailabilityStatus: string;
  cancelledFeedback: string;
  feedbackEntry: (
    kind: OperationFeedbackKind,
    payload?: OperationFeedbackPayload,
  ) => string;
};

function buildLocalAssistPresets(lang: MenuLanguage): LocalAssistPreset[] {
  return LOCAL_ASSIST_VISIBLE_PRESET_IDS.map((actionId) => {
    const action = getLocalAssistAction(actionId);
    return {
      actionId: action.id,
      label: action.label[lang],
      requestText: action.requestText,
    };
  });
}

export function getAppleAssistWindowCopy(lang: MenuLanguage): AppleAssistWindowCopy {
  if (lang === "kana") {
    const cancelledFeedback =
      "いらいを とりけしました。ふみは かわっていません。";
    return {
      activeDocument: (name) => `いまのふみ: ${name}`,
      appliedStatus: () =>
        "へんしゅう あんを はんえいしました。ほぞん まえに さぶんで かくにん できます。",
      applyButton: "おねがいする",
      cancelButton: "つくるのを とめる",
      cancelledStatus: "つくるのを とめました。",
      cancellingStatus: "とめて います…",
      availableDisclosure:
        "ぷれびゅーばんのため、ないようを たしかめてください。このMacで しょりし、そとの AI さーびすには おくりません。さぶんを みて はんえいするまで ふみは かわらず、じどう ほぞんも しません。",
      modelContextTooLongError: "モデルが いちどに あつかえる りょうを こえました。たいしょうを みじかくするか、つづけて たのんでいたら あたらしい かいわから たのんでください。ふみは かわっていません。",
      contextTooLongError:
        "しゅうへん ぶんしょ が ながすぎ ます。L Mode の たいしょう しゅうへん こんできすと の じょうげん (8000 もじ) を こえました。",
      disabledStatus:
        "Apple Intelligence の もでるは つかえません。もでるの かんりで つかえる Core AI もでるを えらぶか、Apple Intelligence を ゆうこうに してください。",
      emptyRequestError:
        "まずは おねがいの ないようを かいてください。",
      generatingButton: "おねがい中...",
      generatingChange:
        "あんを つくっています。ふみは まだ かわりません。",
      generatingInMain: () =>
        "あんを つくっています。ふみは まだ かわりません。",
      failedStatus:
        "おねがいに しっぱいしました。下の めっせーじを みてください。",
      guardrailError:
        "えらんだ もでるが この おねがいを うけつけませんでした。べつの おねがいで さいしこう してください。",
      localRuntimeUnavailable: (reason) =>
        `Apple Intelligence の もでるを つかえません: ${reason}。もでるの かんりで つかえる Core AI もでるを えらぶことも できます。`,
      coreAIModelUnavailable: "えらんだ もでるを つかえません。もでるの かんりで ようすを たしかめ、ひつようなら べつの もでるを えらんで ください。",
      externalFolderUnavailable: "とうろくした もでるの ふぉるだを つかえません。もでるの かんりで たしかめ、よめない ときは ふぉるだを えらびなほして ください。",
      localCoreAITestUnavailable: (reason) =>
        `Core AI どうさ かくにん もでるを つかえません: ${reason}。macOS 27、Apple Silicon、こてい てすと りそーす、もでるの よみこみを かくにん してください。`,
      longRunningStatus:
        "はつかいや ながい ぶんでは すこし じかんが かかることがあります。",
      modeLabel: "ぷれびゅー",
      noActiveDocument:
        "めいん えでぃた に ひらいている ふみが ありません。Markdown / テキスト ふぁいる を ひらいて ください。",
      noTarget:
        "たいしょう が まだ えらばれて いません。えでぃた に かーそる を おくか、L Mode を ひらいて たいしょう を せってい して ください。",
      placeholder:
        "ここに おねがいの ないようを かいてください",
      presets: buildLocalAssistPresets("kana"),
      presetsLabel: "よくつかう おねがい",
      readyStatus:
        "じゅんび できました。よくつかう おねがいを えらぶか、おねがいの ないようを かいてください。",
      roughRequestLabel: "おねがいの ないよう",
      modelUnavailableError: "えらんだ もでるを いま つかえません。もでるの かんりで じょうたいを かくにん してください。ふみは かわっていません。",
      proposalFormatError: "あんの かたちを かくにんできませんでした。ふみは かわっていません。もういちど たのんでください。",
      modelLanguageError: "えらんだ もでるが いまの げんごに たいおうしていません。もでるか げんごを かくにん してください。",
      generationTimeoutError: "じかんないに あんを つくれませんでした。たいしょうを ちいさくするか、あとで もういちど たのんでください。",
      proposalTooLongError:
        "できた あんが、つづけて たのめる じょうげん（4000 もじ）を こえたため、うけとれませんでした。まえの あんが あれば のこしています。みじかい あんを たのむか、たいしょうを ちいさく えらびなおしてください。",
      selectionTooLongError:
        "えらんだ ところが ながすぎ ます（さいだい 4000 もじ）。あっぷる ふぁうんでーしょん もでるず の こんできすと まど に おさまらないため、もう すこし ちいさく えらんで ください。",
      sendingRequest: "おねがいを うけつけました...",
      subtitle: "この Mac で うごく ろーかる AI ぶんしょう しえん",
      targetStaleError:
        "たいしょう が ふるく なって います。あっぷる あしす と うぃんどう を ひらきなおすか、めいん えでぃた で たいしょう を えらびなおして ください。",
      targetReadFailed:
        "たいしょう の よみこみ に しっぱい しました。めいん えでぃた で えらびなおしてから、もう いちど おねがいして ください。",
      tauriUnavailableError:
        "はざくら ろーかる あしす と うぃんどう が あぷりと せつぞく できません。.app から Hazakura Editor を ひらきなおして ください。",
      targetBlock: (chars) => `こーど ぶろっく (${chars} もじ)`,
      targetDocument: (chars) => `ふみ ぜんたい (${chars} もじ)`,
      targetLabel: (label) => `${label}`,
      targetParagraph: (chars) => `だんらく (${chars} もじ)`,
      targetSection: (chars) => `しょう (${chars} もじ)`,
      targetSelection: (chars) => `えらんだ ところ (${chars} もじ)`,
      throttledError:
        "えらんだ もでるが こんでいます。すこし まって から さいしこう してください。",
      // 内部エラーの全文は出さない（利用者には短い一般の案内だけ）。
      unknownError: (_raw) =>
        "つくるのに しっぱい しました。たいしょうを かくにんするか、もういちど おねがい してください。",
      unsupportedStatus:
        "この Mac では えらんだ もでるを つかえません。もでるの かんりで つかえる もでるを かくにん してください。",
      checkingAvailabilityStatus:
        "この Mac で はざくら ろーかる あしす と が つかえるか かくにん しています...",
      workingLocally: "この Mac で しょり ちゅう (そとの AI さーびすには おくりません)",
      streamPreviewHeading: "つくっている あん",
      streamPreviewIdle:
        "おねがいすると、AI が つくっている とちゅうの ぶんが ここに でます。あんは みはんえいの まま さぶんで かくにん できます。ふみは まだ かわりません。",
      streamPreviewWaiting:
        "つくりはじめています。ぶんが とどくと ここに でます。",
      proposalHeading: "さぶん かくにん",
      proposalReviewDescription:
        "つくられた あんを もとの ぶんと くらべます。ふみは まだ かわりません。",
      proposalReviewPlaceholder:
        "おねがいすると、もとの ぶんと つくられた あんの さぶんが ここに でます。",
      proposalStreamingStatus: "あんを つくっています。とちゅうの ぶんしょうを ひょうじ しています。",
      proposalOriginalLabel: "もとの ぶん",
      proposalCandidateLabel: "つくられた あん",
      proposalApplyButton: "ふみに はんえい",
      proposalApplyingStatus: "ふみに はんえい しています...",
      proposalDiscardButton: "あんを すてる",
      proposalDiscardedStatus: "へんしゅう あんを すてました。ふみは かわっていません。",
      proposalReadyStatus: "へんしゅう あんを さぶん かくにんに おきました。",
      proposalChangeSummary: (additions, removals) =>
        `ついか ${additions} / けずる ${removals}`,
      conversationHeading: "この おねがいの ながれ",
      conversationPinned:
        "たいしょうを こていしています。ふみは まだ かわっていません。",
      newConversationButton: "あたらしい おねがい",
      newConversationStatus: "あたらしい おねがいを はじめました。たいしょうを えらびなおせます。",
      // v0.17 operation-feedback panel copy.
      feedbackHeading: "しんこうじょうきょう",
      feedbackEmpty:
        "まだ おねがいは ありません。たいしょうを えらび、おねがいの ないようを かいてください。",
      cancelledFeedback,
      feedbackEntry: (kind, payload) => {
        if (kind === "ready") {
          return "じゅんび できました。";
        }
        if (kind === "target-acquired") {
          const tk = payload?.targetKind;
          const chars = payload?.targetChars ?? 0;
          if (tk === "selection") {
            return `今回のたいしょう: えらんだ ところ、およそ ${chars} もじ`;
          }
          if (tk === "paragraph") {
            return `今回のたいしょう: だんらく、およそ ${chars} もじ`;
          }
          if (tk === "block") {
            return `今回のたいしょう: こーど ぶろっく、およそ ${chars} もじ`;
          }
          if (tk === "section") {
            return `今回のたいしょう: しょう、およそ ${chars} もじ`;
          }
          if (tk === "document") {
            return `今回のたいしょう: ふみ ぜんたい、およそ ${chars} もじ`;
          }
          return "今回のたいしょうを きめました。";
        }
        if (kind === "request-sent") {
          return "おねがいを うけつけました。";
        }
        if (kind === "generation-started") {
          return "この Mac で へんしゅう あんを つくっています。";
        }
        if (kind === "proposal-ready") {
          return "へんしゅう あんを さぶん かくにんに おきました。ふみは まだ かわっていません。";
        }
        if (kind === "applied") {
          return "へんしゅう あんを はんえいしました。ほぞん まえに かくにん できます。";
        }
        if (kind === "cancelled") {
          return cancelledFeedback;
        }
        if (kind === "failed") {
          return "うまく いきませんでした。下の すてーたす を みてください。";
        }
        return "はざくら ろーかる あしす とは この はんきょうで つかえません。";
      },
    };
  }

  if (lang === "ja") {
    const cancelledFeedback = "依頼を取り消しました。本文は変更していません。";
    return {
      activeDocument: (name) => `対象: ${name}`,
      appliedStatus: () =>
        "編集案を反映しました。保存前に差分で確認できます。",
      applyButton: "依頼する",
      cancelButton: "生成を停止",
      cancelledStatus: "生成を停止しました。",
      cancellingStatus: "停止処理中…",
      availableDisclosure:
        "プレビュー版のため、出力内容は確認してください。このMac内で処理し、外部 AI サービスへは送信しません。差分を確認して反映するまで本文は変わらず、自動保存もしません。",
      modelContextTooLongError: "モデルが一度に扱える量を超えました。対象を短くするか、追加指示が続いている場合は新しい会話から依頼してください。本文は変更していません。",
      contextTooLongError:
        "周辺の文書が長すぎます。L Mode の対象周辺コンテキスト上限（8000 文字）を超えました。",
      disabledStatus:
        "Apple Intelligenceモデルは利用できません。モデル管理で利用可能なCore AIモデルを選ぶか、Apple Intelligenceを有効にしてください。",
      emptyRequestError:
        "まずは依頼内容を入力してください。",
      generatingButton: "依頼中...",
      generatingChange:
        "編集案を作っています。本文は未変更です。",
      generatingInMain: () =>
        "編集案を作っています。本文は未変更です。",
      failedStatus:
        "依頼に失敗しました。下のメッセージを確認してください。",
      guardrailError:
        "選択中のモデルがこの依頼を受け付けませんでした。別の依頼内容で再試行してください。",
      localRuntimeUnavailable: (reason) =>
        `Apple Intelligenceモデルを利用できません: ${reason}。モデル管理で利用可能なCore AIモデルを選ぶこともできます。`,
      coreAIModelUnavailable: "選択中のモデルを使えません。モデル管理で状態を確認し、必要なら別のモデルに切り替えてください。",
      externalFolderUnavailable: "登録したモデルフォルダを使えません。モデル管理で状態を確認し、アクセス権が切れていたらフォルダを選び直してください。",
      localCoreAITestUnavailable: (reason) =>
        `Core AI 動作確認モデルを利用できません: ${reason}。macOS 27、Apple Silicon、固定テストリソース、モデルの読み込み状態を確認してください。`,
      longRunningStatus:
        "初回や長文では少し時間がかかることがあります。",
      modeLabel: "プレビュー",
      noActiveDocument:
        "メインエディタに開いている文書がありません。Markdown / テキストファイルを開いてください。",
      noTarget:
        "対象がまだ選ばれていません。エディタにカーソルを置くか、L Mode を開いて対象を設定してください。",
      placeholder:
        "ここに依頼内容を入力してください",
      presets: buildLocalAssistPresets("ja"),
      presetsLabel: "よく使う依頼",
      readyStatus:
        "準備できました。よく使う依頼を選ぶか、依頼内容を入力してください。",
      roughRequestLabel: "依頼内容",
      modelUnavailableError: "選択中のモデルを現在利用できません。モデル管理で状態を確認してください。本文は変更されていません。",
      proposalFormatError: "案の形式を確認できませんでした。本文は変更していません。もう一度依頼してください。",
      modelLanguageError: "選択中のモデルが現在の言語に対応していません。モデルまたは言語を確認してください。",
      generationTimeoutError: "制限時間内に生成を完了できませんでした。対象範囲を小さくするか、時間を置いて再依頼してください。",
      proposalTooLongError:
        "生成された案が追加指示の上限（4000文字）を超えたため、受け付けませんでした。前の完成案があれば保持しています。短い案を依頼するか、対象範囲を小さく選び直してください。",
      selectionTooLongError:
        "選択範囲が大きすぎます（最大 4000 文字）。Apple Foundation Models のコンテキスト窓に収まらないため、もう少し小さく選択してください。",
      sendingRequest: "依頼を受け付けました...",
      subtitle: "この Mac で動くローカル AI 文章支援",
      targetStaleError:
        "対象が古くなっています。Hazakura Local Assist ウィンドウを開き直すか、メインエディタで対象を選び直してください。",
      targetReadFailed:
        "対象の読み込みに失敗しました。メインエディタで選び直してから、もう一度依頼してください。",
      tauriUnavailableError:
        "Hazakura Local Assist ウィンドウがアプリと接続できません。.app から Hazakura Editor を開き直してください。",
      targetBlock: (chars) => `コードブロック (${chars} 文字)`,
      targetDocument: (chars) => `文書全体 (${chars} 文字)`,
      targetLabel: (label) => `${label}`,
      targetParagraph: (chars) => `段落 (${chars} 文字)`,
      targetSection: (chars) => `章 (${chars} 文字)`,
      targetSelection: (chars) => `選択範囲 (${chars} 文字)`,
      throttledError:
        "選択中のモデルが混み合っています。少し待ってから再試行してください。",
      // 内部エラーの全文は出さない（利用者には短い一般の案内だけ）。
      unknownError: (_raw) =>
        "Hazakura Local Assist の生成に失敗しました。対象を確認するか、もう一度依頼してください。",
      unsupportedStatus:
        "このMacでは選択中のモデルを利用できません。モデル管理で利用可能なモデルを確認してください。",
      checkingAvailabilityStatus:
        "このMacでHazakura Local Assistを利用できるか確認しています…",
      workingLocally: "この Mac 上で処理中（外部 AI サービスには送りません）",
      streamPreviewHeading: "作成中の案",
      streamPreviewIdle:
        "依頼すると、AI が作っている途中の文章がここに出ます。案は未反映のまま差分で確認できます。本文はまだ変更しません。",
      streamPreviewWaiting:
        "作り始めています。文章が届くとここに出ます。",
      proposalHeading: "差分レビュー",
      proposalReviewDescription:
        "生成した案を元の文章と比較します。本文はまだ変更しません。",
      proposalReviewPlaceholder:
        "依頼すると、元の文章と生成した案の差分がここに表示されます。",
      proposalStreamingStatus: "案を生成しています。途中の文章を表示しています。",
      proposalOriginalLabel: "元の文章",
      proposalCandidateLabel: "生成した案",
      proposalApplyButton: "文書へ反映",
      proposalApplyingStatus: "文書へ反映しています…",
      proposalDiscardButton: "案を破棄",
      proposalDiscardedStatus: "編集案を破棄しました。本文は変更していません。",
      proposalReadyStatus: "編集案を差分レビューに表示しました。本文はまだ変更していません。",
      proposalChangeSummary: (additions, removals) =>
        `追加 ${additions} / 削除 ${removals}`,
      conversationHeading: "この会話の依頼",
      conversationPinned:
        "対象を固定しています。本文はまだ変更していません。",
      newConversationButton: "新しい会話",
      newConversationStatus: "新しい会話を開始しました。対象を選び直せます。",
      // v0.17 operation-feedback panel copy.
      feedbackHeading: "進行状況",
      feedbackEmpty:
        "まだ依頼はありません。対象を選び、依頼内容を入力してください。",
      cancelledFeedback,
      feedbackEntry: (kind, payload) => {
        if (kind === "ready") {
          return "準備できました。";
        }
        if (kind === "target-acquired") {
          const tk = payload?.targetKind;
          const chars = payload?.targetChars ?? 0;
          if (tk === "selection") {
            return `今回の対象: 選択範囲、およそ ${chars} 文字`;
          }
          if (tk === "paragraph") {
            return `今回の対象: 段落、およそ ${chars} 文字`;
          }
          if (tk === "block") {
            return `今回の対象: コードブロック、およそ ${chars} 文字`;
          }
          if (tk === "section") {
            return `今回の対象: 章、およそ ${chars} 文字`;
          }
          if (tk === "document") {
            return `今回の対象: 文書全体、およそ ${chars} 文字`;
          }
          return "今回の対象を決めました。";
        }
        if (kind === "request-sent") {
          return "依頼を受け付けました。";
        }
        if (kind === "generation-started") {
          return "この Mac 上で編集案を作っています。";
        }
        if (kind === "proposal-ready") {
          return "編集案を差分レビューに表示しました。本文はまだ変更していません。";
        }
        if (kind === "applied") {
          return "編集案を反映しました。保存前に確認できます。";
        }
        if (kind === "cancelled") {
          return cancelledFeedback;
        }
        if (kind === "failed") {
          return "うまくいきませんでした。下のステータスを確認してください。";
        }
        return "Hazakura Local Assist はこの環境では使えません。";
      },
    };
  }

  const cancelledFeedback = "Request cancelled. The document was not changed.";
  return {
    activeDocument: (name) => `Active: ${name}`,
    appliedStatus: () =>
      "Draft edit applied. Review the diff before saving.",
    applyButton: "Send request",
    cancelButton: "Stop generating",
    cancelledStatus: "Generation stopped.",
    cancellingStatus: "Stopping…",
    availableDisclosure:
      "Preview results need your review. Processing stays on this Mac; nothing is sent to an external AI service. Your document changes only when you apply the Diff, and is never saved automatically.",
    modelContextTooLongError: "The model cannot handle this much input at once. Select a shorter target, or start a new conversation after repeated follow-ups. Your document is unchanged.",
    contextTooLongError:
      "Document context is too long (L Mode harness caps surrounding text at 8000 characters). Pick a tighter target or break the change into smaller requests.",
    disabledStatus:
      "The Apple Intelligence model is unavailable. Select an available Core AI model in model management or turn on Apple Intelligence.",
    emptyRequestError:
      "Type a request first.",
    generatingButton: "Sending...",
    generatingChange:
      "Creating a proposal. Your document is unchanged.",
    generatingInMain: () =>
      "Creating a proposal. Your document is unchanged.",
    failedStatus:
      "Request failed. Check the message below.",
    guardrailError:
      "The selected model refused this request. Try a different request.",
    localRuntimeUnavailable: (reason) =>
      `The Apple Intelligence model is unavailable: ${reason}. You can also select an available Core AI model in model management.`,
    coreAIModelUnavailable: "The selected model is unavailable. Check its status in model management or switch to another model.",
    externalFolderUnavailable: "The registered model folder is unavailable. Check it in model management and select the folder again if access has expired.",
    localCoreAITestUnavailable: (reason) =>
      `The Core AI test model is unavailable: ${reason}. Check macOS 27, Apple Silicon, the fixed test resource, and model loading.`,
    longRunningStatus:
      "First runs or longer passages can take a little while.",
    modeLabel: "Preview",
    noActiveDocument:
      "No active document is open in the main editor. Open a Markdown or text file first.",
    noTarget:
      "No active target yet. Place the cursor inside the document, or open L Mode to get a target.",
    placeholder: "Type the request you want to send",
    presets: buildLocalAssistPresets("en"),
    presetsLabel: "Presets",
    readyStatus:
      "Ready. Pick a preset or type a request.",
    roughRequestLabel: "Request",
    modelUnavailableError: "The selected model is currently unavailable. Check its status in model management. Your document is unchanged.",
    proposalFormatError: "The proposal format could not be verified. The document is unchanged. Please try again.",
    modelLanguageError: "The selected model does not support the current language. Check the model or language settings.",
    generationTimeoutError: "Generation did not finish in time. Select a smaller target or try again later.",
    proposalTooLongError:
      "The generated draft exceeds the 4000-character follow-up limit and was not accepted. Any previous completed draft is kept. Ask for a shorter draft or select a smaller target.",
    selectionTooLongError:
      "Selection is too long (max 4000 characters). Apple Foundation Models has a bounded context window; pick a smaller selection, or split the change into multiple requests.",
    sendingRequest: "Request accepted...",
    subtitle: "Lightweight on-device writing help",
    targetStaleError:
      "The active target has changed since the request was prepared. Re-open the Hazakura Local Assist window, or pick a new target in the main editor.",
    targetReadFailed:
      "Could not read the target. Pick the text again in the main editor, then send the request again.",
    tauriUnavailableError:
      "Hazakura Local Assist cannot connect to the main editor. Reopen Hazakura Editor from the .app bundle and try again.",
    targetBlock: (chars) => `Code block (${chars} chars)`,
    targetDocument: (chars) => `Whole document (${chars} chars)`,
    targetLabel: (label) => `${label}`,
    targetParagraph: (chars) => `Paragraph (${chars} chars)`,
    targetSection: (chars) => `Section (${chars} chars)`,
    targetSelection: (chars) => `Selection (${chars} chars)`,
    throttledError:
      "The selected model is busy. Try again shortly.",
    // 内部エラーの全文は出さない（利用者には短い一般の案内だけ）。
    unknownError: (_raw) =>
      "Hazakura Local Assist could not generate a proposal. Check the target or try again.",
    unsupportedStatus:
      "The selected model cannot be used on this Mac. Check available models in model management.",
    checkingAvailabilityStatus:
      "Checking whether Hazakura Local Assist is available on this Mac...",
    workingLocally: "Working locally on this Mac (no third-party AI service)",
    streamPreviewHeading: "Draft in progress",
    streamPreviewIdle:
      "When you send a request, the text being written will appear here. The proposal stays unapplied in Diff review; the document is unchanged.",
    streamPreviewWaiting:
      "Starting the draft. Text will appear here as it arrives.",
    proposalHeading: "Diff review",
    proposalReviewDescription:
      "Compare the generated proposal with the original. The document is unchanged.",
    proposalReviewPlaceholder:
      "Send a request to show the original and the generated proposal here.",
    proposalStreamingStatus: "Generating a proposal. Showing the in-progress draft.",
    proposalOriginalLabel: "Original",
    proposalCandidateLabel: "Proposal",
    proposalApplyButton: "Apply proposal",
    proposalApplyingStatus: "Applying proposal...",
    proposalDiscardButton: "Discard proposal",
    proposalDiscardedStatus: "Discarded the proposal. The document is unchanged.",
    proposalReadyStatus: "Proposal ready in Diff review. The document is unchanged.",
    proposalChangeSummary: (additions, removals) =>
      `${additions} added / ${removals} removed`,
    conversationHeading: "Requests in this conversation",
    conversationPinned:
      "Target pinned. The document is still unchanged.",
    newConversationButton: "New conversation",
    newConversationStatus: "Started a new conversation. You can choose a new target.",
    // v0.17 operation-feedback panel copy.
    feedbackHeading: "Progress",
    feedbackEmpty:
      "No requests yet. Pick a target and describe what you want changed.",
    cancelledFeedback,
    feedbackEntry: (kind, payload) => {
      if (kind === "ready") {
        return "Ready.";
      }
      if (kind === "target-acquired") {
        const tk = payload?.targetKind;
        const chars = payload?.targetChars ?? 0;
        if (tk === "selection") {
          return `This request targets: selection, about ${chars} characters`;
        }
        if (tk === "paragraph") {
          return `This request targets: paragraph, about ${chars} characters`;
        }
        if (tk === "block") {
          return `This request targets: code block, about ${chars} characters`;
        }
        if (tk === "section") {
          return `This request targets: section, about ${chars} characters`;
        }
        if (tk === "document") {
          return `This request targets: whole document, about ${chars} characters`;
        }
        return "Target selected for this request.";
      }
      if (kind === "request-sent") {
        return "Request accepted.";
      }
      if (kind === "generation-started") {
        return "Creating a draft edit on this Mac.";
      }
      if (kind === "proposal-ready") {
        return "Proposal ready in Diff review. The document is unchanged.";
      }
      if (kind === "applied") {
        return "Draft edit applied. Review before saving.";
      }
      if (kind === "cancelled") {
        return cancelledFeedback;
      }
      if (kind === "failed") {
        return "That did not work. Check the status below.";
      }
      return "Hazakura Local Assist is unavailable in this environment.";
    },
  };
}
