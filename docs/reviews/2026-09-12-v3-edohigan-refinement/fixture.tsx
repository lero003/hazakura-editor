// 実アプリ（`App` = AppShell + useAppShellController）を、**ネイティブ境界だけ**差し替えて描く。
// UIは1行も作り直さないので、実機と同じ DOM・同じ CSS を測れる。
// 専用QA originで実行。?view=editor|lmode で自作原稿を読み込む。
import React from "react";
import sample from "./sample.md?raw";
import { DRAFT_STATE_STORAGE_KEY, WORKSPACE_STATE_STORAGE_KEY, THEME_STORAGE_KEY, MENU_LANGUAGE_STORAGE_KEY, EDITOR_SETTINGS_STORAGE_KEY } from "../../../src/types";
import { createRoot } from "react-dom/client";
import App from "../../../src/App";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);

// This fixture owns only the isolated QA origin, never the native app's storage.
if (location.hostname !== "127.0.0.1" || location.port !== "1433") {
  throw new Error("Run this isolated QA fixture on 127.0.0.1:1433.");
}
localStorage.removeItem(DRAFT_STATE_STORAGE_KEY);
localStorage.removeItem(WORKSPACE_STATE_STORAGE_KEY);
localStorage.setItem(THEME_STORAGE_KEY, "edohigan");
localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "ja");
localStorage.setItem(EDITOR_SETTINGS_STORAGE_KEY, JSON.stringify({
  ambientIntensity: params.get("intensity") ?? "normal", lModeEnabled: params.get("view") === "lmode",
}));
if (["editor", "lmode"].includes(params.get("view") ?? "")) {
  localStorage.setItem(WORKSPACE_STATE_STORAGE_KEY, JSON.stringify({
    workspaceRootPath: null, tabPaths: ["/workspace/untitled.md"], activeTabPath: "/workspace/untitled.md",
  }));
}

// ネイティブ（Rustコマンド）のスタブ。未知のコマンドは null を返して起動を止めない。
const calls: string[] = [];
let callbackId = 0;
(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
  // event API（listen 等）が使う。イベントは配信しないので id を返すだけでよい。
  transformCallback: (callback: unknown) => {
    callbackId += 1;
    (window as unknown as Record<string, unknown>)[`_${callbackId}`] = callback;
    return callbackId;
  },
  // unlisten が使う（イベントを配信しないので何もしない）。
  unregisterListener: () => {},
  // getCurrentWindow() が読む。
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { label: "main", windowLabel: "main" },
  },
  invoke: async (command: string, args?: Record<string, unknown>) => {
    calls.push(command);
    switch (command) {
      case "get_file_metadata":
        return {
          path: (args?.path as string) ?? "",
          size: 601,
          modified_ms: Date.parse("2026-09-11T12:41:00+09:00"),
          fingerprint: "fp-new",
          large_file_warning: false,
        };
      case "check_apple_assist_availability":
        return { kind: "unsupported" };
      case "open_text_file":
        return {
          name: "untitled.md",
          path: (args?.path as string) ?? "/workspace/名称未設定.md",
          contents: sample,
          encoding: "utf-8",
          line_ending: "lf",
          size: 601,
          modified_ms: null,
          fingerprint: "fp-new",
        };
      case "list_recent_workspaces":
      case "list_recent_entries":
      case "list_backups":
      case "drain_opened_files":
      case "list_workspace_directory":
        return [];
      default:
        return null;
    }
  },
};

// event プラグイン側の内部（unlisten が使う）。イベントは配信しないので何もしない。
(window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown })
  .__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  registerListener: () => 1,
  unregisterListener: () => {},
};

(window as unknown as { __hazakuraFixtureCalls?: () => string[] })
  .__hazakuraFixtureCalls = () => calls;

document.documentElement.dataset.theme = "edohigan";

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
