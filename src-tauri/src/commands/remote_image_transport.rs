//! The macOS transport owns TLS in Foundation. Validation and image decoding
//! stay in images.rs; no renderer URL can bypass those checks.

pub(super) struct RemoteImageResponse {
    pub status: u16,
    pub final_url: String,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

#[cfg(target_os = "macos")]
pub(super) fn fetch(url: &str, limit: u64) -> Result<RemoteImageResponse, String> {
    use std::ffi::{c_char, CStr, CString};

    #[repr(C)]
    struct NativeResult {
        bytes: *mut u8,
        length: usize,
        status: u16,
        content_type: *mut c_char,
        final_url: *mut c_char,
        error: *mut c_char,
    }
    extern "C" {
        fn hz_remote_image_fetch(url: *const c_char, limit: usize, result: *mut NativeResult);
        fn hz_remote_image_result_free(result: *mut NativeResult);
    }
    impl Drop for NativeResult {
        fn drop(&mut self) {
            // The bridge allocated these fields and accepts null fields.
            unsafe { hz_remote_image_result_free(self) };
        }
    }
    fn string(pointer: *const c_char) -> Result<String, String> {
        if pointer.is_null() {
            return Ok(String::new());
        }
        // All bridge strings are owned, NUL-terminated UTF-8 until Drop.
        unsafe { CStr::from_ptr(pointer) }
            .to_str()
            .map(str::to_owned)
            .map_err(|_| "Remote image transport returned invalid UTF-8.".to_string())
    }

    let url = CString::new(url).map_err(|_| "Remote image URL contains NUL.".to_string())?;
    let limit = usize::try_from(limit).map_err(|_| "Remote image limit is invalid.".to_string())?;
    let mut result = NativeResult {
        bytes: std::ptr::null_mut(),
        length: 0,
        status: 0,
        content_type: std::ptr::null_mut(),
        final_url: std::ptr::null_mut(),
        error: std::ptr::null_mut(),
    };
    unsafe { hz_remote_image_fetch(url.as_ptr(), limit, &mut result) };
    if !result.error.is_null() {
        return Err(string(result.error)?);
    }
    if result.length > limit || (result.length != 0 && result.bytes.is_null()) {
        return Err("Remote image transport returned an invalid body.".to_string());
    }
    let bytes = if result.length == 0 {
        Vec::new()
    } else {
        unsafe { std::slice::from_raw_parts(result.bytes, result.length) }.to_vec()
    };
    Ok(RemoteImageResponse {
        status: result.status,
        final_url: string(result.final_url)?,
        content_type: string(result.content_type)?,
        bytes,
    })
}

#[cfg(not(target_os = "macos"))]
pub(super) fn fetch(_url: &str, _limit: u64) -> Result<RemoteImageResponse, String> {
    Err("Remote image transport is available only on macOS.".to_string())
}
