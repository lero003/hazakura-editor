#!/usr/bin/env bash
# Build Import Assist helper in fixture mode (debug + FIXTURE_MODE).
# Deterministic PDF/OCR responses for CI and local smoke without Vision.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$REPO_ROOT/src-helpers/import-assist"
OUT_DIR="$REPO_ROOT/binaries"

if [ ! -d "$HELPER_DIR" ]; then
    echo "error: helper package not found at $HELPER_DIR" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

echo "==> swift build (import-assist fixture mode)"
cd "$HELPER_DIR"
swift build -c debug

BUILT="$HELPER_DIR/.build/debug/HazakuraImportAssist"
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
echo "==> wrote $DEST"

# Smoke: probe + extract + ocr against this script as a dummy path file
# (fixture mode only checks existence).
TMP_PDF="$(mktemp /tmp/hazakura-import-XXXXXX.pdf)"
TMP_IMG="$(mktemp /tmp/hazakura-import-XXXXXX.png)"
echo "%PDF-1.4 fixture" > "$TMP_PDF"
# Minimal valid-enough file for existence check; fixture does not decode PNG.
echo "png" > "$TMP_IMG"

echo "==> smoke test"
SMOKE_OUTPUT="$(printf '%s\n%s\n%s\n' \
    '{"action":"probe"}' \
    "{\"action\":\"extract_pdf_text\",\"path\":\"$TMP_PDF\"}" \
    "{\"action\":\"ocr_image\",\"path\":\"$TMP_IMG\",\"languages\":[\"ja-JP\"]}" \
    | "$DEST")"

rm -f "$TMP_PDF" "$TMP_IMG"

echo "$SMOKE_OUTPUT"
echo "$SMOKE_OUTPUT" | grep -q '"kind":"probe"'
echo "$SMOKE_OUTPUT" | grep -q '"kind":"pdf_text"'
echo "$SMOKE_OUTPUT" | grep -q '"kind":"ocr_text"'
echo "$SMOKE_OUTPUT" | grep -q '"fixture":true'
echo "==> import-assist fixture helper smoke ok"
