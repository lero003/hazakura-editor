import { createRoot } from "react-dom/client";
import { AgentWindowApp } from "./components/agent/AgentWindowApp";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Agent window root container not found");
}

// DeveloperレーンのAgent窓は chrome が英語固定（保存済み表示言語を読まない）ため、
// 宣言も `en` のまま固定する。表示文言を翻訳するときは、ここも一緒に表示言語へ切り替える。
document.documentElement.lang = "en";

createRoot(container).render(<AgentWindowApp />);
