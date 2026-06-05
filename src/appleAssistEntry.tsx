import { createRoot } from "react-dom/client";
import { AppleAssistWindowApp } from "./components/appleAssist/AppleAssistWindowApp";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Apple Assist window root container not found");
}

createRoot(container).render(<AppleAssistWindowApp />);
