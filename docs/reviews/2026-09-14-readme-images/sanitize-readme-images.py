#!/usr/bin/env python3
"""README 用スクリーンショットの公開処理（2026-09-14）。

`.hazakura/private/app-store-v3-captures-2026-09-13/` の native キャプチャ
（2026-09-13 撮影・ベース HEAD `d01a82b5`・App Store surface の QA ビルド）から、
公開用にローカル絶対パスと一時的な状態メッセージだけを除去した版を作り、
`docs/images/v3-*.png` へ書き出す。

除去は「塗りつぶし」ではなく、同一画像内の内容のない帯からの複製で行う:
- 01 / 07: エディタ下端のパス表示バー帯（ユーザーホーム配下の絶対パス + コピーアイコン, x283-858,
  y769-784）を、同じバーの空の帯（y766-769）から複製して置き換える。
  （y766 は下の本文、y785 はステータス上端の罫線なので含めない。）
- 01 / 03: ステータスバー左の一時メッセージ「タブを閉じました」を、
  ステータスバーの背景色で置き換える。
- 07: 同「タブにフォーカスしました」を背景色で置き換える。

実行: uv run --quiet --with pillow python sanitize-readme-images.py
"""

from pathlib import Path
from shutil import copyfile

from PIL import Image

SRC = Path(".hazakura/private/app-store-v3-captures-2026-09-13")
DST = Path("docs/images")

# パス表示バー帯の置き換え範囲（01/02 系の main window 1280x820 共通座標）
PATH_BAR = {"x0": 283, "x1": 858, "y0": 769, "y1": 784, "src_rows": [766, 767, 768, 769]}


def patch_from_clean_rows(im, spec):
    """対象帯を、同じ画像内の空の行から複製して置き換える。"""
    px = im.load()
    for y in range(spec["y0"], spec["y1"] + 1):
        sy = spec["src_rows"][(y - spec["y0"]) % len(spec["src_rows"])]
        for x in range(spec["x0"], spec["x1"] + 1):
            px[x, y] = px[x, sy]


def fill(im, x0, x1, y0, y1, color):
    px = im.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[x, y] = color


def sanitize_01(im):
    patch_from_clean_rows(im, PATH_BAR)
    # ステータスバー「タブを閉じました」（背景 246,247,244 は面内で一様）
    fill(im, 6, 104, 794, 812, (246, 247, 244))


def sanitize_03(im):
    fill(im, 6, 104, 794, 812, (246, 247, 244))


def sanitize_07(im):
    patch_from_clean_rows(im, PATH_BAR)
    # ステータスバー「タブにフォーカスしました」（背景 250,242,240）
    fill(im, 6, 146, 794, 812, (250, 242, 240))


JOBS = [
    ("01-editor-preview-light.png", "v3-editor-preview.png", sanitize_01),
    ("02-l-mode-light.png", "v3-l-mode.png", None),
    ("03-reader-spread-light.png", "v3-reader-spread.png", sanitize_03),
    ("04-review-unsaved-diff-light.png", "v3-diff-review.png", None),
    ("06-themes-and-writing-light.png", "v3-themes.png", None),
    ("07-editor-preview-edohigan.png", "v3-edohigan.png", sanitize_07),
    ("10-local-assist-review-edohigan.png", "v3-local-assist-review.png", None),
]


def main():
    DST.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name, fn in JOBS:
        src = SRC / src_name
        dst = DST / dst_name
        if fn is None:
            copyfile(src, dst)
        else:
            im = Image.open(src).convert("RGB")
            fn(im)
            im.save(dst)
        print(f"{src_name} -> {dst} ({dst.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
