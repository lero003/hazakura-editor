use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Ad-hoc App Store previews contain the extension for packaging checks,
    // but cannot use Apple-hosted asset packs without distribution context.
    println!("cargo:rerun-if-env-changed=HAZAKURA_BACKGROUND_ASSETS_LOCAL_PREVIEW");
    println!("cargo:rustc-check-cfg=cfg(hazakura_background_assets_local_preview)");
    if env::var("HAZAKURA_BACKGROUND_ASSETS_LOCAL_PREVIEW").as_deref() == Ok("1") {
        println!("cargo:rustc-cfg=hazakura_background_assets_local_preview");
    }
    #[cfg(target_os = "macos")]
    build_background_assets_bridge();
    #[cfg(target_os = "macos")]
    build_foundation_bridge("remote_image", &["Foundation"]);
    #[cfg(target_os = "macos")]
    build_foundation_bridge("pdf_text", &["Foundation", "PDFKit"]);
    tauri_build::build();
}

#[cfg(target_os = "macos")]
fn build_foundation_bridge(name: &str, frameworks: &[&str]) {
    let output_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR"));
    let source = PathBuf::from(format!("native/{name}_bridge.m"));
    let header = PathBuf::from(format!("native/{name}_bridge.h"));
    let object = output_dir.join(format!("{name}_bridge.o"));
    let archive = output_dir.join(format!("libhazakura_{name}.a"));
    let module_cache = output_dir.join("clang-module-cache");
    let target = env::var("TARGET").expect("TARGET");
    let clang_target = if target.starts_with("aarch64-") {
        "arm64-apple-macos26.0"
    } else if target.starts_with("x86_64-") {
        "x86_64-apple-macos26.0"
    } else {
        panic!("Unsupported macOS target for {name} bridge: {target}");
    };
    println!("cargo:rerun-if-changed={}", source.display());
    if header.exists() {
        println!("cargo:rerun-if-changed={}", header.display());
    }
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
            source.to_str().expect("source path"),
            "-o",
            object.to_str().expect("object path"),
        ]),
        &format!("compile {name} bridge"),
    );
    run(
        Command::new("xcrun").args([
            "libtool",
            "-static",
            "-o",
            archive.to_str().expect("archive path"),
            object.to_str().expect("object path"),
        ]),
        &format!("archive {name} bridge"),
    );
    println!("cargo:rustc-link-search=native={}", output_dir.display());
    println!("cargo:rustc-link-lib=static=hazakura_{name}");
    for framework in frameworks {
        println!("cargo:rustc-link-lib=framework={framework}");
    }
}

#[cfg(target_os = "macos")]
fn build_background_assets_bridge() {
    build_foundation_bridge("background_assets", &["BackgroundAssets", "Foundation"]);
}

#[cfg(target_os = "macos")]
fn run(command: &mut Command, description: &str) {
    let status = command
        .status()
        .unwrap_or_else(|error| panic!("Failed to {description}: {error}"));
    assert!(status.success(), "Failed to {description}: {status}");
}
