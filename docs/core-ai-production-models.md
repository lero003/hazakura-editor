# Core AI Production Model Preparation

Status: Operational preparation
Scope: v3.1 Core AI production candidates and Apple-hosted asset preparation
Authority: High
Last reviewed: 2026-09-22

## Decision

Hazakura Local Assistの最初の本番候補は、同じGemma 4 QAT系から次の二つに固定する。
これは配布物を再現可能に作るためのidentity lockであり、製品catalogへの公開承認ではない。

| Lane | Model ID | Target | Locked converted artifact | Expanded model bytes |
| --- | --- | --- | --- | ---: |
| Standard | `apple:core-ai:gemma-4-e4b-it-int4-v1` | 16 GB Macでの受入候補 | `mlboydaisuke/gemma-4-E4B-CoreAI@e9ba305a91bf3e62ea83d5652b572b69913c433a` | 6,807,926,119 |
| Quality comparison | `apple:core-ai:gemma-4-12b-it-int8-v1` | 32 GB以上で先行評価 | `mlboydaisuke/Gemma-4-12B-CoreAI@266c04582d62be179cfbb04d45260c87dc648eec` | 14,698,433,203 |

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
  再確認する。E4Bは`manual-review-required`、12Bは原文保持を条件に
  `reviewed-apache-2.0`として記録済み。
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

Xcode 27の`xcrun ba-package`が利用できるMacで実行する。`ba-package`は**Codexのseatbelt
sandbox内では必ず`path extension isn’t “json”`で失敗する**（後述のsandbox finding）ため、
`package`工程だけはTerminal.appかsandbox外のrunnerで実行する。`download` / `verify`は
sandbox内でも同じ結果になる。出力は巨大かつ再生成可能なので`.hazakura/coreai-production/`へ置き、
Gitには含めない。

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
    └── PACKAGING-BLOCKED.md             # packageが失敗した場合だけ
