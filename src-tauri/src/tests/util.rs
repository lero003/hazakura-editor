// Tests for small util helpers — binary detection and base64 decoding.
use super::*;

#[test]
fn binary_detection_finds_nul_byte() {
    let dir = unique_test_dir("binary_detection");
    fs::create_dir_all(&dir).expect("create test dir");
    let path = dir.join("sample.bin");
    fs::write(&path, b"abc\0def").expect("write binary fixture");

    assert!(looks_binary(&path).expect("inspect file"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn base64_decoder_rejects_invalid_padding() {
    assert_eq!(
        decode_base64("iVBORw0KGgo=").expect("decode png header"),
        b"\x89PNG\r\n\x1a\n"
    );
    assert!(decode_base64("AA=A").is_err());
    assert!(decode_base64("AAAA=AAA").is_err());
    assert!(decode_base64("A===").is_err());
}
