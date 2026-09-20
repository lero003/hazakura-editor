use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    #[cfg(target_os = "macos")]
    build_background_assets_bridge();
    tauri_build::build();
}

#[cfg(target_os = "macos")]
fn build_background_assets_bridge() {
    let output_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR"));
    let source = PathBuf::from("native/background_assets_bridge.m");
    let object = output_dir.join("background_assets_bridge.o");
    let archive = output_dir.join("libhazakura_background_assets.a");
    let module_cache = output_dir.join("clang-module-cache");
    let target = env::var("TARGET").expect("TARGET");
    let clang_target = if target.starts_with("aarch64-") {
        "arm64-apple-macos26.0"
    } else if target.starts_with("x86_64-") {
        "x86_64-apple-macos26.0"
    } else {
        panic!("Unsupported macOS target for Background Assets bridge: {target}");
    };

    println!("cargo:rerun-if-changed={}", source.display());
    run(
        Command::new("xcrun").args([
            "clang",
            "-target",
            clang_target,
            "-fobjc-arc",
            "-fblocks",
            "-fmodules",
            &format!("-fmodules-cache-path={}", module_cache.display()),
            "-Werror",
            "-c",
            source.to_str().expect("bridge source path"),
            "-o",
            object.to_str().expect("bridge object path"),
        ]),
        "compile Background Assets bridge",
    );
    run(
        Command::new("xcrun").args([
            "libtool",
            "-static",
            "-o",
            archive.to_str().expect("bridge archive path"),
            object.to_str().expect("bridge object path"),
        ]),
        "archive Background Assets bridge",
    );

    println!("cargo:rustc-link-search=native={}", output_dir.display());
    println!("cargo:rustc-link-lib=static=hazakura_background_assets");
    println!("cargo:rustc-link-lib=framework=BackgroundAssets");
    println!("cargo:rustc-link-lib=framework=Foundation");
}

#[cfg(target_os = "macos")]
fn run(command: &mut Command, description: &str) {
    let status = command
        .status()
        .unwrap_or_else(|error| panic!("Failed to {description}: {error}"));
    assert!(status.success(), "Failed to {description}: {status}");
}
