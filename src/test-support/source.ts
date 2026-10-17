import { readFileSync } from "node:fs";

/**
 * Reads a repository file as text.
 *
 * A few tests deliberately assert on source structure rather than on runtime
 * behaviour: lane/build wiring (`buildScripts`), the editor's extension
 * composition (`editorBaseSetup`, `EditorPane`), and cross-window copy
 * contracts (`AgentWindowApp.language`). Those assertions must be updated when
 * the referenced code moves, so they read the file through this one helper
 * instead of repeating `process.cwd()` path math.
 */
export function readProjectFile(relativePath: string): string {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}
