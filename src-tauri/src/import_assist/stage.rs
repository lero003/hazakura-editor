//! Stage user-selected import files into the app container temp dir
//! before nested-helper access (Q-IMP-2).
//!
//! The main process holds security-scoped access to the user pick;
//! the nested import helper only inherits App Sandbox. Copying into
//! container temp keeps OCR / PDFKit paths readable under TestFlight.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static STAGE_COUNTER: AtomicU64 = AtomicU64::new(1);

/// RAII staged copy. Deletes the temp file on drop (best-effort).
pub struct StagedImportFile {
    path: PathBuf,
}

impl StagedImportFile {
    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for StagedImportFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn staging_dir() -> PathBuf {
    std::env::temp_dir().join("hazakura-import-assist-stage")
}

/// Copy `source` into app-container temp and return a guard path for helpers.
pub fn stage_import_source_for_helper(source: &Path) -> Result<StagedImportFile, String> {
    let meta = fs::metadata(source).map_err(|e| format!("Cannot read import file: {e}"))?;
    if !meta.is_file() {
        return Err("Import path is not a regular file.".to_string());
    }

    let dir = staging_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create import staging dir: {e}"))?;

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .filter(|e| !e.is_empty())
        .unwrap_or_else(|| "bin".to_string());

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let seq = STAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let name = format!("stage-{}-{}-{}.{}", std::process::id(), stamp, seq, ext);
    let dest = dir.join(name);

    fs::copy(source, &dest)
        .map_err(|e| format!("Cannot stage import file for on-device processing: {e}"))?;

    Ok(StagedImportFile { path: dest })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn stages_copy_and_cleans_up_on_drop() {
        let dir = std::env::temp_dir();
        let source = dir.join(format!("hazakura-stage-src-{}.png", std::process::id()));
        {
            let mut f = fs::File::create(&source).expect("create");
            f.write_all(b"\x89PNG\r\n\x1a\nfake").expect("write");
        }

        let staged_path = {
            let staged = stage_import_source_for_helper(&source).expect("stage");
            let path = staged.path().to_path_buf();
            assert!(path.exists());
            assert_ne!(path, source);
            let bytes = fs::read(&path).expect("read staged");
            assert_eq!(bytes, b"\x89PNG\r\n\x1a\nfake");
            path
        };

        assert!(
            !staged_path.exists(),
            "staged file should be removed on drop"
        );
        let _ = fs::remove_file(&source);
    }
}
