import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";

export type AgentWorkbenchCopy = {
  title: string;
  surfaceHeading: string;
  surfaceSectionLabel: string;
  assistSurfaceControl: string;
  assistSurfaceNone: string;
  assistSurfaceApple: string;
  assistSurfaceExternalCli: string;
  assistSurfaceRestartRequired: string;
  appleHeading: string;
  appleSectionLabel: string;
  applePreviewLabel: string;
  appleDescription: string;
  appleFixtureStatus: string;
  appleLiveStatus: string;
  appleUnavailablePrefix: string;
  appleUnsupportedStatus: string;
  appleNotes: string[];
  modeHeading: string;
  modeSectionLabel: string;
  sessionHeading: string;
  sessionSectionLabel: string;
  boundaryHeading: string;
  boundarySectionLabel: string;
  enableAfterRestart: string;
  activeSessionMode: string;
  safeSessionMode: string;
  restartRequired: string;
  restartNow: string;
  restarting: string;
  provider: string;
  session: string;
  workspace: string;
  noWorkspace: string;
  providerControl: string;
  providerNotInstalled: string;
  providerUnavailableHint: string;
  boundaryItems: string[];
  consent: string;
  modeBadgeActive: string;
  modeBadgePending: string;
  modeBadgeTitle: string;
};

