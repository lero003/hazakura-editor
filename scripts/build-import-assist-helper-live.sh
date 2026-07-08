#!/usr/bin/env bash
# Build Import Assist helper in **live** mode (PDFKit + Vision, no FIXTURE_MODE)
# for both macOS archs + universal, matching Local Assist sidecar layout.
# Tauri externalBin expects: binaries/hazakura-import-assist-helper-<triple>

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/import-assist"
OUT_DIR="$REPO_ROOT/binaries"

if [ ! -d "$HELPER_DIR" ]; then
    echo "error: helper package not found at $HELPER_DIR" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
cd "$HELPER_DIR"

swift_build_with_sandbox_fallback() {
    local swift_arch="$1"
    local log_file
    log_file="$(mktemp "${TMPDIR:-/tmp}/hazakura-swift-build.XXXXXX.log")"

    if swift build -c release --arch "$swift_arch" >"$log_file" 2>&1; then
        cat "$log_file"
        rm -f "$log_file"
        return 0
    fi

    cat "$log_file" >&2

    if grep -q "sandbox_apply: Operation not permitted" "$log_file"; then
        echo "==> retry swift build with --disable-sandbox ($swift_arch)"
        mkdir -p "$HELPER_DIR/.build/clang-module-cache"
        CLANG_MODULE_CACHE_PATH="$HELPER_DIR/.build/clang-module-cache" \
            swift build -c release --arch "$swift_arch" --disable-sandbox
        rm -f "$log_file"
        return 0
    fi

    rm -f "$log_file"
    return 1
}

build_arch() {
    local swift_arch="$1"
    local triple="$2"

    echo "==> swift build (import-assist live, $swift_arch)"
    swift_build_with_sandbox_fallback "$swift_arch"

    local built="$HELPER_DIR/.build/${swift_arch}-apple-macosx/release/HazakuraImportAssist"
    if [ ! -x "$built" ]; then
        # Fallback path used by some SwiftPM layouts.
        built="$HELPER_DIR/.build/release/HazakuraImportAssist"
    fi
    if [ ! -x "$built" ]; then
        echo "error: build did not produce HazakuraImportAssist for $swift_arch" >&2
        exit 1
    fi

    local dest="$OUT_DIR/hazakura-import-assist-helper-$triple"
    cp "$built" "$dest"
    chmod +x "$dest"
    echo "==> wrote $dest"
}

build_arch arm64 aarch64-apple-darwin
build_arch x86_64 x86_64-apple-darwin

UNIVERSAL_DEST="$OUT_DIR/hazakura-import-assist-helper-universal-apple-darwin"
echo "==> lipo universal helper"
lipo -create \
    "$OUT_DIR/hazakura-import-assist-helper-aarch64-apple-darwin" \
    "$OUT_DIR/hazakura-import-assist-helper-x86_64-apple-darwin" \
    -output "$UNIVERSAL_DEST"
chmod +x "$UNIVERSAL_DEST"
echo "==> wrote $UNIVERSAL_DEST"

printf '%s\n' '{"action":"probe"}' | "$OUT_DIR/hazakura-import-assist-helper-aarch64-apple-darwin" \
    | tee /tmp/import-assist-live-probe.json
if grep -q '"fixture":true' /tmp/import-assist-live-probe.json; then
    echo "error: live build still reports fixture=true" >&2
    exit 1
fi
echo "==> import-assist live helper ok"
