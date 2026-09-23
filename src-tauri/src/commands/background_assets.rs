use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackgroundAssetSnapshot {
    pub(crate) supported: bool,
    pub(crate) available: bool,
    pub(crate) phase: String,
    pub(crate) progress: Option<f64>,
    pub(crate) path: Option<PathBuf>,
    pub(crate) error: Option<String>,
    pub(crate) asset_pack_version: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct AcceptedResponse {
    accepted: bool,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CancelResponse {
    cancelled: bool,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RemoveResponse {
    removed: bool,
    error: Option<String>,
}

pub(crate) trait BackgroundAssetTransport: Send + Sync {
    fn snapshot(
        &self,
        asset_pack_id: &str,
        relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String>;
    fn start(&self, asset_pack_id: &str) -> Result<(), String>;
    fn cancel(&self, asset_pack_id: &str) -> Result<bool, String>;
    fn remove(&self, asset_pack_id: &str) -> Result<(), String>;
    fn sha256_file(&self, path: &Path) -> Result<String, String>;
}

pub(crate) const LOCAL_PREVIEW_ASSET_ERROR: &str =
    "Apple-hosted model downloads require a TestFlight or App Store build.";

/// A local ad-hoc preview still lists the signed catalog, but must not touch
/// BAAssetPackManager: its shared-manager initialization traps outside the
/// supported Apple-hosted distribution context on macOS 27.
pub(crate) struct LocalPreviewBackgroundAssetTransport;

impl BackgroundAssetTransport for LocalPreviewBackgroundAssetTransport {
    fn snapshot(
        &self,
        _asset_pack_id: &str,
        _relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String> {
        Ok(BackgroundAssetSnapshot {
            supported: false,
            available: false,
            phase: "unsupported".into(),
            progress: None,
            path: None,
            error: Some(LOCAL_PREVIEW_ASSET_ERROR.into()),
            asset_pack_version: None,
        })
    }

    fn start(&self, _asset_pack_id: &str) -> Result<(), String> {
        Err(LOCAL_PREVIEW_ASSET_ERROR.into())
    }

    fn cancel(&self, _asset_pack_id: &str) -> Result<bool, String> {
        Err(LOCAL_PREVIEW_ASSET_ERROR.into())
    }

    fn remove(&self, _asset_pack_id: &str) -> Result<(), String> {
        Err(LOCAL_PREVIEW_ASSET_ERROR.into())
    }

    fn sha256_file(&self, _path: &Path) -> Result<String, String> {
        Err(LOCAL_PREVIEW_ASSET_ERROR.into())
    }
}

pub(crate) struct PlatformBackgroundAssetTransport;

#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use std::ffi::{CStr, CString};
    use std::os::raw::c_char;

    unsafe extern "C" {
        fn hazakura_ba_snapshot(
            asset_pack_id: *const c_char,
            relative_path: *const c_char,
        ) -> *mut c_char;
        fn hazakura_ba_start(asset_pack_id: *const c_char) -> *mut c_char;
        fn hazakura_ba_cancel(asset_pack_id: *const c_char) -> *mut c_char;
        fn hazakura_ba_remove(asset_pack_id: *const c_char) -> *mut c_char;
        fn hazakura_sha256_file(path: *const c_char) -> *mut c_char;
        fn hazakura_free_string(value: *mut c_char);
    }

    fn input(value: &str, field: &str) -> Result<CString, String> {
        CString::new(value).map_err(|_| format!("{field} contains an embedded NUL byte."))
    }

    fn output(value: *mut c_char) -> Result<String, String> {
        if value.is_null() {
            return Err("Background Assets bridge returned no response.".into());
        }
        let text = unsafe { CStr::from_ptr(value) }
            .to_string_lossy()
            .into_owned();
        unsafe { hazakura_free_string(value) };
        Ok(text)
    }

    fn response_error(error: Option<String>, fallback: &str) -> String {
        error
            .filter(|message| !message.trim().is_empty())
            .unwrap_or_else(|| fallback.into())
    }

    impl BackgroundAssetTransport for PlatformBackgroundAssetTransport {
        fn snapshot(
            &self,
            asset_pack_id: &str,
            relative_path: &str,
        ) -> Result<BackgroundAssetSnapshot, String> {
            let asset_pack_id = input(asset_pack_id, "Asset pack id")?;
            let relative_path = input(relative_path, "Asset pack path")?;
            let text = output(unsafe {
                hazakura_ba_snapshot(asset_pack_id.as_ptr(), relative_path.as_ptr())
            })?;
            serde_json::from_str(&text)
                .map_err(|error| format!("Failed to decode Background Assets status: {error}"))
        }

        fn start(&self, asset_pack_id: &str) -> Result<(), String> {
            let asset_pack_id = input(asset_pack_id, "Asset pack id")?;
            let text = output(unsafe { hazakura_ba_start(asset_pack_id.as_ptr()) })?;
            let response: AcceptedResponse = serde_json::from_str(&text).map_err(|error| {
                format!("Failed to decode Background Assets start result: {error}")
            })?;
            if response.accepted {
                Ok(())
            } else {
                Err(response_error(
                    response.error,
                    "Background Assets did not accept the download request.",
                ))
            }
        }

        fn cancel(&self, asset_pack_id: &str) -> Result<bool, String> {
            let asset_pack_id = input(asset_pack_id, "Asset pack id")?;
            let text = output(unsafe { hazakura_ba_cancel(asset_pack_id.as_ptr()) })?;
            let response: CancelResponse = serde_json::from_str(&text).map_err(|error| {
                format!("Failed to decode Background Assets cancel result: {error}")
            })?;
            if let Some(error) = response.error {
                return Err(error);
            }
            Ok(response.cancelled)
        }

        fn remove(&self, asset_pack_id: &str) -> Result<(), String> {
            let asset_pack_id = input(asset_pack_id, "Asset pack id")?;
            let text = output(unsafe { hazakura_ba_remove(asset_pack_id.as_ptr()) })?;
            let response: RemoveResponse = serde_json::from_str(&text).map_err(|error| {
                format!("Failed to decode Background Assets removal result: {error}")
            })?;
            if response.removed {
                Ok(())
            } else {
                Err(response_error(
                    response.error,
                    "Background Assets did not remove the asset pack.",
                ))
            }
        }

        fn sha256_file(&self, path: &Path) -> Result<String, String> {
            let path = input(
                path.to_str()
                    .ok_or_else(|| "Model file path is not valid UTF-8.".to_string())?,
                "Model file path",
            )?;
            let digest = output(unsafe { hazakura_sha256_file(path.as_ptr()) })?;
            match digest.strip_prefix("ERROR:") {
                Some(error) => Err(error.into()),
                None if digest.len() == 64 => Ok(digest),
                None => Err("Background Assets bridge returned an invalid SHA-256 digest.".into()),
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
impl BackgroundAssetTransport for PlatformBackgroundAssetTransport {
    fn snapshot(
        &self,
        _asset_pack_id: &str,
        _relative_path: &str,
    ) -> Result<BackgroundAssetSnapshot, String> {
        Err("Apple-hosted Background Assets are only available on macOS.".into())
    }

    fn start(&self, _asset_pack_id: &str) -> Result<(), String> {
        Err("Apple-hosted Background Assets are only available on macOS.".into())
    }

    fn cancel(&self, _asset_pack_id: &str) -> Result<bool, String> {
        Err("Apple-hosted Background Assets are only available on macOS.".into())
    }

    fn remove(&self, _asset_pack_id: &str) -> Result<(), String> {
        Err("Apple-hosted Background Assets are only available on macOS.".into())
    }

    fn sha256_file(&self, _path: &Path) -> Result<String, String> {
        Err("Apple-hosted Background Assets are only available on macOS.".into())
    }
}
