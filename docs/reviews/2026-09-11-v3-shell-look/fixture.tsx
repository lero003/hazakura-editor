// 実アプリ（`App` = AppShell + useAppShellController）を、**ネイティブ境界だけ**差し替えて描く。
// UIは1行も作り直さないので、実機と同じ DOM・同じ CSS を測れる。
//   ?theme=light|dark   起動後は「New File」で編集面へ入る（ネイティブのファイルI/Oなし）。
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../../../src/App";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);

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
          size: 4173,
          modified_ms: Date.parse("2026-09-11T12:41:00+09:00"),
          fingerprint: "fp-external",
          large_file_warning: false,
        };
      case "check_apple_assist_availability":
        return { kind: "unsupported" };
      case "open_text_file":
        return {
          path: (args?.path as string) ?? "/workspace/名称未設定.md",
          // 長い原稿（見開きの確認用）。?doc=long のときだけ入れる。
          contents:
            params.get("doc") === "long"
              ? [
                  "# 第一章 朝の余白",
                  "",
                  ...Array.from({ length: 6 }, (_, i) =>
                    `余白は、何もない場所ではない。まだことばになっていない考えや、見落としていた感情が、静かに姿を現すための場所なのだと思う。（段落${i + 1}）\n\nカップから上がる湯気が、朝の光の中をゆっくりほどけていく。その行方を、しばらく目で追っていた。窓の外では、鳥が一羽、枝から枝へと移っていく。`,
                  ),
                  "",
                  "# 第二章 机と窓辺",
                  "",
                  ...Array.from({ length: 4 }, (_, i) =>
                    `机の上の余白も、書くための道具だと思う。（段落${i + 7}）\n\n一日の終わりに、書いたことばを読み返す。`,
                  ),
                ].join("\n")
              : "# 名称未設定\n\nここから書きます。\n",
          encoding: "utf-8",
          line_ending: "lf",
          size: 30,
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

document.documentElement.dataset.theme = params.get("theme") ?? "light";

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
