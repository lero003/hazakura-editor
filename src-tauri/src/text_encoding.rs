//! Strict UTF-8 and legacy Japanese codecs. BOM handling remains in `util`.
//!
//! macOS uses its system iconv tables, with the small compatibility rules from
//! the WHATWG Shift_JIS/EUC-JP algorithms below. OS encoding names alone do not
//! have the same acceptance/mapping contract. `encoding_rs` is the macOS test
//! oracle, and remains the implementation on other targets.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum LegacyEncoding {
    ShiftJis,
    EucJp,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CodecError {
    InvalidInput,
    #[cfg(target_os = "macos")]
    Unavailable,
    #[cfg(target_os = "macos")]
    CapacityExceeded,
}

// Keep the existing encoding_rs SIMD validator as a small leaf on macOS:
// std UTF-8 validation is materially slower on long Japanese manuscripts.
// Both return a checked borrowed str and reject malformed UTF-8.
pub(crate) fn decode_utf8(bytes: &[u8]) -> Result<&str, CodecError> {
    #[cfg(target_os = "macos")]
    {
        simdutf8::basic::from_utf8(bytes).map_err(|_| CodecError::InvalidInput)
    }
    #[cfg(not(target_os = "macos"))]
    {
        std::str::from_utf8(bytes).map_err(|_| CodecError::InvalidInput)
    }
}

pub(crate) fn decode(bytes: &[u8], encoding: LegacyEncoding) -> Result<String, CodecError> {
    #[cfg(target_os = "macos")]
    {
        native::Decoder::new(encoding)?.decode(bytes)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let (text, malformed) = oracle_codec(encoding).decode_without_bom_handling(bytes);
        if malformed {
            Err(CodecError::InvalidInput)
        } else {
            Ok(text.into_owned())
        }
    }
}

