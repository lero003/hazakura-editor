//! Allowlisted import source paths for Import Assist.
//!
//! Frontend never chooses a helper binary path. Content paths must be
//! absolute, existing regular files, under a size cap, with an
//! allowlisted extension.

use std::fs;
use std::path::Path;

/// Max bytes for a single import source in Phase 1 spike / MVP.
pub const MAX_IMPORT_SOURCE_BYTES: u64 = 40 * 1024 * 1024;

/// Extensions accepted for Import Assist Phase 1.
pub const ALLOWED_IMPORT_EXTENSIONS: &[&str] =
    &["pdf", "png", "jpg", "jpeg", "tif", "tiff", "heic", "heif"];

pub fn is_allowed_import_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lower = ext.to_ascii_lowercase();
            ALLOWED_IMPORT_EXTENSIONS
                .iter()
                .any(|allowed| *allowed == lower)
        })
        .unwrap_or(false)
}

/// Validate a user-selected import path. Returns the canonical-ish path
/// string (as given after absolute check) or an error message.
pub fn validate_import_source_path(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("Import path is empty.".to_string());
    }
    if !path.is_absolute() {
        return Err("Import path must be absolute.".to_string());
    }
    if !is_allowed_import_extension(path) {
        return Err(format!(
            "Unsupported import type. Allowed: {}.",
            ALLOWED_IMPORT_EXTENSIONS.join(", ")
        ));
    }
    let meta = fs::metadata(path).map_err(|_| "Import file not found.".to_string())?;
    if !meta.is_file() {
        return Err("Import path is not a regular file.".to_string());
    }
    if meta.len() > MAX_IMPORT_SOURCE_BYTES {
        return Err(format!(
            "Import file exceeds the {} MB size limit.",
            MAX_IMPORT_SOURCE_BYTES / (1024 * 1024)
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;

    #[test]
    fn allows_pdf_and_common_images() {
        assert!(is_allowed_import_extension(Path::new("/tmp/a.PDF")));
        assert!(is_allowed_import_extension(Path::new("/tmp/a.png")));
        assert!(is_allowed_import_extension(Path::new("/tmp/a.JPEG")));
        assert!(!is_allowed_import_extension(Path::new("/tmp/a.docx")));
        assert!(!is_allowed_import_extension(Path::new("/tmp/a")));
    }

    #[test]
    fn rejects_relative_and_missing() {
        assert!(validate_import_source_path(Path::new("rel.pdf")).is_err());
        assert!(validate_import_source_path(Path::new("/no/such/file-xyz.pdf")).is_err());
    }

    #[test]
    fn accepts_small_temp_pdf_named_file() {
        let dir = std::env::temp_dir();
        let path: PathBuf = dir.join(format!(
            "hazakura-import-assist-test-{}.pdf",
            std::process::id()
        ));
        {
            let mut f = fs::File::create(&path).expect("create temp");
            writeln!(f, "%PDF-1.4 fixture").expect("write");
        }
        let result = validate_import_source_path(&path);
        let _ = fs::remove_file(&path);
        assert!(result.is_ok(), "{result:?}");
    }
}
