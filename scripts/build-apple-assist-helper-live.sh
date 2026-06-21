#!/usr/bin/env bash
# Build the Hazakura Local Assist helper in live Foundation Models mode.
#
# This build does not define FIXTURE_MODE. The resulting sidecar
# links FoundationModels and is bundled by Tauri's externalBin
# path. The smoke check verifies the JSON protocol and
# availability envelope; generation is optional because local
# Apple Intelligence availability can be disabled, downloading,
# or temporarily unavailable.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/apple-assist"
OUT_DIR="$REPO_ROOT/binaries"

if [ ! -d "$HELPER_DIR" ]; then
    echo "error: helper package not found at $HELPER_DIR" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

cd "$HELPER_DIR"

build_arch() {
    local swift_arch="$1"
    local triple="$2"

    echo "==> swift build (live Foundation Models mode, $swift_arch)"
    swift build -c release --arch "$swift_arch"

    local built="$HELPER_DIR/.build/${swift_arch}-apple-macosx/release/HazakuraAppleAssist"
    if [ ! -x "$built" ]; then
        echo "error: build did not produce $built" >&2
        exit 1
    fi

    local dest="$OUT_DIR/hazakura-apple-assist-helper-$triple"
    cp "$built" "$dest"
    chmod +x "$dest"
    echo "==> wrote $dest"
}

build_arch arm64 aarch64-apple-darwin
build_arch x86_64 x86_64-apple-darwin

UNIVERSAL_DEST="$OUT_DIR/hazakura-apple-assist-helper-universal-apple-darwin"
echo "==> lipo universal helper"
lipo -create \
    "$OUT_DIR/hazakura-apple-assist-helper-aarch64-apple-darwin" \
    "$OUT_DIR/hazakura-apple-assist-helper-x86_64-apple-darwin" \
    -output "$UNIVERSAL_DEST"
chmod +x "$UNIVERSAL_DEST"
echo "==> wrote $UNIVERSAL_DEST"

ARCH="$(uname -m)"
case "$ARCH" in
    arm64)   HOST_TRIPLE="aarch64-apple-darwin" ;;
    x86_64)  HOST_TRIPLE="x86_64-apple-darwin"  ;;
    *)
        echo "error: unsupported arch: $ARCH" >&2
        exit 1
        ;;
esac

DEST="$OUT_DIR/hazakura-apple-assist-helper-$HOST_TRIPLE"

echo "==> smoke test (probe)"
PROBE_OUTPUT="$(printf '%s\n' '{"action":"probe_availability"}' | "$DEST")"
if ! grep -q '"kind":"availability"' <<<"$PROBE_OUTPUT"; then
    echo "smoke test failed: no availability envelope" >&2
    echo "got: $PROBE_OUTPUT" >&2
    exit 1
fi
echo "probe: $PROBE_OUTPUT"

if [ "${HAZAKURA_APPLE_ASSIST_LIVE_SMOKE_GENERATE:-0}" = "1" ]; then
    echo "==> smoke test (generate)"
    GENERATE_OUTPUT="$(printf '%s\n' \
        '{"action":"generate_candidate","operation":"rephrase","selectedText":"hello","instruction":"make this natural"}' \
        | "$DEST")"
    if ! grep -Eq '"kind":"(candidate|error)"' <<<"$GENERATE_OUTPUT"; then
        echo "smoke test failed: no candidate/error envelope" >&2
        echo "got: $GENERATE_OUTPUT" >&2
        exit 1
    fi
    echo "generate: $GENERATE_OUTPUT"
fi

echo "ok"
