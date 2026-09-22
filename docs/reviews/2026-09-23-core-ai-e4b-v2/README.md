# Core AI E4B v2 外部レビュー資料

Status: Source / local-model review candidate; distribution acceptance pending
Scope: Gemma 4 E4B re-export, per-token PLE runtime, proofread preservation, asset identity
Last reviewed: 2026-09-23

## 判定をお願いしたい範囲

旧E4Bの日本語崩れに対して、固定QAT checkpointからdecoderを再変換し、PLEを
tokenごとにhostから渡すv2を作成した。Rust catalog / Swift helper / local contract / asset
manifestを一つのruntime kind `coreai-kit-gemma4-ple-provider`で接続した。
sourceとローカル実モデル評価のレビューをお願いしたい。16 GB実機・Apple-hosted・
TestFlight・公開承認はこの資料の合格範囲に含めない。

## 原因の切り分け

同じ日本語校正入力で、旧static PLE graphは`資料は三部用意しきてらい`、`涼いしい風`、
`読読会`のような語中崩れを生出力で返した。元checkpointのeager実行、PLEだけをint8へ
量子化したeager実行、pipelined eager実行では自然な文を返した。static graphはdecoderを
int8やfp16へ変えても崩れが残り、provider型Core AI graphで消えた。
この比較はstatic table graph経路を主因とする**ローカル実験からの推論**であり、
上流の内部実装の根本原因を証明したものではない。EOS設定だけの変更は以前の18件で
byte一致し、改善策から外した。

## v2 identity と実装

- 元checkpoint: `google/gemma-4-E4B-it-qat-q4_0-unquantized@476025a01dbf99361c062bbeca3d6a76bb4c4566`。
  `model.safetensors`は15,882,477,468 bytes、SHA-256 `ad8ef515194b15ab13b6f98d54d37652b691c9a2c787cdf7ed5f951f5ed2c7fa`。
- 変換コード: `coreai-model-zoo@347393ede35fd25e9e59203dba562e5ee4d268bb`。
  `coreai-core 1.0.0b2`、`coreai-torch 0.4.1`、`coreai-opt 0.2.1`、`torch 2.9.0`。
  [`reexport-core-ai-e4b-v2.mjs`](../../../scripts/reexport-core-ai-e4b-v2.mjs)はofflineのpinを照合する。
- PLE: [`generate-core-ai-e4b-v2-tables.py`](../../../scripts/generate-core-ai-e4b-v2-tables.py)で元checkpointから
  per-row int8 symmetric absmaxへ変換。`embed_per_layer.i8`、scale、`meta.json`を別の空ディレクトリへ
  再生成し、3件とも固定SHA-256と一致した。
- decoder: symmetric int4lin、`--max-ctx 4096`、static table埋め込みなし。
  全11入力ファイルのpath/size/SHA-256は
  [`core-ai-production-models.json`](../../../scripts/core-ai-production-models.json)に固定。
- helper: pinned `coreai-kit@bebe09a050c144034c169af2074fda47fb7ba326`へ
  [`core-ai-kit-gemma-provider.patch`](../../../scripts/patches/core-ai-kit-gemma-provider.patch)を適用。
  PLE行をmmapで読み、scale、寸法、実ファイル長、bundle語彙数を検査する。
- 契約: productionはlicense/notice/期待model IDを維持。localはRust/Swift共通fixtureを使い、
  provider型では追加で`tables/meta.json`を要求する。cache署名にもmeta内容を含める。
- catalog: v2 ID `apple:core-ai:gemma-4-e4b-it-int4-provider-v2`、asset pack ID
  `hazakura-coreai-gemma4-e4b-v2`、version `2026.09.22.1`。Apple側で未処理のため
  `not_published`を返し、起動時監視とdownloadを始めない。

## ローカル検証

- 元checkpointからのPLE再生成: 3ファイルのSHA-256一致。
- 配布helperのarm64 / x86_64 build成功。最終arm64 helperのSHA-256は
  `be70507ba51ff4ad7441d6acdfec3f987a6dc6b1bf7dfe11861cde1dd298f043`。
  実モデルの6 fixture×3回とhelper停止・再起動後の再依頼は全19結果で機械チェック成功。
  日本語短文、実機報告文、Markdown、引用を含む。停止試験はUIキャンセル操作の検証ではない。
- 既存18結果も最終promptで全件機械チェック成功。旧版で落ちた引用の`> `と本文を保持した。
  校正でraw出力が漢数字を算用数字へ変える例は残るため、候補採用前に元文へ戻す。
  機械チェックはhelperの整形・保護後候補が対象で、`rawCandidateText`は別記録。
  これはモデル生出力の文章品質合格ではない。
- Swift XCTest 66件 + Swift Testing 4件、Rust 457件（2 ignored）、frontend 2,686件、
  scripts 31件、型検査、Vite build、App Store surface 132件が成功。
  これらはローカル証跡でCIの独立確認ではない。
- v2 `.aar`をローカル生成。5,519,729,626 bytes、SHA-256
  `74b864c22c21a697ce63713e27d44c0a1261f06eb7bb506041a3975d2a962e1e`。
  展開後resourceは14ファイル、6,808,842,583 bytes。runtime pinは
  [`gemma4-e4b-resource-manifest.json`](../../../src-tauri/resources/core-ai/gemma4-e4b-resource-manifest.json)。
- `git diff --check`は保存した`.patch`内の空白context行を末尾空白として報告する。
  patch以外の差分は同チェックを通過し、patchは固定依存checkoutへの新規適用と逆適用を確認した。

## レビュー観点と残ゲート

- provider callbackの行番号、Float16変換、mmap寿命・同時実行・異常入力での挙動。
- production/localのruntime kind、`meta.json`検証、cache失効、旧v1選択の復元。
- 未配布catalog行の表示・download拒否、v2 pack IDとmanifestの完全一致。
- 校正の数値表記保護が必要な修正を過剰に捨てないか、引用promptが他の書き換えを弱めないか。
- 16 GB Macのpeak memory / swap / 初回specialize / 長文品質とcancel後再生成、
  `coreai-build` AOT、Apple側processing、signed app / Internal TestFlight、VoiceOverは未確認。
  この`.aar`はuploadしておらず、`releaseEligible`はfalseのまま。
