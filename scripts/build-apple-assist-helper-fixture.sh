#!/usr/bin/env bash
# Build the Apple Local Assist helper in fixture mode.
#
# Fixture mode skips the FoundationModels binding and returns
# canned candidate JSON. This is the build flavor that:
#   * the Rust integration test loop uses
#   * non-Apple-Silicon contributors can build
#   * CI uses on macOS runners without Apple Intelligence
#
# Live mode (no -DFIXTURE_MODE) is a separate concern that
# Slice 5+ will validate against a real Apple Silicon Mac with
# Apple Intelligence enabled. Until then, fixture mode is the
# only end-to-end-tested helper build.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/apple-assist"
OUT_DIR="$REPO_ROOT/binaries"

if [ ! -d "$HELPER_DIR" ]; then
    echo "error: helper package not found at $HELPER_DIR" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

echo "==> swift build (fixture mode)"
cd "$HELPER_DIR"
# The Package.swift triggers FIXTURE_MODE in .debug configuration.
swift build -c debug

BUILT="$HELPER_DIR/.build/debug/HazakuraAppleAssist"
if [ ! -x "$BUILT" ]; then
    echo "error: build did not produce $BUILT" >&2
    exit 1
fi

# Tauri sidecar naming convention: <name>-<rust-target-triple>
ARCH="$(uname -m)"
case "$ARCH" in
    arm64)   TRIPLE="aarch64-apple-darwin" ;;
    x86_64)  TRIPLE="x86_64-apple-darwin"  ;;
    *)
        echo "error: unsupported arch: $ARCH" >&2
        exit 1
        ;;
esac

DEST="$OUT_DIR/hazakura-apple-assist-helper-$TRIPLE"
cp "$BUILT" "$DEST"
chmod +x "$DEST"
echo "==> wrote $DEST"

# Quick smoke: send one probe + one generate request, expect
# JSON envelopes back. The script exits non-zero if either
# response does not look right.
echo "==> smoke test"
SMOKE_OUTPUT="$(printf '%s\n%s\n' \
    '{"action":"probe_availability"}' \
    '{"action":"generate_candidate","operation":"summarize","selectedText":"hello"}' \
    | "$DEST")"

if ! grep -q '"kind":"availability"' <<<"$SMOKE_OUTPUT"; then
    echo "smoke test failed: no availability envelope" >&2
    echo "got: $SMOKE_OUTPUT" >&2
    exit 1
fi

if ! grep -q '"kind":"candidate"' <<<"$SMOKE_OUTPUT"; then
    echo "smoke test failed: no candidate envelope" >&2
    echo "got: $SMOKE_OUTPUT" >&2
    exit 1
fi

if ! grep -q '【要約案】' <<<"$SMOKE_OUTPUT"; then
    echo "smoke test failed: summarize prefix missing" >&2
    echo "got: $SMOKE_OUTPUT" >&2
    exit 1
fi

echo "ok"
