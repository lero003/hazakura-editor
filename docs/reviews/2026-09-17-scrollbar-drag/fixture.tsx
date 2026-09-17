// スクロールバー ドラッグの再現・計測用 fixture（2026-09-17）。
// 実アプリ（`App`）を**ネイティブ境界だけ**スタブして描き、スクロールと
// ポインタのイベント列を `window.__probe` に記録する。UI は作り直さない。
//   ?theme=light|dark
//   ?open=<path>   「ファイルを開く」で返すパス
// 起動後、自動で「ファイルを開く」を押して長い文書を開く。
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../../../src/App";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const OPEN_PATH = params.get("open") ?? "/workspace/散文集/02_朝の余白.md";

const LONG_DOCUMENT = [
  "# 第一章 朝の余白",
  "",
  ...Array.from(
    { length: 8 },
    (_, index) =>
      `余白は、何もない場所ではない。まだことばになっていない考えや、見落としていた感情が、静かに姿を現すための場所なのだと思う。（段落${index + 1}）\n\nカップから上がる湯気が、朝の光の中をゆっくりほどけていく。その行方を、しばらく目で追っていた。窓の外では、鳥が一羽、枝から枝へと移っていく。`,
  ),
  "",
  "# 第二章 机と窓辺",
  "",
  ...Array.from(
    { length: 6 },
    (_, index) =>
      `机の上の余白も、書くための道具だと思う。（段落${index + 9}）\n\n一日の終わりに、書いたことばを読み返す。読み返す速度は、書く速度よりいつも遅い。`,
  ),
  "",
  "# 第三章 雨の日",
  "",
  ...Array.from(
    { length: 6 },
    (_, index) =>
      `雨の日は、音が近い。（段落${index + 15}）\n\n窓ガラスについた雫が、一つずつ落ちていく。落ちる順番は、いつも、不規則だ。`,
  ),
].join("\n");

type ProbeEntry = {
  ms: number;
  kind: string;
  target: string;
  x?: number;
  y?: number;
  scrollTop?: number;
  detail?: string;
};

const probe: ProbeEntry[] = [];
(window as unknown as { __probe?: ProbeEntry[] }).__probe = probe;
const started = performance.now();
// evaluate は隔離スコープなので `window.__probe` は読めない。
// 計測結果は DOM に書き出す（DOM はスコープをまたいで共有される）。
const mirror = document.createElement("pre");
mirror.id = "__probe-mirror";
mirror.style.display = "none";
document.body.append(mirror);

function describe(target: EventTarget | null): string {
  if (target === null) {
    return "null";
  }
  if (!(target instanceof Element)) {
    return String(target);
  }
  const raw = typeof target.className === "string" ? target.className : "";
  const classes = raw.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  return target.tagName.toLowerCase() + (classes ? "." + classes : "");
}

function record(entry: Omit<ProbeEntry, "ms">) {
  const full: ProbeEntry = { ms: Math.round(performance.now() - started), ...entry };
  probe.push(full);
  mirror.textContent +=
    [
      full.kind,
      "@" + full.ms,
      full.target,
      full.x === undefined ? "" : `(${full.x},${full.y})`,
      full.scrollTop === undefined ? "" : "top=" + full.scrollTop,
      full.detail ?? "",
    ]
      .filter(Boolean)
      .join(" ") + "\n";
}

for (const kind of ["mousedown", "mouseup", "pointerdown", "pointerup"] as const) {
  window.addEventListener(
    kind,
    (event) =>
      record({
        kind,
        target: describe(event.target),
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY,
      }),
    true,
  );
}
window.addEventListener(
  "focusin",
  (event) => record({ kind: "focusin", target: describe(event.target) }),
  true,
);
window.addEventListener(
  "focusout",
  (event) => record({ kind: "focusout", target: describe(event.target) }),
  true,
);
window.addEventListener(
  "scroll",
  (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains("cm-scroller")) {
      record({
        kind: "scroll",
        target: "cm-scroller",
        scrollTop: Math.round(target.scrollTop),
      });
    } else if (target instanceof HTMLElement && target.classList.contains("cm-content")) {
      record({ kind: "scroll", target: "cm-content", scrollTop: Math.round(target.scrollTop) });
    }
  },
  true,
);

let callbackId = 0;
(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
  transformCallback: (callback: unknown) => {
    callbackId += 1;
    (window as unknown as Record<string, unknown>)[`_${callbackId}`] = callback;
    return callbackId;
  },
  unregisterListener: () => {},
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { label: "main", windowLabel: "main" },
  },
  invoke: async (command: string, args?: Record<string, unknown>) => {
    switch (command) {
      case "plugin:dialog|open":
        return args?.options && (args.options as { directory?: boolean }).directory
          ? null
          : OPEN_PATH;
      case "plugin:dialog|message":
      case "plugin:dialog|confirm":
        return true;
      case "get_file_metadata":
        return {
          path: (args?.path as string) ?? OPEN_PATH,
          size: LONG_DOCUMENT.length,
          modified_ms: Date.parse("2026-09-17T09:00:00+09:00"),
          fingerprint: "fp-scroll-probe",
          large_file_warning: false,
        };
      case "check_apple_assist_availability":
        return { kind: "unsupported" };
      case "open_text_file":
        return {
          path: (args?.path as string) ?? OPEN_PATH,
          name: ((args?.path as string) ?? OPEN_PATH).split("/").pop() ?? "02_朝の余白.md",
          contents: LONG_DOCUMENT,
          encoding: "utf-8",
          line_ending: "lf",
          size: LONG_DOCUMENT.length,
          modified_ms: null,
          fingerprint: "fp-scroll-probe",
          large_file_warning: false,
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

(window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown })
  .__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  registerListener: () => 1,
  unregisterListener: () => {},
};

document.documentElement.dataset.theme = params.get("theme") ?? "light";

// ?scrollbar=classic で macOS の「スクロールバーを常に表示」相当（レイアウトを
// 持つスクロールバー）を再現する。既定は OS 任せ（オーバーレイ）。
if (params.get("scrollbar") === "classic") {
  const style = document.createElement("style");
  style.textContent = `
    .cm-scroller::-webkit-scrollbar { width: 15px; height: 15px; }
    .cm-scroller::-webkit-scrollbar-track { background: rgba(0,0,0,0.06); }
    .cm-scroller::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.32); border-radius: 8px; }
  `;
  document.head.append(style);
}

async function openLongDocument() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const actions = document.querySelector(".start-actions");
    const buttons = actions?.querySelectorAll("button");
    const openButton = buttons ? buttons[buttons.length - 1] : null;
    if (openButton) {
      (openButton as HTMLButtonElement).click();
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
void openLongDocument();