export function getAgentWorkbenchCopy(lang: MenuLanguage): AgentWorkbenchCopy {
  return isJapaneseMenuLanguage(lang)
    ? {
        title: "アシスト設定",
        surfaceHeading: "アシストの種類",
        surfaceSectionLabel: "使用するアシスト",
        assistSurfaceControl: "使用するアシスト",
        assistSurfaceNone: "使わない",
        assistSurfaceApple: "Hazakura Local Assist (プレビュー)",
        assistSurfaceExternalCli: "CLI Agent",
        assistSurfaceRestartRequired:
          "アシストの種類は再起動後に切り替わります。",
        appleHeading: "Hazakura Local Assist",
        appleSectionLabel: "Hazakura Local Assist について",
        applePreviewLabel: "プレビュー",
        appleDescription:
          "Apple Intelligence 対応の Mac で使える、プレビュー版のローカル AI 文章支援です。利用には目安として macOS 26 以降、M1 以降の Mac、Apple Intelligence の有効化、対応言語 / 地域が必要です。詳しい条件は Apple 公式の Apple Intelligence 案内を確認してください。",
        appleFixtureStatus:
          "Hazakura Local Assist は現在利用できません。",
        appleLiveStatus:
          "この Mac では Hazakura Local Assist を利用できます。",
        appleUnavailablePrefix:
          "この Mac では Hazakura Local Assist をまだ使えません: ",
        appleUnsupportedStatus:
          "この環境では Hazakura Local Assist は使えません。",
        appleNotes: [
          "校正、要約、翻訳、短縮などの軽い文章整理を支援します。",
          "外部 AI サービスには情報を送りません。コードレビューや複数ファイルの解析、長文全体の大きな再構成には向きません。",
          "編集案は未保存の変更として扱い、保存前に差分で確認できます。",
          "プレビュー機能のため、出力品質は安定しないことがあります。",
          "Apple Intelligence の対応状況は macOS、Mac のモデル、言語、地域によって変わることがあります。",
          "自動保存、背景での書き換え、ワークスペース全体の解析は行いません。",
        ],
        modeHeading: "モード",
        modeSectionLabel: "エージェントモード",
        sessionHeading: "セッション",
        sessionSectionLabel: "エージェントセッション",
        boundaryHeading: "責任境界",
        boundarySectionLabel: "エージェントの責任境界",
        enableAfterRestart: "再起動後にエージェントワークベンチを有効化",
        activeSessionMode:
          "このアプリセッションではエージェントワークベンチが有効です。",
        safeSessionMode:
          "このアプリセッションでは Safe Editor モードが有効です。",
        restartRequired:
          "エージェント画面と CLI 起動の有効状態を切り替えるには、Hazakura Editor の再起動が必要です。",
        restartNow: "今すぐ再起動",
        restarting: "再起動中...",
        provider: "プロバイダー",
        session: "セッション",
        workspace: "ワークスペース",
        noWorkspace: "ワークスペース未選択",
        providerControl: "エージェントワークベンチのプロバイダー",
        providerNotInstalled: "（未インストール）",
        providerUnavailableHint:
          "選択中のプロバイダーはアプリの検索パスに見つかりません。インストール済みの CLI を選ぶか、未インストールのものは選択解除してください。",
        boundaryItems: [
          "hazakura は汎用 shell prompt を提供しません。",
          "hazakura が直接起動できるのは許可リスト済みの agent CLI だけです。",
          "起動した CLI の挙動は CLI 側仕様とユーザー操作に依存します。",
          "エージェントワークベンチは信頼できる workspace でだけ使ってください。",
          "CLI が作った変更を採用するかはユーザーが判断します。",
        ],
        consent: "エージェントワークベンチの責任境界を理解しました。",
        modeBadgeActive: "エージェントモード",
        modeBadgePending: "エージェントモード: 再起動待ち",
        modeBadgeTitle:
          "エージェントワークベンチは Safe Editor モードとは別の trust boundary です。",
      }
    : {
        title: "Assist Surface",
        surfaceHeading: "Assist type",
        surfaceSectionLabel: "External assist type",
        assistSurfaceControl: "External assist",
        assistSurfaceNone: "Off",
        assistSurfaceApple: "Hazakura Local Assist (Preview)",
        assistSurfaceExternalCli: "CLI Agent",
        assistSurfaceRestartRequired:
          "The assist type changes after restarting Hazakura Editor.",
        appleHeading: "Hazakura Local Assist",
        appleSectionLabel: "Hazakura Local Assist status and notes",
        applePreviewLabel: "Preview",
        appleDescription:
          "Preview local AI writing assistance for Macs that can use Apple Intelligence. As a guide, it needs macOS 26 or later, an Apple silicon Mac with M1 or later, Apple Intelligence turned on, and a supported language and region. Check Apple's Apple Intelligence support information for current requirements.",
        appleFixtureStatus:
          "Hazakura Local Assist is not currently available.",
        appleLiveStatus:
          "Hazakura Local Assist is available on this Mac as a preview feature.",
        appleUnavailablePrefix:
          "Hazakura Local Assist is not available yet on this Mac: ",
        appleUnsupportedStatus:
          "Hazakura Local Assist is not supported in this environment.",
        appleNotes: [
          "Hazakura Local Assist helps with lightweight text cleanup such as proofreading, summarizing, translating, and shortening.",
          "It does not send information to external AI services, and it is not suited for code review, multi-file analysis, or large document restructuring.",
          "Draft edits are kept unsaved and remain reviewable through diff before you save.",
          "Because this is a preview feature, output quality may vary.",
          "Apple Intelligence availability may vary by macOS version, Mac model, language, and region.",
          "No auto-save, background rewriting, or broad workspace analysis is performed.",
        ],
        modeHeading: "Mode",
        modeSectionLabel: "Agent mode",
        sessionHeading: "Session",
        sessionSectionLabel: "Agent session",
        boundaryHeading: "Boundary",
        boundarySectionLabel: "Agent responsibility boundary",
        enableAfterRestart: "Enable Agent Workbench after restart",
        activeSessionMode:
          "Agent Workbench mode is active for this app session.",
        safeSessionMode: "Safe Editor Mode is active for this app session.",
        restartRequired:
          "Restart Hazakura Editor before Agent Workbench UI or backend launch commands change.",
        restartNow: "Restart now",
        restarting: "Restarting...",
        provider: "Provider",
        session: "Session",
        workspace: "Workspace",
        noWorkspace: "No workspace selected",
        providerControl: "Agent Workbench provider",
        providerNotInstalled: "(not installed)",
        providerUnavailableHint:
          "The selected provider is not installed in the app search path. Pick an installed CLI, or remove the unselected ones before starting a session.",
        boundaryItems: [
          "hazakura does not provide a general-purpose shell prompt.",
          "hazakura can directly launch only allowlisted agent CLIs.",
          "The launched CLI behavior depends on the CLI and your actions inside it.",
          "Use Agent Workbench only in trusted workspaces.",
          "You review and decide what to do with CLI-made changes.",
        ],
        consent: "I understand the Agent Workbench responsibility boundary.",
        modeBadgeActive: "Agent Mode",
        modeBadgePending: "Agent Mode: restart pending",
        modeBadgeTitle:
          "Agent Workbench is a separate trust boundary from Safe Editor Mode.",
      };
}
