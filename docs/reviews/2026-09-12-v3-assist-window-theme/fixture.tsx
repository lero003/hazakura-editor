// Vite-only review fixture: the Local Assist companion window across all
// seven themes. Renders the real component and the real stylesheet; it is
// not an application entry and it does not exercise System generation.
import { createRoot } from "react-dom/client";
import { AppleAssistWindowApp } from "../../../src/components/appleAssist/AppleAssistWindowApp";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") ?? "light";
// readInitialTheme / readInitialMenuLanguage run on mount, so the stored
// value must exist before the first render (a later dataset.theme rewrite
// would be overwritten by the component's own effect anyway).
localStorage.setItem("hazakura-note-theme", theme);
localStorage.setItem("hazakura-note-menu-language", params.get("lang") ?? "ja");

createRoot(document.getElementById("root")!).render(<AppleAssistWindowApp />);
