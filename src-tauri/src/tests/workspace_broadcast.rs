// Tests for the main-window workspace cache that the detached
// Agent window reads on mount.
use super::*;

#[test]
fn get_main_active_workspace_allows_any_label() {
    // The detached agent window calls this on mount to learn the
    // latest known workspace before the user starts a session, and
    // the main window may also call it (self-consistency). Both
    // must clear the gate; only the unit test can pin the gate
    // because the actual cache lookup needs an `AppHandle`.
    get_main_active_workspace_with_label(MAIN_WINDOW_LABEL)
        .expect("main must be allowed to read the main workspace cache");
    get_main_active_workspace_with_label(AGENT_WINDOW_LABEL)
        .expect("agent must be allowed to read the main workspace cache");
}

#[test]
fn set_main_active_workspace_rejects_agent_label() {
    // The main window is the only writer — the agent window must
    // not be able to spoof the cache value, because that would let
    // it start a session bound to an arbitrary workspace. The gate
    // is the second layer on top of the agent window's empty
    // `permissions` array.
    let err = set_main_active_workspace_with_label(AGENT_WINDOW_LABEL)
        .expect_err("set_main_active_workspace must reject the agent window");
    assert!(err.contains(AGENT_WINDOW_LABEL), "{err}");
}