pub(crate) fn encode(text: &str, encoding: LegacyEncoding) -> Result<Vec<u8>, CodecError> {
    #[cfg(target_os = "macos")]
    {
        native::Encoder::new(encoding)?.encode(text)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let (bytes, _, unmappable) = oracle_codec(encoding).encode(text);
        if unmappable {
            Err(CodecError::InvalidInput)
        } else {
            Ok(bytes.into_owned())
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn oracle_codec(encoding: LegacyEncoding) -> &'static encoding_rs::Encoding {
    match encoding {
        LegacyEncoding::ShiftJis => encoding_rs::SHIFT_JIS,
        LegacyEncoding::EucJp => encoding_rs::EUC_JP,
    }
}

#[cfg(target_os = "macos")]
mod native {
    use super::{CodecError, LegacyEncoding};
    use std::ffi::{c_char, c_void, CStr};

    #[link(name = "iconv")]
    extern "C" {
        fn iconv_open(to: *const c_char, from: *const c_char) -> *mut c_void;
        fn iconv(
            descriptor: *mut c_void,
            input: *mut *mut c_char,
            input_left: *mut usize,
            output: *mut *mut c_char,
            output_left: *mut usize,
        ) -> usize;
        fn iconv_close(descriptor: *mut c_void) -> i32;
    }

    const UTF8: &CStr = c"UTF-8";
    const CP932: &CStr = c"CP932";
    const CP51932: &CStr = c"CP51932";
    const EUC_JP: &CStr = c"EUC-JP";

    // Each operation owns its descriptors. Raw pointers are neither Send nor
    // Sync; there is no global state and mutable access serializes reset/use.
    struct Converter(*mut c_void);

    impl Converter {
        fn new(from: &CStr, to: &CStr) -> Result<Self, CodecError> {
            // SAFETY: Both names are live NUL-terminated C strings. A successful
            // descriptor is owned by this value and closed exactly once by Drop.
            let descriptor = unsafe { iconv_open(to.as_ptr(), from.as_ptr()) };
            if descriptor.is_null() || descriptor == usize::MAX as *mut c_void {
                Err(CodecError::Unavailable)
            } else {
                Ok(Self(descriptor))
            }
        }

        fn convert(&mut self, input: &[u8], decoding: bool) -> Result<Vec<u8>, CodecError> {
            // SAFETY: The descriptor is live and exclusively borrowed. Null
            // buffer arguments reset the stateless CP932/EUC codec for this run.
            let reset = unsafe {
                iconv(
                    self.0,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            };
            if reset != 0 {
                return Err(CodecError::Unavailable);
            }
            if input.is_empty() {
                return Ok(Vec::new());
            }
            let capacity = output_capacity(input.len(), decoding)?;
            let mut output = Vec::new();
            output
                .try_reserve_exact(capacity)
                .map_err(|_| CodecError::CapacityExceeded)?;
            output.resize(capacity, 0);
            let mut input_pointer = input.as_ptr() as *mut c_char;
            let mut input_left = input.len();
            let mut output_pointer = output.as_mut_ptr() as *mut c_char;
            let mut output_left = output.len();
            // SAFETY: The slices remain live throughout the call. iconv reads
            // input bytes and advances the local input pointer; despite char**
            // in its C ABI, it does not modify the input buffer. The distinct
            // output allocation is writable for output_left bytes, including
            // embedded NUL. No C string length or sentinel is used for payloads.
            let result = unsafe {
                iconv(
                    self.0,
                    &mut input_pointer,
                    &mut input_left,
                    &mut output_pointer,
                    &mut output_left,
                )
            };
            // Nonzero includes irreversible substitutions, not just size_t(-1).
            // Partial output is never returned after malformed/unmappable input.
            if result != 0 || input_left != 0 {
                return Err(CodecError::InvalidInput);
            }
            let used = capacity
                .checked_sub(output_left)
                .ok_or(CodecError::InvalidInput)?;
            output.truncate(used);
            Ok(output)
        }
    }

    impl Drop for Converter {
        fn drop(&mut self) {
            // SAFETY: Only successfully opened, uniquely owned descriptors reach
            // this Drop, including when a later descriptor fails to initialize.
            unsafe {
                iconv_close(self.0);
            }
        }
    }

    fn output_capacity(input: usize, decoding: bool) -> Result<usize, CodecError> {
        // Legacy decode needs at most 3 UTF-8 bytes per input byte (halfwidth
        // kana); UTF-8 encode needs no more legacy bytes than source bytes.
        input
            .checked_mul(if decoding { 3 } else { 1 })
            .and_then(|n| n.checked_add(16))
            .ok_or(CodecError::CapacityExceeded)
    }

    fn append_text(output: &mut String, text: &str) -> Result<(), CodecError> {
        output
            .try_reserve(text.len())
            .map_err(|_| CodecError::CapacityExceeded)?;
        output.push_str(text);
        Ok(())
    }

    fn append_bytes(output: &mut Vec<u8>, bytes: &[u8]) -> Result<(), CodecError> {
        output
            .try_reserve(bytes.len())
            .map_err(|_| CodecError::CapacityExceeded)?;
        output.extend_from_slice(bytes);
        Ok(())
    }

    pub(super) struct Decoder {
        primary: Converter,
        jis0212: Option<Converter>,
        encoding: LegacyEncoding,
    }

    impl Decoder {
        pub(super) fn new(encoding: LegacyEncoding) -> Result<Self, CodecError> {
            let name = if encoding == LegacyEncoding::ShiftJis {
                CP932
            } else {
                CP51932
            };
            let primary = Converter::new(name, UTF8)?;
            // `primary` is closed automatically if this second open fails.
            let jis0212 = if encoding == LegacyEncoding::EucJp {
                Some(Converter::new(EUC_JP, UTF8)?)
            } else {
                None
            };
            Ok(Self {
                primary,
                jis0212,
                encoding,
            })
        }

        fn append_run(
            &mut self,
            output: &mut String,
            bytes: &[u8],
            jis0212: bool,
        ) -> Result<(), CodecError> {
            if bytes.is_empty() {
                return Ok(());
            }
            let converter = if jis0212 {
                self.jis0212.as_mut().ok_or(CodecError::Unavailable)?
            } else {
                &mut self.primary
            };
            let converted = converter.convert(bytes, true)?;
            let text = std::str::from_utf8(&converted).map_err(|_| CodecError::InvalidInput)?;
            append_text(output, text)
        }

        pub(super) fn decode(&mut self, bytes: &[u8]) -> Result<String, CodecError> {
            let mut output = String::new();
            let mut index = 0;
            let mut run = 0;
            while index < bytes.len() {
                let first = bytes[index];
                if first <= 0x7f {
                    index += 1;
                    continue;
                }
                let shift_jis = self.encoding == LegacyEncoding::ShiftJis;
                if shift_jis && first == 0x80 {
                    self.append_run(&mut output, &bytes[run..index], false)?;
                    append_text(&mut output, "\u{80}")?;
                    index += 1;
                    run = index;
                    continue;
                }
                let unit = valid_unit(bytes, index, self.encoding)?;
                if !shift_jis && first == 0x8f {
                    self.append_run(&mut output, &bytes[run..index], false)?;
                    let bytes = &bytes[index..index + unit];
                    // WHATWG index-jis0212 uses U+FF5E here; native EUC-JP uses
                    // U+007E. See https://encoding.spec.whatwg.org/#euc-jp-decoder.
                    if bytes == [0x8f, 0xa2, 0xb7] {
                        append_text(&mut output, "～")?;
                    } else {
                        self.append_run(&mut output, bytes, true)?;
                    }
                    index += unit;
                    run = index;
                } else {
                    index += unit;
                }
            }
            self.append_run(&mut output, &bytes[run..], false)?;
            Ok(output)
        }
    }

    fn valid_unit(
        bytes: &[u8],
        index: usize,
        encoding: LegacyEncoding,
    ) -> Result<usize, CodecError> {
        let first = bytes[index];
        let tail = &bytes[index + 1..];
        let valid = match encoding {
            LegacyEncoding::ShiftJis => {
                if (0xa1..=0xdf).contains(&first) {
                    return Ok(1);
                }
                ((0x81..=0x9f).contains(&first) || (0xe0..=0xfc).contains(&first))
                    && tail
                        .first()
                        .is_some_and(|b| (0x40..=0x7e).contains(b) || (0x80..=0xfc).contains(b))
            }
            LegacyEncoding::EucJp => {
                if first == 0x8f {
                    return if tail.len() >= 2 && tail[..2].iter().all(|b| (0xa1..=0xfe).contains(b))
                    {
                        Ok(3)
                    } else {
                        Err(CodecError::InvalidInput)
                    };
                }
                if first == 0x8e {
                    tail.first().is_some_and(|b| (0xa1..=0xdf).contains(b))
                } else {
                    (0xa1..=0xfe).contains(&first)
                        && tail.first().is_some_and(|b| (0xa1..=0xfe).contains(b))
                }
            }
        };
        // In particular reject low-bit EUC trails and Shift-JIS 0x7f. Native
        // iconv accepts some of these sequences outside the WHATWG grammar.
        if valid {
            Ok(2)
        } else {
            Err(CodecError::InvalidInput)
        }
    }

    pub(super) struct Encoder {
        primary: Converter,
        encoding: LegacyEncoding,
    }

    impl Encoder {
        pub(super) fn new(encoding: LegacyEncoding) -> Result<Self, CodecError> {
            let name = if encoding == LegacyEncoding::ShiftJis {
                CP932
            } else {
                CP51932
            };
            Ok(Self {
                primary: Converter::new(UTF8, name)?,
                encoding,
            })
        }

        pub(super) fn encode(&mut self, text: &str) -> Result<Vec<u8>, CodecError> {
            let mut output = Vec::new();
            let mut normalized = String::new();
            normalized
                .try_reserve(text.len())
                .map_err(|_| CodecError::CapacityExceeded)?;
            // WHATWG aliases and the Shift-JIS encoder's private-use exclusion:
            // https://encoding.spec.whatwg.org/#shift_jis-encoder
            // https://encoding.spec.whatwg.org/#euc-jp-encoder
            for character in text.chars() {
                match character {
                    '\u{80}' if self.encoding == LegacyEncoding::ShiftJis => {
                        append_bytes(
                            &mut output,
                            &self.primary.convert(normalized.as_bytes(), false)?,
                        )?;
                        normalized.clear();
                        append_bytes(&mut output, &[0x80])?;
                    }
                    '¥' => normalized.push('\\'),
                    '‾' => normalized.push('~'),
                    '−' => normalized.push('－'),
                    '\u{e000}'..='\u{e757}' if self.encoding == LegacyEncoding::ShiftJis => {
                        return Err(CodecError::InvalidInput)
                    }
                    _ => normalized.push(character),
                }
            }
            append_bytes(
                &mut output,
                &self.primary.convert(normalized.as_bytes(), false)?,
            )?;
            Ok(output)
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn native_converter_initialization_and_capacity_fail_closed() {
            assert!(matches!(
                Converter::new(c"HAZAKURA-UNKNOWN-CODEC", UTF8),
                Err(CodecError::Unavailable)
            ));
            assert_eq!(
                output_capacity(usize::MAX, true),
                Err(CodecError::CapacityExceeded)
            );
            assert_eq!(
                output_capacity(usize::MAX, false),
                Err(CodecError::CapacityExceeded)
            );
            assert_eq!(output_capacity(10, true), Ok(46));
            let mut converter = Converter::new(CP932, UTF8).unwrap();
            assert_eq!(
                converter.convert(&[0x81], true),
                Err(CodecError::InvalidInput)
            );
            assert_eq!(
                converter.convert(&[0x82, 0xa0], true).unwrap(),
                "あ".as_bytes()
            );
            assert_eq!(converter.convert(&[], true).unwrap(), Vec::<u8>::new());
        }
    }
}
#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn utf8_validation_matches_std_at_simd_boundaries_without_mutating_input() {
        for length in [0, 1, 31, 32, 63, 64, 65, 127, 128, 129, 255, 256, 257] {
            let mut bytes = "日本語①髙😀\0\r\n".repeat(30).into_bytes();
            bytes.truncate(length);
            for index in 0..=bytes.len() {
                let mut candidate = bytes.clone();
                if index < candidate.len() {
                    candidate[index] = 0xff;
                }
                let original = candidate.clone();
                assert_eq!(
                    decode_utf8(&candidate).ok(),
                    std::str::from_utf8(&candidate).ok()
                );
                assert_eq!(candidate, original);
            }
        }
    }

    fn assert_decode_matches(
        bytes: &[u8],
        decoder: &mut native::Decoder,
        oracle: &'static encoding_rs::Encoding,
    ) {
        let original = bytes.to_vec();
        let (expected, malformed) = oracle.decode_without_bom_handling(bytes);
        let actual = decoder.decode(bytes);
        if malformed {
            assert_eq!(actual, Err(CodecError::InvalidInput), "{bytes:02X?}");
        } else {
            assert_eq!(actual.unwrap(), expected, "{bytes:02X?}");
        }
        assert_eq!(bytes, original);
    }

    fn assert_encode_matches(
        text: &str,
        encoder: &mut native::Encoder,
        oracle: &'static encoding_rs::Encoding,
    ) {
        let original = text.to_string();
        let (expected, _, unmappable) = oracle.encode(text);
        let actual = encoder.encode(text);
        if unmappable {
            assert_eq!(actual, Err(CodecError::InvalidInput), "{text:?}");
        } else {
            assert_eq!(actual.unwrap(), expected.as_ref(), "{text:?}");
        }
        assert_eq!(text, original);
    }

    // These call the same mutable Decoder/Encoder methods as the public
    // per-operation wrappers; descriptors are reused only to avoid millions
    // of repeated opens in an exhaustive test. No oracle exists in production.
    #[test]
    fn native_legacy_codecs_match_oracle_for_all_single_two_byte_and_jis0212_values() {
        for (encoding, oracle) in [
            (LegacyEncoding::ShiftJis, encoding_rs::SHIFT_JIS),
            (LegacyEncoding::EucJp, encoding_rs::EUC_JP),
        ] {
            let mut decoder = native::Decoder::new(encoding).unwrap();
            for value in 0u32..=255 {
                assert_decode_matches(&[value as u8], &mut decoder, oracle);
            }
            for value in 0u32..=65535 {
                assert_decode_matches(&[(value >> 8) as u8, value as u8], &mut decoder, oracle);
                if encoding == LegacyEncoding::EucJp {
                    assert_decode_matches(
                        &[0x8f, (value >> 8) as u8, value as u8],
                        &mut decoder,
                        oracle,
                    );
                }
            }
        }
    }

    #[test]
    fn native_legacy_codecs_match_oracle_for_every_unicode_scalar() {
        for (encoding, oracle) in [
            (LegacyEncoding::ShiftJis, encoding_rs::SHIFT_JIS),
            (LegacyEncoding::EucJp, encoding_rs::EUC_JP),
        ] {
            let mut encoder = native::Encoder::new(encoding).unwrap();
            for character in (0..=0x10ffff).filter_map(char::from_u32) {
                assert_encode_matches(character.encode_utf8(&mut [0; 4]), &mut encoder, oracle);
            }
        }
    }

    #[test]
    #[ignore = "33.5 million comparisons; run explicitly on macOS 26 CI with --ignored"]
    fn native_legacy_codecs_match_oracle_for_all_three_byte_values() {
        for (encoding, oracle) in [
            (LegacyEncoding::ShiftJis, encoding_rs::SHIFT_JIS),
            (LegacyEncoding::EucJp, encoding_rs::EUC_JP),
        ] {
            let mut decoder = native::Decoder::new(encoding).unwrap();
            for value in 0u32..=0xffffff {
                assert_decode_matches(
                    &[(value >> 16) as u8, (value >> 8) as u8, value as u8],
                    &mut decoder,
                    oracle,
                );
            }
        }
    }

    fn random(state: &mut u64) -> u64 {
        *state ^= *state << 13;
        *state ^= *state >> 7;
        *state ^= *state << 17;
        *state
    }

    #[test]
    fn native_legacy_codecs_match_oracle_for_combined_malformed_and_nul_payloads() {
        for (encoding, oracle) in [
            (LegacyEncoding::ShiftJis, encoding_rs::SHIFT_JIS),
            (LegacyEncoding::EucJp, encoding_rs::EUC_JP),
        ] {
            let mut decoder = native::Decoder::new(encoding).unwrap();
            let mut encoder = native::Encoder::new(encoding).unwrap();
            let mut state = 0x73058bdfcc5aa171;
            let mut valid = Vec::new();
            for value in 0u32..=65535 {
                let bytes = vec![(value >> 8) as u8, value as u8];
                if !oracle.decode_without_bom_handling(&bytes).1 {
                    valid.push(bytes);
                }
            }
            if encoding == LegacyEncoding::EucJp {
                for value in 0u32..=65535 {
                    let bytes = vec![0x8f, (value >> 8) as u8, value as u8];
                    if !oracle.decode_without_bom_handling(&bytes).1 {
                        valid.push(bytes);
                    }
                }
            }
            for case in 0..20_000 {
                let mut bytes = Vec::new();
                for _ in 0..random(&mut state) % 64 {
                    if case % 2 == 0 {
                        bytes.extend(&valid[random(&mut state) as usize % valid.len()]);
                    } else {
                        bytes.push(random(&mut state) as u8);
                    }
                }
                if case % 3 == 0 && !bytes.is_empty() {
                    let index = random(&mut state) as usize % bytes.len();
                    bytes[index] = random(&mut state) as u8;
                }
                if case % 5 == 0 {
                    bytes.pop();
                }
                if case % 7 == 0 {
                    bytes.push(0);
                }
                assert_decode_matches(&bytes, &mut decoder, oracle);
                if let Ok(text) = decoder.decode(&bytes) {
                    assert_encode_matches(&text, &mut encoder, oracle);
                }
            }
            let encodable: Vec<char> = (0..=0x10ffff)
                .filter_map(char::from_u32)
                .filter(|c| !oracle.encode(c.encode_utf8(&mut [0; 4])).2)
                .collect();
            for case in 0..20_000 {
                let mut text = String::new();
                for _ in 0..random(&mut state) % 64 {
                    text.push(if case % 5 == 0 {
                        char::from_u32((random(&mut state) % 0x110000) as u32).unwrap_or('😀')
                    } else {
                        encodable[random(&mut state) as usize % encodable.len()]
                    });
                }
                if case % 11 == 0 {
                    text.push('\0');
                }
                assert_encode_matches(&text, &mut encoder, oracle);
            }
        }
    }

    #[test]
    fn native_legacy_codecs_preserve_ten_mib_documents() {
        for (encoding, oracle) in [
            (LegacyEncoding::ShiftJis, encoding_rs::SHIFT_JIS),
            (LegacyEncoding::EucJp, encoding_rs::EUC_JP),
        ] {
            let sample = "①②③㈱髙﨑纊 ～－∥￠￡￢\0\r\n";
            let (unit, _, bad) = oracle.encode(sample);
            assert!(!bad);
            let repetitions = 10 * 1024 * 1024 / unit.len();
            let text = sample.repeat(repetitions);
            let bytes = unit.repeat(repetitions);
            // Exercise the public operation boundary as well as its codec.
            assert_eq!(encode(&text, encoding).unwrap(), bytes);
            assert_eq!(decode(&bytes, encoding).unwrap(), text);
        }
    }

    #[test]
    fn native_legacy_codecs_preserve_windows_aliases_jis0212_and_embedded_nul() {
        for (encoding, oracle) in [
            (LegacyEncoding::ShiftJis, encoding_rs::SHIFT_JIS),
            (LegacyEncoding::EucJp, encoding_rs::EUC_JP),
        ] {
            for text in ["日本語\0ASCII", "①②③㈱髙﨑纊塚", "¥\\‾~−"] {
                let original = text.to_string();
                let (expected, _, bad) = oracle.encode(text);
                assert!(!bad);
                assert_eq!(encode(text, encoding).unwrap(), expected.as_ref());
                let bytes = expected.into_owned();
                let before = bytes.clone();
                let (decoded, bad) = oracle.decode_without_bom_handling(&bytes);
                assert!(!bad);
                assert_eq!(decode(&bytes, encoding).unwrap(), decoded);
                assert_eq!(bytes, before);
                assert_eq!(text, original);
            }
        }
        assert_eq!(
            decode(&[0x8f, 0xa2, 0xaf, 0x8f, 0xa2, 0xb7], LegacyEncoding::EucJp).unwrap(),
            "˘～"
        );
        assert_eq!(decode(&[0x80], LegacyEncoding::ShiftJis).unwrap(), "\u{80}");
    }

    #[test]
    fn native_legacy_codecs_reject_malformed_bytes_and_unmappable_source() {
        for bytes in [&[0x81, 0x7f][..], &[0x81], &[0xff], &[0x85, 0x40]] {
            assert_eq!(
                decode(bytes, LegacyEncoding::ShiftJis),
                Err(CodecError::InvalidInput)
            );
        }
        for bytes in [&[0x8e, 0x21][..], &[0xa4, 0x22], &[0x8f, 0xa2], &[0xff]] {
            assert_eq!(
                decode(bytes, LegacyEncoding::EucJp),
                Err(CodecError::InvalidInput)
            );
        }
        for encoding in [LegacyEncoding::ShiftJis, LegacyEncoding::EucJp] {
            for text in ["本文😀", "〜", "¢", "\u{e000}", "\u{feff}"] {
                assert!(encode(text, encoding).is_err(), "{encoding:?} {text:?}");
            }
        }
    }
}
