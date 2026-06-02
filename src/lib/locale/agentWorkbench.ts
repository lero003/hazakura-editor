import { isJapaneseMenuLanguage, type MenuLanguage } from "../../types";

export type AgentWorkbenchCopy = {
  title: string;
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
  boundaryItems: string[];
  consent: string;
  modeBadgeActive: string;
  modeBadgePending: string;
  modeBadgeTitle: string;
};

export function getAgentWorkbenchCopy(lang: MenuLanguage): AgentWorkbenchCopy {
  return isJapaneseMenuLanguage(lang)
    ? {
        title: "エージェントワークベンチ",
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
        title: "Agent Workbench",
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
