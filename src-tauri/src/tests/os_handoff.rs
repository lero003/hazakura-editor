use super::*;

#[test]
fn os_handoff_commands_use_static_allowlisted_launchers() {
    let external = build_os_handoff_command(OsHandoffTarget::ExternalUrl(
        "https://hazakura.dev/hazakura-editor/support/",
    ));
    let reveal_path = std::path::Path::new("/tmp/hazakura-note.md");
    let reveal = build_os_handoff_command(OsHandoffTarget::RevealPath(reveal_path));

    #[cfg(target_os = "macos")]
    {
        assert_eq!(external.program, std::ffi::OsString::from("/usr/bin/open"));
        assert_eq!(
            external.args,
            vec![std::ffi::OsString::from(
                "https://hazakura.dev/hazakura-editor/support/",
            )]
        );
        assert_eq!(reveal.program, std::ffi::OsString::from("/usr/bin/open"));
        assert_eq!(
            reveal.args,
            vec![
                std::ffi::OsString::from("-R"),
                reveal_path.as_os_str().to_os_string(),
            ]
        );
    }

    #[cfg(target_os = "windows")]
    {
        assert_eq!(external.program, std::ffi::OsString::from("cmd"));
        assert_eq!(
            external.args,
            vec![
                std::ffi::OsString::from("/C"),
                std::ffi::OsString::from("start"),
                std::ffi::OsString::from(""),
                std::ffi::OsString::from("https://hazakura.dev/hazakura-editor/support/"),
            ]
        );
        assert_eq!(reveal.program, std::ffi::OsString::from("explorer"));
        assert_eq!(
            reveal.args,
            vec![
                std::ffi::OsString::from("/select,"),
                reveal_path.as_os_str().to_os_string(),
            ]
        );
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        assert_eq!(external.program, std::ffi::OsString::from("xdg-open"));
        assert_eq!(
            external.args,
            vec![std::ffi::OsString::from(
                "https://hazakura.dev/hazakura-editor/support/",
            )]
        );
        assert_eq!(reveal.program, std::ffi::OsString::from("xdg-open"));
        assert_eq!(reveal.args, vec![std::ffi::OsString::from("/tmp")]);
    }
}
