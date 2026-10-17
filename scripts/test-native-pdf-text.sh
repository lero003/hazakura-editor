#!/usr/bin/env bash
# Standalone PDFKit bridge acceptance without extra Python packages.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hazakura-native-pdf-test.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
python3 "$REPO_ROOT/scripts/dependency-fixtures/generate-pdf-text.py" "$TEST_DIR/fixtures"
xcrun swift -module-cache-path "$TEST_DIR/swift-module-cache" \
  "$REPO_ROOT/scripts/dependency-fixtures/generate-pdfkit-cases.swift" "$TEST_DIR/fixtures"
xcrun clang -fobjc-arc -fmodules -Werror \
  "-fmodules-cache-path=$TEST_DIR/module-cache" -fsanitize=address \
  "$REPO_ROOT/src-tauri/native/pdf_text_bridge.m" \
  "$REPO_ROOT/src-tauri/native/pdf_text_bridge_test.m" \
  -framework PDFKit -framework Foundation -o "$TEST_DIR/native-pdf-test"
"$TEST_DIR/native-pdf-test" "$TEST_DIR/fixtures"
