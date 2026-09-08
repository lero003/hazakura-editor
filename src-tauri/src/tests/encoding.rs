// ── Text encoding (UTF-8 / UTF-8 BOM / Shift-JIS / EUC-JP) ──
//
// The supported encodings round-trip through detect_text_encoding and
// encode_text. These tests pin the contract: a string written via
// encode_text re-detects to the same label, and detection on the
// leading 3 bytes 0xEF 0xBB 0xBF identifies the BOM form before any
// codec work.
use super::*;

// ── Text encoding (UTF-8 / UTF-8 BOM / Shift-JIS / EUC-JP) ──
//
// The supported encodings round-trip through detect_text_encoding and
// encode_text. These tests pin the contract: a string written via
// encode_text re-detects to the same label, and detection on the
// leading 3 bytes 0xEF 0xBB 0xBF identifies the BOM form before any
// codec work.

#[test]
fn detect_text_encoding_returns_utf_8_for_ascii() {
    let detected = detect_text_encoding(b"hello world");
    assert_eq!(detected, "utf-8");
}

#[test]
fn detect_text_encoding_returns_utf_8_bom_when_bom_present() {
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice("hello".as_bytes());
    let detected = detect_text_encoding(&bytes);
    assert_eq!(detected, "utf-8-bom");
}

#[test]
fn encode_text_round_trips_shift_jis() {
    let original = "これはテストです。";
    let encoded = encode_text(original, "shift-jis").expect("encode shift-jis");
    let detected = detect_text_encoding(&encoded);
    assert_eq!(detected, "shift-jis");
    // Decode back and confirm round-trip equality.
    let (decoded, _, malformed) = encoding_rs::SHIFT_JIS.decode(&encoded);
    assert!(!malformed, "encoded shift-jis must decode losslessly");
    assert_eq!(decoded, original);
}

#[test]
fn encode_text_round_trips_euc_jp() {
    let original = "これはテストです。";
    let encoded = encode_text(original, "euc-jp").expect("encode euc-jp");
    let detected = detect_text_encoding(&encoded);
    assert_eq!(detected, "euc-jp");
    let (decoded, _, malformed) = encoding_rs::EUC_JP.decode(&encoded);
    assert!(!malformed, "encoded euc-jp must decode losslessly");
    assert_eq!(decoded, original);
}

#[test]
fn explicit_encoding_reopen_and_save_as_preserve_ambiguous_euc_jp() {
    let root = unique_test_dir("explicit_encoding");
    fs::create_dir_all(&root).unwrap();
    for (index, text) in ["あいうえお", "漢字の文章", "ASCII 123 と日本語"]
        .iter()
        .enumerate()
    {
        let path = root
            .join(format!("{index}.md"))
            .to_string_lossy()
            .into_owned();
        let saved = save_text_file_as_with_label(
            MAIN_WINDOW_LABEL,
            path.clone(),
            text.to_string(),
            "lf".into(),
            "euc-jp".into(),
            None,
        )
        .unwrap();
        assert_eq!(saved.contents, *text);
        assert_eq!(saved.encoding, "euc-jp");
        let reopened = crate::commands::files::open_text_file_with_encoding(
            MAIN_WINDOW_LABEL,
            path.clone(),
            Some("euc-jp"),
        )
        .unwrap();
        assert_eq!(reopened.contents, *text);
        assert!(crate::commands::files::open_text_file_with_encoding(
            "agent",
            path.clone(),
            Some("euc-jp")
        )
        .is_err());
        assert!(crate::commands::files::open_text_file_with_encoding(
            MAIN_WINDOW_LABEL,
            path,
            Some("unknown")
        )
        .is_err());
    }
    fs::remove_dir_all(root).unwrap();
}
