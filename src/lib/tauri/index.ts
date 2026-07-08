// Barrel for the `lib/tauri/*` modules. Consumers should prefer
// importing directly from the per-area file (e.g.
// `lib/tauri/files`) once they're working in the area; this
// barrel exists so existing `import { ... } from "../../lib/
// tauri"` sites keep working and so cross-area consumers
// (tests, scaffolding) don't have to memorize the layout.

export * from "./_runtime";
export * from "./app";
export * from "./agent";
export * from "./appleAssist";
export * from "./autoBackup";
export * from "./dialog";
export * from "./external";
export * from "./files";
export * from "./importAssist";
export * from "./menu";
export * from "./theme";
export * from "./window";
export * from "./workspace";
