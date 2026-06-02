pub(crate) const MAIN_WINDOW_LABEL: &str = "main";
pub(crate) const AGENT_WINDOW_LABEL: &str = "agent";

pub(crate) fn ensure_main_window<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    if window.label() != MAIN_WINDOW_LABEL {
        return Err(format!(
            "Command is not allowed from window '{}'.",
            window.label()
        ));
    }
    Ok(())
}

// Label-only check used by the `*_with_label` bodies. Mirrors the
// `*_window` helpers above but takes a `&str` so unit tests can call
// the bodies without a Tauri `WebviewWindow` instance.
pub(crate) fn ensure_label_is_main(label: &str) -> Result<(), String> {
    if label != MAIN_WINDOW_LABEL {
        return Err(format!("Command is not allowed from window '{label}'."));
    }
    Ok(())
}

pub(crate) fn ensure_label_is_main_or_agent(label: &str) -> Result<(), String> {
    if label != MAIN_WINDOW_LABEL && label != AGENT_WINDOW_LABEL {
        return Err(format!("Command is not allowed from window '{label}'."));
    }
    Ok(())
}
