import { createRoot } from "react-dom/client";
import { AgentWindowApp } from "./components/agent/AgentWindowApp";
import { syncDocumentLanguageFromStorage } from "./features/app/documentLanguage";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Agent window root container not found");
}

// メイン窓・Local Assist窓と同じ規則。DeveloperレーンのAgent窓も
// React の初回描画前に保存済み表示言語を反映する。
syncDocumentLanguageFromStorage();

createRoot(container).render(<AgentWindowApp />);
