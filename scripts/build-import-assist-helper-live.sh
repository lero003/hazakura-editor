#!/usr/bin/env bash
# Build Import Assist helper in **live** mode (PDFKit + Vision, no FIXTURE_MODE).
# Copies into binaries/ so Tauri dev can resolve a non-fixture helper.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/import-assist"
OUT_DIR="$REPO_ROOT/binaries"

mkdir -p "$OUT_DIR"
cd "$HELPER_DIR"

echo "==> swift build -c release (import-assist live / PDFKit + Vision)"
swift build -c release

BUILT="$HELPER_DIR/.build/release/HazakuraImportAssist"
if [ ! -x "$BUILT" ]; then
    echo "error: build did not produce $BUILT" >&2
    exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
    arm64)   TRIPLE="aarch64-apple-darwin" ;;
    x86_64)  TRIPLE="x86_64-apple-darwin"  ;;
    *)
        echo "error: unsupported arch: $ARCH" >&2
        exit 1
        ;;
esac

DEST="$OUT_DIR/hazakura-import-assist-helper-$TRIPLE"
cp "$BUILT" "$DEST"
chmod +x "$DEST"
echo "==> wrote $DEST (live)"

printf '%s\n' '{"action":"probe"}' | "$DEST" | tee /tmp/import-assist-live-probe.json
if grep -q '"fixture":true' /tmp/import-assist-live-probe.json; then
    echo "error: live build still reports fixture=true" >&2
    exit 1
fi
echo "==> import-assist live helper ok"
