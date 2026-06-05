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
        surfaceSectionLabel: "外部アシストの種類",
        assistSurfaceControl: "外部アシスト",
        assistSurfaceNone: "使わない",
        assistSurfaceApple: "Apple Assist",
        assistSurfaceExternalCli: "CLI Agent",
        assistSurfaceRestartRequired:
          "アシストの種類は再起動後に切り替わります。",
        appleHeading: "Apple Assist",
        appleSectionLabel: "Apple Assist の状態と注意事項",
        appleFixtureStatus:
          "現在のビルドは fixture/mock です。実際の Apple Foundation Models はまだ呼び出しません。",
        appleLiveStatus:
          "この Mac では Apple Local Assist を利用できます。",
        appleUnavailablePrefix:
          "この Mac では Apple Local Assist をまだ利用できません: ",
        appleUnsupportedStatus:
          "この環境では Apple Local Assist はサポートされていません。",
        appleNotes: [
          "Apple Assist は文書の執筆補助であり、CLI Agent や汎用チャットではありません。",
          "本文への変更は未保存の AI edit transaction として記録し、差分で確認できます。",
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
          "エージェント画面と CLI 起動の有効状態を切り替えるには、hazakura editor の再起動が必要です。",
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
        assistSurfaceApple: "Apple Assist",
        assistSurfaceExternalCli: "CLI Agent",
        assistSurfaceRestartRequired:
          "The assist type changes after restarting hazakura editor.",
        appleHeading: "Apple Assist",
        appleSectionLabel: "Apple Assist status and notes",
        appleFixtureStatus:
          "This build is running fixture/mock mode. It does not call Apple Foundation Models yet.",
        appleLiveStatus: "Apple Local Assist is available on this Mac.",
        appleUnavailablePrefix:
          "Apple Local Assist is not available yet on this Mac: ",
        appleUnsupportedStatus:
          "Apple Local Assist is not supported in this environment.",
        appleNotes: [
          "Apple Assist is document-writing help, not a CLI agent or general chat surface.",
          "Text changes are recorded as unsaved AI edit transactions and remain reviewable through diff.",
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
          "Restart hazakura editor before Agent Workbench UI or backend launch commands change.",
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
