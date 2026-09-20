# Core AI Production Model Preparation

Status: Operational preparation
Scope: v3.1 Core AI production candidates and Apple-hosted asset preparation
Authority: High
Last reviewed: 2026-09-21

## Decision

Hazakura Local Assistの最初の本番候補は、同じGemma 4 QAT系から次の二つに固定する。
これは配布物を再現可能に作るためのidentity lockであり、製品catalogへの公開承認ではない。

| Lane | Model ID | Target | Locked converted artifact | Expanded model bytes |
| --- | --- | --- | --- | ---: |
| Standard | `apple:core-ai:gemma-4-e4b-it-int4-v1` | 16 GB Macでの受入候補 | `mlboydaisuke/gemma-4-E4B-CoreAI@e9ba305a91bf3e62ea83d5652b572b69913c433a` | 6,807,926,119 |
| Quality comparison | `apple:core-ai:gemma-4-12b-it-int8-v1` | 32 GB以上で先行評価 | `mlboydaisuke/Gemma-4-12B-CoreAI@266c04582d62be179cfbb04d45260c87dc648eec` | 14,698,417,429 |

完全なfile path、byte size、SHA-256、source revision、runtime kind、asset pack IDは
[`scripts/core-ai-production-models.json`](../scripts/core-ai-production-models.json)を機械正本とする。
URLの`main`や可変tagは使わない。Developer用Qwen fixtureは引き続き本番候補に含めない。

## Trust and provenance boundary

- 元checkpointはGoogleのGemma 4 QATモデル。lockには元revisionも記録する。
- 現時点のCore AI変換物とGemma 4 runtimeはcommunity実装を利用する。Apple公式
  `coreai-models`の現在のcatalogにはGemma 4 adapterがないため、Apple公式対応済みとは表現しない。
- product helperは`john-rocky/coreai-kit`をcommit SHAで固定し、その依存graphを
  `src-helpers/apple-assist/CoreAIProduction.Package.resolved`へ分離した。Developer Qwen testは
  Apple公式`coreai-models` lockを維持する。
- model archiveにはApache-2.0本文とrevision付きprovenance noticeを含める。E4Bの変換repoは
  model cardでApache-2.0を示し、独立LICENSEはない。12Bはmodel cardがApache-2.0を示す一方、
  固定revision内の`LICENSE`は旧Gemma Terms表記のままで矛盾するため、その原文も
  `UPSTREAM-CONVERSION-LICENSE.txt`として保存する。外部TestFlight前に権利・noticeを人手で
  再確認し、どちらの候補も現時点では`manual-review-required`とする。
- GGUFからの逆変換、任意URL/path、製品内変換、cloud fallbackは採用しない。

## Conversion record

`scripts/core-ai-production-models.json`には、固定した`coreai-model-zoo` revisionで確認した
community export commandも保存する。E4BはQAT checkpointからPLE tableを抽出した後、
`int4lin --tbl --max-ctx 4096`でdecode bundleを作る。12Bは`int8lin --metal-sdpa
--max-ctx 4096`で、16-head full-attention向けcustom Metal kernelを含むbundleを作る。
両方ともpipelined S=1 graphなので`COREAI_CHUNK_THRESHOLD=1`が必要だが、今回固定した
CoreAIKit runtimeがengine生成前に設定する。12BのHazakura loaderは`.pipelined`を明示する。

今回の`.aar`は、communityが公開した変換済みartifactをimmutable revisionとfile SHA-256で
再取得・検証して作る。Hazakura自身による元checkpointからのfull re-exportはまだ実行しておらず、
lockの`conversion.hazakuraReexported`も`false`である。community exporterは変換結果のbyte一致を
保証せず、元checkpoint revisionを直接受け取る引数もない。そのためclean re-export時は、lockした
source revisionを先にローカルcacheへ解決してoffline化し、recipeの数値gateと`zoo_verify.py`で
評価する。この未実施を、変換を独立再現済みとは扱わない。

## Reproducible preparation

Xcode 27と、Apple公式例のJSON manifestを受け付ける`xcrun ba-package`が利用できるMacで実行する。
出力は巨大かつ再生成可能なので`.hazakura/coreai-production/`へ置き、Gitには含めない。

