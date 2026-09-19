// Browser-only presentation fixture. Real component, simulated IPC; no model/save.
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { AppleAssistWindowApp } from "../../../src/components/appleAssist/AppleAssistWindowApp";
import { APPLE_ASSIST_PROPOSAL_STATUS_EVENT, type AppleAssistApplyEvent } from "../../../src/types";
import { LOCAL_ASSIST_REVIEW_RESULT_EVENT } from "../../../src/features/editor/localAssistReviewIdentity";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
localStorage.setItem("hazakura-note-theme", params.get("theme") ?? "light");
localStorage.setItem("hazakura-note-menu-language", params.get("lang") ?? "ja");
const original = "忙しい日には、ついつい時間を何かで埋めたくなる。けれど、何もしない時間にも意味がある。窓を開けて風を感じる。その小さな余白から、次の言葉が生まれてくる。";
const candidate = "忙しい日ほど、時間を何かで埋めたくなる。けれど、何もしない時間にも意味がある。窓を開けて風を感じる。その小さな余白から、次の言葉が生まれる。";
const target = {
  kind: "paragraph", start: 0, end: original.length, text: original, label: "段落",
  activeDocumentPath: "/fixture/朝の余白.md", activeDocumentName: params.has("long") ? "朝の余白について書いた、とても長い名前の原稿・改訂版.md" : "朝の余白.md",
  activeDocumentSessionId: "fixture-document", capturedAtMs: 0,
};
let active: AppleAssistApplyEvent | null = null;
mockIPC(async (command, args) => {
  const input = args as Record<string, any>;
  if (command === "probe_apple_assist_availability") return { kind: params.get("state") ?? "available" };
  if (command === "get_main_apple_assist_target") return params.has("empty") ? null : target;
  if (command === "set_apple_assist_window_theme") return;
  if (command === "request_apple_assist_proposal") {
    active = input.payload;
    const request = active!;
    const status = (phase: string, extra = {}) => emit(APPLE_ASSIST_PROPOSAL_STATUS_EVENT, {
      ...request, target, phase, message: "fixture", emittedAtMs: Date.now(), ...extra,
    });
    setTimeout(() => { if (active === request) void status("started", { originalText: original }); }, 100);
    setTimeout(() => { if (active === request) void status("partial", { partialText: candidate }); }, 600);
    setTimeout(() => { if (active === request) {
      active = null;
      void status(params.has("fail") ? "failed" : "completed", { candidateText: candidate });
    } }, 4500);
    return;
  }
  if (command === "cancel_apple_assist_proposal" && active) {
    const request = active;
    active = null;
    await emit(APPLE_ASSIST_PROPOSAL_STATUS_EVENT, { ...request, phase: "cancelled", message: "", emittedAtMs: Date.now() });
    return;
  }
  if (command === "request_apple_assist_review") {
    await emit(LOCAL_ASSIST_REVIEW_RESULT_EVENT, { ...input.payload, accepted: false });
    return;
  }
  throw new Error(`Unsupported fixture command: ${command}`);
}, { shouldMockEvents: true });
createRoot(document.getElementById("root")!).render(<AppleAssistWindowApp />);