```

`download`はpinned revisionから取得し、全ファイルのsizeとSHA-256を照合してからstageへ移す。
`package`は展開後resource manifestを再生成・再検証したうえで、manifestとarchiveを**絶対path**で
`ba-package evaluate <manifest>` / `ba-package <manifest> -o <archive> --verbose`へ渡す。
`ba-package`はmanifestを読んだ後に`sourceRoot`（stage）へchdirしてから出力pathを解決するため、
相対pathで渡すとarchiveがstage側へ落ち、生成に成功しても`stat`が失敗する。`archive.json`には
最終archiveのsize、SHA-256、残release blockerを記録する。

### 2026-09-21 sandbox finding（初回判定の訂正）

以前このホストのXcode 27.0（27A266a）`ba-package 2.0`を「toolchainのpath-extension検証不具合」
と記録したが、これは誤りだった。同じMac・同じtoolchain・同じ41 byte fixtureで結果は
**実行コンテキストだけ**で分かれる。

| 実行コンテキスト | `template` stdout | `template -o <json>` | `evaluate <json>` | package |
| --- | --- | --- | --- | --- |
| Codexのseatbelt sandbox（`CODEX_SANDBOX=seatbelt`） | 成功 | exit 64 | exit 64 | exit 64 |
| Terminal.app / 通常shell | 成功 | 成功 | 成功 | 成功 |

sandbox内では`template -o /abs/path/apple-template-absolute.json`のような明らかな`.json`も同じ
`path extension isn’t “json”`で拒否され、`env -i`の最小環境でも変わらない。sandbox外では
相対/絶対、`-o`/`--output-path`、default/明示`package`のいずれも成功する。原因はmanifest内容や
CLI形式ではなく、このsandbox下で`ba-package`が実行時に参照するシステムサービス／環境の制限で
ある。`npm run coreai:ba-package:reproduce`はsandbox指標と両コンテキストの比較をJSON reportへ
残し、sandbox内で失敗した場合は`restricted-execution-environment`として分類する。

manifest schemaも実物で確認した。Apple公式templateを`xcrun ba-package template`から保存して照合し、
このリポジトリが生成する`directorySource` / `directoryDestination` / `sourceRoot`は現行仕様の
有効なkeyである（`sourceRoot`はmanifestの位置からの相対path）。

2026-09-22に現在のlockとnoticeからsandbox外でE4Bと12Bの`.aar`を再確認・再生成した。

| Model | expanded bytes | `.aar` bytes | SHA-256 |
| --- | --- | --- | --- |
| Gemma 4 E4B | 6,807,926,119 | 5,431,767,276 | `394c5eb92f334294a91ddb360117c5af8862fc36220293b5e56a8d409802aaa8` |
| Gemma 4 12B | 14,698,433,203 | 9,148,924,300 | `208bc19246665964a6fb910503ee1e2e20ff4830d378901d9a651a50837a10eb` |

これはローカル生成の証跡であり、Apple CDN upload、Apple processing、署名済みbuild、TestFlightでの
実取得、AOT、対象メモリ機での品質採用の証跡ではない。次は12B `.aar`をTransporter等で
uploadし、処理完了と32 GB対象機での取得を確認する。

## Locked Apple-hosted asset pack IDs

### 12B ライセンスの調査結果（2026-09-21）

12Bは当初`reviewStatus: "manual-review-required"`として保留していた。理由は
「変換リポジトリの model card は Apache-2.0 と宣言しているが、同リポジトリの standalone
LICENSE ファイルは Gemma Terms of Use のまま」という食い違い。実物を確認した結果は次のとおり。

- **Gemma 4 の重み自体は Apache License 2.0**。Google の "Gemma 4 license" ページの
  タイトルが "Apache License 2.0" であり、lock の `sourceModelLicense` と一致する
- 12B の変換物に同梱されている `UPSTREAM-CONVERSION-LICENSE.txt` は
  「Gemma Terms of Use が適用される」と書いている。これは変換リポジトリ側の記述で、
  Google の Gemma 4 ライセンス表示と食い違っている
- Gemma Terms of Use §3.1 は再配布自体を禁止しておらず、条件（§3.2 の利用制限を
  下流の契約へ組み込み、本契約の写しを渡し、改変したファイルへ改変表示を付ける）を
  満たせば Distribute できる

つまり**再配布を妨げる条項は無く、残っているのは記述の食い違い**。解禁する場合の作業は:

1. payload に両方のライセンスファイルを残す（現状のまま）
2. `THIRD_PARTY_MODEL_NOTICE.md` を「重みは Google の Gemma 4 ライセンス = Apache-2.0。
   変換リポジトリ同梱の LICENSE は来歴として原文のまま保持し、Hazakura はそれを重みの
   ライセンスとして採用しない」と明記する
3. lock の `reviewStatus` を reviewed 相当へ更新し、`releaseBlockers` からライセンス項目が
   外れていることを確認する（AOT・bake-off・catalog 接続は別 gate のまま）
4. 変換リポジトリへ LICENSE の是正を投げ、修正版 revision を再 pin できれば最も clean

**最終判断はオーナー（必要なら法務）の領分**で、ここでは事実と選択肢のみを記録する。

#### 2026-09-21 適用済み（12B）

オーナー判断を受けて、12Bだけ次の調整を入れた（E4Bのpayload identityは変更しない）。

- lock の 12B `reviewStatus` を `reviewed-apache-2.0` へ変更し、`convertedArtifactStatement` を
  「重みは Google の Gemma 4 ライセンス = Apache-2.0。変換リポジトリ同梱の LICENSE は
  来歴として原文のまま保持」と書き換えた
- `validateLock` は既知の review status のみ受け付け、`reviewed-apache-2.0` を名乗る場合は
  変換リポジトリの LICENSE を payload に残すことを必須にした（回帰テスト付き）
- `THIRD_PARTY_MODEL_NOTICE.md` に「重みは Apache-2.0、同梱 LICENSE は来歴として保持し、
  重みのライセンスとしては採用しない」旨を追記した
- helper 側 `CoreAIResourceContract` も両 status を受理するようにした
- 12B の `.aar` を再生成し、`hazakura-coreai-gemma4-12b-v1.aar`
  （SHA-256 `208bc19246665964a6fb910503ee1e2e20ff4830d378901d9a651a50837a10eb`）を
  次のApp Store Connect upload対象にする（2026-09-22時点では未upload）

| Model | Asset pack ID |
| --- | --- |
| Gemma 4 E4B | `hazakura-coreai-gemma4-e4b-v1` |
| Gemma 4 12B | `hazakura-coreai-gemma4-12b-v1` |

App Store Connect側のrecordとコード側のcatalogはこの完全一致を必須とする。既存IDの中身を
差し替えず、model revisionまたはpayloadを変える場合は新しいimmutable IDとcatalog versionを使う。

**識別子にピリオド（`.`）を使わない。** 2026-09-21に実APIで確認した制約で、
`GET /v1/apps/{id}/backgroundAssets?filter[assetPackIdentifier]=a.b` は
`400 PARAMETER_ERROR`（Found invalid values）を返す。`Tutorial`、`a-b`、
`hazakura-coreai-gemma4-e4b-v1` は受理され、`a.b`、`com.example.tutorial`、
`dev.hazakura.editor.coreai.gemma4-e4b.v1` は拒否された。ハイフン、数字、大文字、
長い名前は問題ない。この制約はAppleの文書とOpenAPI仕様には書かれていない。
`validateLock`もピリオド入りIDを拒否する。
検証済みstageは合計21,506,359,322 bytes。ローカル`.aar`はE4B 5,431,767,276 bytesと
12B 9,148,924,300 bytesの計14,580,691,576 bytes。2026-09-20時点の
[Apple-hosted asset pack size limits](https://developer.apple.com/help/app-store-connect/reference/app-uploads/apple-hosted-asset-pack-size-limits)は
アプリ全体で200 GB / 200 asset packsのため名目上は枠内だが、uploadとApple処理を確認した
証跡ではない。

## Activation gates

2026-09-21からE4B、2026-09-22から12Bを、内部TestFlightでCDN経路を受け入れるため
App Storeレーンの固定catalogへ接続した。Developerレーンは引き続き空。以下は正式リリースまでのgateであり、
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
App Group、有効期限、`get-task-allow`を検査する。App Groupを含むMac App Store Connect profileを
両target用に作り、ignoredな次のpathへ置く。

```txt
src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile
src-tauri/profiles/Hazakura_Background_Downloader_Mac_App_Store_Profile.provisionprofile
```

別名で保存する場合は`HAZAKURA_APP_STORE_MAIN_PROFILE`と
`HAZAKURA_BACKGROUND_DOWNLOADER_PROFILE`で指定できる。最初に追加されたmobile platformの2 profileは
preflightで拒否したが、2026-09-21に再生成された`Mac App Store Connect` profileは、両targetとも
`OSX`、正しいBundle ID、`group.dev.hazakura.editor`、有効期限を満たした。profile内certificateと
インストール済みApple Distribution identityの一致も確認し、3.1.0 build 143の署名app/pkg作成と
distribution probeを通した。profileとcertificateは引き続きGitへ含めない。

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
