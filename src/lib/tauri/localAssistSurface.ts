// Local Assist always uses its native companion window. Keep this compatibility
// module so main-window callers cannot accidentally redirect into the editor.
export { openAppleAssistWindow, toggleAppleAssistWindow } from "./agent";
