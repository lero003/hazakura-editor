// Import Assist Phase 1 — pure draft assembly and path allowlist.
//
// Native PDFKit / Vision live in the Swift helper
// (`src-helpers/import-assist`). This module stays free of Apple
// frameworks so `cargo test` works on all hosts. UI and helper
// process wiring land in a later product slice.
//
// Public items are intentionally unused by the app shell until the
// unsaved-tab MVP wires them; unit tests exercise them now.
#![allow(dead_code)]

pub mod draft;
pub mod helper;
pub mod path;
pub mod pdf_text;
pub mod stage;