```bash
npm run coreai:models:plan
npm run coreai:models:download -- --model=gemma4-e4b
npm run coreai:models:package -- --model=gemma4-e4b

npm run coreai:models:download -- --model=gemma4-12b
npm run coreai:models:package -- --model=gemma4-12b
```

一括処理は次のとおり。中断したdownloadは`.partial`からresumeする。
`aria2c`が利用可能なら固定URLを8 rangeで取得し、無い環境では`curl`へ自動fallbackする。
どちらも完了後のsize / SHA-256 gateは同一。

```bash
npm run coreai:models:prepare -- --model=gemma4-e4b
```

各モデルの出力:

```txt
.hazakura/coreai-production/<key>/<catalog-version>/
├── stage/CoreAIModels/<storage-directory>/
│   ├── hazakura-model.json
│   ├── hazakura-resource-manifest.json
│   ├── LICENSE-APACHE-2.0.txt
│   ├── THIRD_PARTY_MODEL_NOTICE.md
│   └── <verified Core AI resources>
├── manifests/
│   ├── resource-manifest.json
│   └── background-assets-manifest.json
└── archives/
    ├── <asset-pack-id>.aar              # package成功時だけ
    ├── archive.json                     # package成功時だけ
    ├── UPLOAD-INSTRUCTIONS.md           # package成功時だけ
    └── PACKAGING-BLOCKED.md             # toolchainが拒否した場合
```

`download`はpinned revisionから取得し、全ファイルのsizeとSHA-256を照合してからstageへ移す。
`package`は展開後resource manifestを再生成・再検証し、version rootをworking directoryとして
相対pathで`ba-package evaluate manifests/background-assets-manifest.json`を通す。その後、Appleの
公式例と同じdefault package形式（`ba-package manifests/background-assets-manifest.json -o
archives/<asset-pack-id>.aar`）で`.aar`を作る。`archive.json`には最終archiveのsize、SHA-256、
残release blockerを記録する。

### 2026-09-21 host toolchain result

この作業ホストのXcode 27.0（27A266a）に含まれる`ba-package 2.0`は、Apple公式手順どおりの
`Manifest.json`と、このリポジトリが生成した`.json`の双方を、`path extension isn’t “json”`として
引数検証時に拒否する。41 byte fixtureで次を独立比較した。

| 入力 | 相対path | 絶対path |
| --- | --- | --- |
| `template -o <json>` | exit 64 | 対象外 |
| `template --output-path <json>` | exit 64 | 対象外 |
| `evaluate <json>` | exit 64 | exit 64 |
| default package `<json> -o <aar>` | exit 64 | exit 64 |
| `package <json> -o <aar>` | exit 64 | exit 64 |
| `package <json> --output-path <aar>` | exit 64 | exit 64 |

`template`のstdout出力だけは成功するが、Apple自身のtemplateを`template -o apple-template.json`で
保存する入口も同じエラーになる。したがって、absolute-path処理、`-o`の別名、`package`
サブコマンドの世代差、Hazakura manifest内容のいずれでもなく、このtoolchainのpath-extension
検証不具合と判断する。検証済みstageとmanifestまでは保持するが、別形式の偽`.aar`は作らない。
失敗内容はモデル別`archives/PACKAGING-BLOCKED.md`へ残す。修正版toolchainで同じ
`npm run coreai:models:package`を再実行し、成功後だけ`.aar`をupload対象とする。
`npm run coreai:ba-package:reproduce`は全比較をJSON reportへ残す。

## Locked Apple-hosted asset pack IDs

| Model | Asset pack ID |
| --- | --- |
| Gemma 4 E4B | `dev.hazakura.editor.coreai.gemma4-e4b.v1` |
| Gemma 4 12B | `dev.hazakura.editor.coreai.gemma4-12b.v1` |

