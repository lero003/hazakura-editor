// Re-exports from the crate root are already pulled in by
// `use super::*;` in this file's parent. The `mod` lines below
// split the tests by feature area; each sub-module inherits the
// same crate-root re-exports via its own `use super::*;` line, so
// the test bodies keep the pre-split `use super::*;` import.
//
// The shared fixtures and helpers in `common` are re-exported
// here so the per-feature test modules can keep their
// `use super::*;` import working — the original `tests.rs` had
// the fixtures and helpers in the same scope as the tests.
use super::*;

mod agent_workbench;
mod app_window;
mod apple_assist;
mod apple_assist_supervisor;
mod backup;
mod common;
mod encoding;
mod files;
mod search;
mod security;
mod util;
mod workspace;
mod workspace_broadcast;

pub(crate) use crate::auto_backup;
pub(crate) use common::*;
