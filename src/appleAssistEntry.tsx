import { createRoot } from "react-dom/client";
import { AppleAssistWindowApp } from "./components/appleAssist/AppleAssistWindowApp";
import { syncDocumentLanguageFromStorage } from "./features/app/documentLanguage";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Hazakura Local Assist window root container not found");
}

// メイン窓と同じく、保存済み表示言語を React の初回描画前に反映する。
syncDocumentLanguageFromStorage();

createRoot(container).render(<AppleAssistWindowApp />);
