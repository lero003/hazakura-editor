use super::*;

#[test]
fn normalize_external_url_allows_bounded_external_schemes() {
    assert_eq!(
        normalize_external_url(" https://hazakura.dev/hazakura-editor/support/ ")
            .expect("https should normalize"),
        "https://hazakura.dev/hazakura-editor/support/"
    );
    assert_eq!(
        normalize_external_url("mailto:support@hazakura.dev").expect("mailto should normalize"),
        "mailto:support@hazakura.dev"
    );
    assert_eq!(
        normalize_external_url("tel:+15551234567").expect("tel should normalize"),
        "tel:+15551234567"
    );
}

#[test]
fn normalize_external_url_blocks_unsafe_or_in_app_targets() {
    for url in [
        "javascript:alert(1)",
        "file:///Users/example/secret.md",
        "/workspace/docs/readme.md",
        "//hazakura.dev/path",
        "https://hazakura.dev/has space",
        "https:hazakura.dev/no-host",
    ] {
        let err = normalize_external_url(url).expect_err("url should be blocked");
        assert!(
            err.contains("External") || err.contains("scheme"),
            "unexpected error for {url}: {err}"
        );
    }
}
