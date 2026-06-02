import { createRoot } from "react-dom/client";
import { AgentWindowApp } from "./components/AgentWindowApp";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Agent window root container not found");
}

createRoot(container).render(<AgentWindowApp />);
