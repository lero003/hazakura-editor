use super::*;

#[test]
fn print_handoff_file_name_allows_only_plain_html_file_names() {
    assert_eq!(
        normalize_print_handoff_file_name("note.html").expect("plain html name"),
        "note.html"
    );
    assert_eq!(
        normalize_print_handoff_file_name("Draft.HTML").expect("case-insensitive html name"),
        "Draft.HTML"
    );

    for file_name in [
        "",
        ".html",
        "note.txt",
        "../note.html",
        "folder/note.html",
        "folder\\note.html",
        "/tmp/note.html",
        "C:\\Temp\\note.html",
        "C:note.html",
        "note.html\n",
    ] {
        let err = normalize_print_handoff_file_name(file_name)
            .expect_err("path-like or non-html print name should be rejected");
        assert!(
            err.contains("print"),
            "unexpected error for {file_name:?}: {err}",
        );
    }
}

#[test]
fn os_handoff_commands_use_static_allowlisted_launchers() {
    let external = build_os_handoff_command(OsHandoffTarget::ExternalUrl(
        "https://hazakura.dev/hazakura-editor/support/",
    ));
    let reveal_path = std::path::Path::new("/tmp/hazakura-note.md");
    let reveal = build_os_handoff_command(OsHandoffTarget::RevealPath(reveal_path));
    let print_path = std::path::Path::new("/tmp/hazakura-print.html");
    let print = build_os_handoff_command(OsHandoffTarget::PrintHtml(print_path));

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
        assert_eq!(print.program, std::ffi::OsString::from("/usr/bin/open"));
        assert_eq!(print.args, vec![print_path.as_os_str().to_os_string()]);
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
        assert_eq!(print.program, std::ffi::OsString::from("cmd"));
        assert_eq!(
            print.args,
            vec![
                std::ffi::OsString::from("/C"),
                std::ffi::OsString::from("start"),
                std::ffi::OsString::from(""),
                print_path.as_os_str().to_os_string(),
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
        assert_eq!(print.program, std::ffi::OsString::from("xdg-open"));
        assert_eq!(print.args, vec![print_path.as_os_str().to_os_string()]);
    }
}