App Store Connect側のrecordとコード側のcatalogはこの完全一致を必須とする。既存IDの中身を
差し替えず、model revisionまたはpayloadを変える場合は新しいimmutable IDとcatalog versionを使う。
検証済みstageは合計21,506,358,713 bytes。2026-09-20時点の
[Apple-hosted asset pack size limits](https://developer.apple.com/help/app-store-connect/reference/app-uploads/apple-hosted-asset-pack-size-limits)は
アプリ全体で200 GB / 200 asset packsのため名目上は枠内だが、`.aar`の実サイズ、upload、Apple処理を
確認した証跡ではない。

## Activation gates

2026-09-21から、内部TestFlightでCDN経路を受け入れるためApp StoreレーンだけE4Bをcatalogへ
接続した。Developerレーンは引き続き空で、12Bは公開しない。以下は正式リリースまでのgateであり、
catalog entryの存在だけを出荷承認として扱わない。

1. `coreai-build`を含むAppleのAOT toolchainを入手し、対象Mac向け`.aimodelc`を作成・再lockする。
2. Standard/quality候補を日本語原稿で比較し、16 GB / 32 GBの対象機でload、初回specialize、
   peak memory、生成品質、cancel後の再開を受け入れる。
3. **実装済み、TestFlight受入待ち:** G1としてSettingsとLocal Assist窓をmodel-state eventで同期する。
4. **実装済み、TestFlight受入待ち:** G2としてsigned manifest、safe path、size、全SHA-256検証後だけ`Ready`にする。
5. **source実装済み、署名profile待ち:** Background Download extension、shared App Group、`BA*` keys、
   `AssetPackManager` transportを同じbuild形へ接続する。
6. App Store Connectへ`.aar`をuploadしてApple処理完了を確認し、そのpackを使う同一buildを
   internal TestFlightの実機で受け入れる。
7. runtime/modelのlicense・noticeとApp Store privacy/reviewer copyを最終確認する。

ローカルで`.aar`が作れた場合も、Apple CDNへのupload完了、TestFlightでの取得成功、
モデル採用、またはApp Store出荷可能を意味しない。

## Owner handoff for App Store Connect

Developer Portal側は次の値で準備済み。

- App: `dev.hazakura.editor`
- Extension: `dev.hazakura.editor.background-downloader`
- App Group: `group.dev.hazakura.editor`

両App IDへ同じApp Groupを付与済み。コード側にもこの値でextension、entitlements、Info.plist、
AssetPackManagerを接続した。署名scriptはprofileを埋め込む前に`OSX` platform、正確なBundle ID、
App Group、有効期限、`get-task-allow`を検査する。App Groupを含むMac App Distribution profileを
両target用に作り、ignoredな次のpathへ置く。

```txt
src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile
src-tauri/profiles/Hazakura_Background_Downloader_Mac_App_Store_Profile.provisionprofile
```

別名で保存する場合は`HAZAKURA_APP_STORE_MAIN_PROFILE`と
`HAZAKURA_BACKGROUND_DOWNLOADER_PROFILE`で指定できる。2026-09-21に追加された2 profileは
Bundle IDとApp Groupは正しいが、`Platform`が`iOS / xrOS / visionOS`で`OSX`を含まないため、
native macOS appには使用せずpreflightで拒否した。既存main profileは`OSX`だがApp Groupを含まない。
Apple Developer Portalでprofile種別をmacOSのMac App Distributionとして両方再生成する必要がある。

`.aar`ができた後のApp Store Connect作業は次の順序にする。

1. Transporterへ対応`.aar`をdropするか、App Store Connect API / `altool`で個別uploadする。
2. Appleのprocessing完了メールを待ち、manifestのasset pack IDと表示IDが完全一致することを確認する。
   version番号は同じIDのuploadごとにApple側で自動増分される。
3. internal TestFlightは最新のprocessed versionを自動使用する。`TestFlight > Builds & Assets > Asset
   Packs`で対象versionを確認してから、同じ署名buildを実機で試す。
4. external TestFlightは先にbuildを外部テストへ提出し、Asset Packs画面の`Set Up External Testing`
   （更新時は`Replace`）からversionを選び、TestFlight App Reviewへ出す。
5. App Store配布時はasset pack versionをアプリ本体とは別にApp Reviewへ提出する。

詳細と短い実機手順は
[2026-09-21のhandoff](reviews/2026-09-21-core-ai-apple-hosted-e4b/README.md)を参照する。
