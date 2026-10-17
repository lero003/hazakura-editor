# 依存の自律化 — v3.3計画と追加削減

Status: Active plan; initial review accepted, additional reduction candidate
Scope: 新機能に先行する依存整理、比較評価、採否の条件
Authority: Advisory（採用・実装状態の正本は roadmap / current-work / current-status）
Last reviewed: 2026-10-17

## 1. 結論と今回の到達点

**v3.3の主題は依存の自律化。初回整理のレビュー後、受け入れ試験と個別撤回を前提に追加削減した。**
新機能を加える前に、必要な依存を選び、修正する場所と方法を把握する。
CodeMirror本体・sanitize・PDF parser・TLS暗号処理を自作する計画にはしない。
OS APIへ移した部分は、外部package依存をOS/SDKと専用bridgeの保守へ交換する。

| 区分 | 到達点 |
|---|---|
| 初回整理 | 既存解決版を維持し、実利用CodeMirror/Lezerを直接宣言。未使用 `codemirror` 束を除去 |
| 初回レビュー | 固定範囲 `5e3310aa..995df92c` の外部静的レビューは指摘なし。追加差分は対象外 |
| 背景効果 | 直接window-vibrancy 0.8.1をTauri標準APIへ集約。0.6.0は推移依存として維持 |
| 追加feature整理 | Tauriの不要platform defaults、Foundation未使用feature、asset圧縮を外す。圧縮は容量との交換条件を記録 |
| dialog | npm入口整理に続き、同じrfdへ直接集約。Rust plugin 3件を除去し、main限定IPC・選択scope・非同期confirmの契約を固定 |
| HTTP/PDF | ureq→NSURLSession、pdf-extract→in-process PDFKit。契約と失敗試験を固定し、helperとnativeの二経路を残す |
| 日本語codec | macOS iconvと限定的な互換処理へ委譲。encoding_rsは比較test/非macOS fallback、simdutf8はUTF-8に維持。legacy処理の遅延を記録 |
| 生成物 | App StoreのAgent専用CSSと両laneの不要なpackage metadataを除去。件数削減とは区別 |
| 件数 | 基準 `25f21528` からmacOS Cargoの保守的なruntime/build集合301→254→247。npm lockは183→182のまま |
| 受け入れ | 自動検証・旧codec比較・隔離appのlegacy保存と今回4変更の個別撤回後の解決/noticeを照合。外部レビュー・同SHAのCI・同一署名候補の受け入れは未完 |
| 範囲外 | 新機能、全面native化、全vendor化、公開タグ・App Store upload |

実装結果、基準、測定の意味、個別撤回と未確認の正本は[3.3.0の記録](releases/3.3.0-dependency-autonomy.md)。
10月17日の追加分は[最新の採否・検証・性能差](reviews/2026-10-17-dependency-reduction.md)を参照する。
既存build 163 pkgは今回分を含まず、新しいpkg・タグ・uploadは行っていない。
件数削減と配布容量・性能・品質は別に評価し、保守責務や救済経路の損失も採否に含める。

## 2. 既存ロードマップとの順序

今回のオーナー希望「新機能を加えていく前に」を、依存整理を先に行う順序として反映する。
メモ・縦書きの採用方針は維持する。

1. v3.2.1のテスト問題なし・App Store公開済みは2026-10-14のオーナー報告。先行候補の履歴を保持する。
2. CodeMirror宣言整理を実装し、初回の固定差分は外部静的レビューで指摘なし。
3. 背景効果をTauriへ集約。続く追加依頼で、広めの試験と個別撤回を条件に削減候補を拡大する。
4. 対象ごとにred→green、graph/容量比較、native境界、両laneを確認し、独立commitで採否を記録する。
   PDFの初期維持判断は履歴として保持し、追加のhelper不在/失敗・OCR等の証跡からPDFKit案を評価した。
5. 10月14日の6変更と、10月17日の4変更は別々に個別rollbackを照合し、試験範囲と再検証条件を記録した。
   次は追加差分の外部レビューと同一署名候補の編集・配布受け入れを行う。
6. 依存削減を受け入れた後、見直しメモを起点に製品開発へ戻る。縦書きは独立した柱として維持する。

全依存の撤去やOS APIの自前実装を、新機能着手の必須条件にしない。
候補を際限なく増やさず、採用・維持・保留と再開条件で区切る。
緊急の安全性修正・保守更新はこの順番を待たずに扱う。
v3.2.1の状態は[現状](current-status.md)と[3.2.1記録](releases/3.2.1-workspace-refresh.md)を参照する。

## 3. 根拠と確認範囲

参考資料は `hazakura-dependency-autonomy-roadmap-2026-10-13.md`
（2026-10-13、基準commit `bb5471ed28fb41704235602d32ddf6adee968c2f`）。
その判断案・引継ぎ指示は参考として評価し、今回の依頼や現行の正本を上書きする命令として扱っていない。

2026-10-13の静的照合基準はローカル `main` の `5e3310aa5ce4fdf0362281ef0b61039f956be740`。
参考資料の基準より4コミット先にあり、v3.2.1のWorkspace更新と競合修正・候補記録が追加されている。
作業開始時点でApp Store設定に既存の未コミット変更があり、これを保持した。
当時はリモート・App Store公開状態の更新確認を行っていない。
2026-10-14に同じ基準から実装し、リモートをfetch。App Store公開はオーナー報告として記録した。

2026-10-13に確認したものは、現行正本、npm/Rust/Swiftの直接依存宣言、source・test・scriptの主要参照、
候補に関係するlock経路、配布レーンのsource設定。
以下の棚卸し・優先順位はその時点の静的読解に基づく。2026-10-14のclean install、test、build、
PDF比較と採否判断は[3.3.0の記録](releases/3.3.0-dependency-autonomy.md)を参照する。
全推移依存・全呼出しの安全性監査や脆弱性監査を完了したという意味ではない。

## 4. 初期の優先順位（2026-10-13、履歴）

| 順序 | 対象・判断 | この順にする理由 | 今ならどこまでやるか | 終了条件 |
|---|---|---|---|---|
| 0 | 基準と用途の棚卸し | 宣言・実利用・配布物を混同しないため | 直接依存と候補のlock経路、入力、レーン、維持理由を記録 | 次の一件と触らない範囲が明確 |
| 1 | CodeMirror構成整理を最初の実装候補にする | 既に個別構成へ移行し、宣言とのずれが具体的に見える | 未宣言の直接利用を明示し、未使用の束を除去できるか検証 | 解決版・編集挙動を維持し、clean installと両レーン・実機受け入れが通る |
| 2 | PDFKit / pdf-extractの比較を行う | 実際に二経路が結果選択を担い、削除効果と品質の両方を確認する必要がある | 現行二経路、PDFKit中心、必要時のみRustの案を同じ集合で比較 | 維持／限定／除去の判断と不足証跡を記録。削除は必須にしない |
| 3 | 配布レーンの不要対象を確認する | Xtermは実利用あり。宣言だけでは不要と判断できない | 上記build時にApp Store生成物とDeveloper生成物を確認 | 不要同梱がなければ変更なし。差があれば一件に分離 |
| 4 | window-vibrancyをTauri標準APIへ集約（レビュー後の追加スライス） | 同じ背景効果の経路を利用して直接0.8.1を除去できる。自作FFIを増やさない | Sidebar/Active・main限定・best-effortを維持。lockとnativeを検証 | 追加差分のレビューと外観受け入れ。0.6.0は維持 |
| 継続 | 基盤・パーサー・通信・AI・開発依存を維持 | 高い互換性・安全性・保守責務がある | 利用契約、pin、更新理由、既存パッチの管理を明確にする | 保守更新を継続。具体的制約が出るまで再実装を開かない |

## 5. 実装前の初期棚卸し（2026-10-13）

下表は直接依存の分類と主要入口の確認。全依存監査の完了表ではない。
App Store / Developer / test / buildは重なり得る。宣言されていること、取得されること、
最終成果物に同梱されること、実行時に使われることは別々に記録する。

| 依存群 | 用途・主要入口 | 主なレーン | 初期判断 |
|---|---|---|---|
| React / react-dom | 各entryとUI。`src/main.tsx` | App Store / Developer | 維持 |
| CodeMirror view / lang-markdown / lang-html / lang-css | 編集・構文・拡張子別表示。`editorBaseSetup.ts`、`codeMirrorTheme.ts` | App Store / Developer / test | エンジンを維持、宣言を整理。viewは6.43.13 pin |
| codemirror | 汎用basicSetupの束。現在の主要sourceに実importなし | npm取得・解決 | 除去候補。個別モジュールの直接宣言と一体で扱う |
| marked | Markdown表示と本文保全判定。`markdown.ts`、`proofreadPreservation.ts` | App Store / Developer / test | 維持。Previewだけの依存と思って外さない |
| DOMPurify | HTML sanitize。`markdown.ts` | App Store / Developer / test | 安全基盤として維持 |
| yaml | OKF frontmatter。`okfFrontmatter.ts` | App Store / Developer / test | 維持。独自パーサーは保留 |
| @tauri-apps/api / plugin-dialog | 検証済みIPC・選択ダイアログ。`src/lib/tauri/` | App Store / Developer | 維持。既存の用途別入口を利用 |
| @xterm/xterm / addon-fit | `AgentTerminalView.tsx`、Agent専用entry | Developer / test。取得は共通manifest | 実利用あり、維持。App Store出力の不在は別途計測 |
| Tauri CLI / Vite / React plugin / TypeScript | build・型検査 | build | 維持。取得・build時実行も管理対象 |
| Vitest / testing-library / jsdom / 各types | test・型検査 | test / build | 維持 |
| tauri / tauri-plugin-dialog / tauri-build | native host・ダイアログ・build | App Store / Developer / build | 維持 |
| pdf-extract | PDFテキスト抽出とPDFKit結果の比較。`import_assist/helper.rs`、`pdf_text.rs` | 両レーン / test、非macOSの抽出経路 | 比較対象。未使用ではない |
| encoding_rs / serde / serde_json | 文字コード・入出力形式・helper protocol | 両レーン / test | 維持 |
| ureq | 有界HTTPS画像取得 | 両レーン | 維持。OS通信API化も初期範囲外 |
| block2 / objc2 / objc2-foundation | macOSの既存bridge | 両レーン（macOS） | 維持。vibrancy置換だけでこれらも不要になるとはしない |
| window-vibrancy | メイン窓への外観適用。`src-tauri/src/lib.rs` | 両レーン（macOS） | 直接0.8.1とTauri経由0.6.0がlockに共存。置換を保留 |
| Core AI Swiftパッケージ | `apple-assist/Package.swift`のtest / distribution条件分岐 | Core AI test / 配布helper | revision pinとモデル互換性評価を維持 |
| PDFKit / Vision / Foundation Models等 | OS frameworkと専用helper | macOS native / fixtureは代替応答 | 外部package削減後もOS/SDK依存は残る。自前化とは区別 |

実装前のnpm宣言はruntime 14件・dev 10件。この棚卸し表は当時の分類で、追加後の採否・件数は3.3.0記録を参照する。
SwiftはSystem既定で外部packageなし、Core AI testで `apple/coreai-models`、
productionで `john-rocky/coreai-kit` を条件付きで利用する。
Import AssistのSwift packageは外部package宣言なしでPDFKit / Visionを利用する。

既に自律化の手段もある。CodeMirrorの用途別構成、`src/lib/tauri/`の入口、
JSON-over-stdioのhelper境界、Core AIのrevision pinと限定provider patchは維持・活用する。
全コードを新しいadapterで包む必要はない。

## 6. 最初の一件 — 実装前の課題と採用条件（2026-10-13）

この節は実装前の課題と条件。直接宣言・束の除去は2026-10-14に実装し、
現在の検証とbundle比較は[3.3.0の記録](releases/3.3.0-dependency-autonomy.md)にまとめた。

[editorBaseSetup](../src/features/editor/editorBaseSetup.ts)は既にbasicSetupを使わず、
折りたたみを除いた拡張を個別に組み合わせている。
`src`、`scripts`、Vite周辺の検索では `codemirror` 束の実importは見つからなかった。
コメント・既存testの名称参照は残るため、文字列の出現だけで実利用と判断しない。

一方、以下は実際に直接importするが、`package.json`には当時、直接宣言がなかった。

| package | 主な参照 | 基準lockの解決版 |
|---|---|---|
| @codemirror/autocomplete | editorBaseSetup | 6.20.3 |
| @codemirror/commands | editorBaseSetup、EditorPane | 6.10.4 |
| @codemirror/language | editorBaseSetup、codeMirrorTheme | 6.12.4 |
| @codemirror/search | editorBaseSetup | 6.7.1 |
| @codemirror/state | editorBaseSetup、EditorPane | 6.7.0 |
| @lezer/highlight | codeMirrorTheme（実値import） | 1.2.3 |
| @lezer/common | lMode/contentDecorations（type-only import） | 1.5.2 |

実装は、全直接importの最終確認 → 現在解決済みの版の直接宣言 → 不要な束の除去 →
clean installと解決graphの比較、の一つのスライスにする。
実装開始時にlockを再照合し、type-only依存も型検査に必要な宣言として扱う。
`@codemirror/view`の6.43.13 exact pinとoverrideは維持し、他の実効版の更新も混ぜない。
state/viewの重複解決など、編集拡張の互換性を壊す差分がないか確認する。

**見込む効果:** 推移依存から偶然得ていたAPIを、自分たちの必要な構成として明示できる。
直接依存数は増えてもよい。束の除去による容量・時間の効果は採用前に測る。実装後のfrontend容量比較は3.3.0記録を参照。
`@codemirror/lint`はHTML → JavaScript経由でも残るため、束の除去で消えると約束しない。
HTML/CSSは拡張子別編集やMarkdownの構成に実利用があり、同時に外さない。

**採用条件:** §9のfrontend・レーン検証と実機編集受け入れを通す。
**保留条件:** 無関係な更新が必要、lock差分を説明できない、編集・IME・Undo・L Modeに回帰がある。
先にエディタエンジンを自作する回避策は採らない。

## 7. 初期PDF比較の設計（履歴）

この節は初回 `5e3310aa` 基準の設計・読解。現行追加候補はpdf-extractをin-process PDFKitへ移し、
helper不在/失敗とOCRの追加試験を実施した。[現行の採否・契約・留保](releases/3.3.0-dependency-autonomy.md)を参照する。

[pdf_text.rs](../src-tauri/src/import_assist/pdf_text.rs)のコメントはRust経路をfallbackと説明するが、
[helper.rs](../src-tauri/src/import_assist/helper.rs)の実際の流れは次のとおり。

1. 選択元を検証し、helper用にcontainerの一時領域へstageする。
2. PDFKitを試し、有意なテキストがあれば保持する。
3. PDFKit成功後にも元の選択pathで `pdf-extract` を実行する。
4. 両方成功時は文字数・CJK文字数・ページ数のスコアで**抽出結果全体**を選ぶ。
5. 有意な結果があればMarkdownの取込draftを返す。本文への自動保存ではない。
6. テキスト層が空ならhelperのページ画像OCRを試す。

ただし、stage失敗は即error。PDFKitのerrorはRust経路へ進むが、Rustもerrorになり
保持結果がなければOCR前にerrorを返す。
「抽出できなければ必ずOCR」「PDFKitがあるのでRustは不要」とは言えない。
fixture helperの文字層抽出は使わずlive helperを探すかRustへ進むが、OCRではfixtureを許す。
既存のhelperなしPDFテストは不正PDFのerror確認で、正常な取込品質を証明しない。
実日本語PDFテストも手元文書がない環境では処理を省略するため、移植可能な採否fixtureの整備が先に必要。

### 比較する案と集合

| 案 | 確認すること |
|---|---|
| 現行二経路 | Rust結果が実際に選ばれる文書と、その結果に必要な品質があるか |
| PDFKit中心 | Rustを呼ばない場合の欠落、ページ区切り、読順、失敗、OCR移行 |
| 必要時だけRust | 呼ぶ条件を仕様として説明・テストでき、例外が増え続けないか |

Rust単独の抽出結果も診断用の基準として残し、混合結果だけでは原因を見失わないようにする。
最初は固定した代表集合で比較する。配布・再利用できるfixtureと許諾のある手元文書を用い、
後者の本文・パスはtracked結果に出さない。

| 代表条件 | 独立した期待値・記録 |
|---|---|
| 日本語・英語・混在のテキストPDF | 語句・句読点・読順・改行の欠落、どちらの結果を選んだか |
| 複数ページ・空ページ | ページ数・区切り・順序。スコアの大小だけを正解にしない |
| テキスト層のないスキャン | OCRが呼ばれる条件、空OCR時のerror、used_ocrの整合 |
| 壊れた／暗号化等で読めないPDF | 期待する拒否・案内・error。現行の不具合まで複製しない |
| PDFKit error / helper不在・起動失敗 | Rustで救える範囲、両経路失敗時の扱い |
| Rust error / 空結果、PDFKit成功 | 保持結果を使う条件。不要なOCRや全体失敗を起こさない |
| sandbox、外部選択path、stage失敗 | 許可範囲、helperへ渡すpath、後始末、失敗時の原稿不変更 |
| fixture / 非macOSの開発・test経路 | canned応答と実抽出を区別。Rust除去で既存のbuild/test経路を壊さない |

比較時は元PDF不変更、draft-until-save、選択pathとサイズ上限、固定helper、取消・失敗の
既存境界を維持する。取込品質とOCR条件の仕様が先で、コメントだけを根拠に除去しない。
Import helperはOCR・PDF参照描画にも利用する。pdf-extractの除去とhelperの除去は別判断で、
本計画ではhelperを維持する。
潜在的な正しさの問題が再現した場合は、依存整理と分離したバグ修正として扱う。

**A2の完了:** 判断・比較集合・不足証跡・再開条件が記録されていること。
維持の結論でも終了できる。改善を採る場合だけ、別差分でRust/helperのテストと
両レーンのbuild、同一候補のmacOS取込・sandbox受け入れまで行う。
**中止条件:** 必要な取込品質を失う、広い互換対策やhelper/OS対応の再設計が必要、
例外を説明できない。Rustを残すか、判断を保留し、独自PDFパーサーは作らない。

## 8. 維持対象・初期保留の再評価条件

| 対象 | 維持・保留の理由 | 再開条件 |
|---|---|---|
| window-vibrancyの自前化 | 直接0.8.1はレビュー後の追加でTauri標準APIへ集約した。0.6.0は推移依存として維持し、自作FFIは加えない | Tauri経路で解けない再現する不具合と移行利益がある場合だけ再評価。今回の詳細・外観の残ゲートは3.3.0記録 |
| yaml / marked | 外部文書の解釈と本文保全の互換性を担う | 現行設定・拡張・限定パッチでは解けない具体的要件と互換fixtureがある |
| DOMPurify / TLS・暗号 | 安全基盤の責務が大きい | 通常の依存自律化の再実装対象にはしない。具体的問題を独立レビューで扱う |
| ureqのOS API化 | 追加依頼でNSURLSession案を採用候補にした。HTTPS/redirect/MIME/上限/TLS拒否を試験し、timeout差は明示 | 特定HTTPS環境に回帰があれば、この変更だけを戻す。追加外部レビューと同一署名候補の受け入れを行う |
| encoding_rs | 10月17日にmacOS製品経路をiconvへ移行。test oracleと非macOS fallbackは維持 | OS差・互換性・大きなlegacy workspaceの待ち時間に問題があれば、この変更だけを戻す |
| serde / serde_json | 形式・protocolの基盤 | 未使用feature等に具体的根拠がある場合だけ局所整理 |
| React / Tauri / CodeMirror本体、全面native化 | 製品全体・IME・Undo・描画・配布の再開発になる | 製品要件を阻む再現可能な制約と、小試作で確認した移行利益がある |
| Core AI / tokenizer等 | モデル・生成停止・prompt・配布との互換性が必要 | 既存モデル/runtime評価レーンが再開したとき。今回の依存整理とは分離 |
| Xtermの自作、開発基盤の自作 | 既存用途と検証基盤を維持する方が初期責務を小さくできる | 初期計画の対象にしない |
| 全vendor化・全APIの一括ラップ | 更新・由来・差分管理の負担を広げる | 入手不能、再現性、修正困難等が生じた一件だけ評価 |

Core AIのproduction buildは、専用resolvedのrevisionを照合してから固定版のprovider patchを適用する。
[適用script](../scripts/apply-core-ai-kit-provider-patch.sh)と
[patch](../scripts/patches/core-ai-kit-gemma-provider.patch)が既にある。
初期棚卸しでは由来・変更理由・テスト・上流追跡・撤回条件の不足を確認するまでとし、
runtimeの縮小やrevision更新を混ぜない。

修正手段は設定・拡張、既存入口への集約、限定パッチ、限定fork、OS API、局所的な自前実装を
問題ごとに比較する。必ず自作へ進む順番にはしない。

追加棚卸しで見つけた `package.json` 全体importとAgent専用CSSの同梱は、10月17日に必要値のimportと
App Store build時だけのCSS除外で整理した。元の順序を保ち、Developer CSSのbyte一致と
Storeの非Agent selector/宣言列を比較した。package数削減とは区別し、実機の表示受け入れは維持する。
取り込み時は取得元・版/commit・変更箇所・理由・検証・上流追跡と戻す条件、
license/noticeを記録する。コードの由来や保守責務はvendor化やAI書換えで消えない。

## 9. 検証と採否の記録

実装開始時は現行の[AGENTS.md](../AGENTS.md)と[開発手順](development-automation.md)を再確認し、
Habitatを更新する。依存・設定変更の確認ルールは、その時点のオーナーの依頼・承認範囲に従う。
2026-10-13の文書依頼と、2026-10-14の実装・GitHub push依頼を区別する。
後者で初期スライスの依存・版番号・Git変更は承認された。
初回の外部静的レビュー結果と、追加依存整理の依頼も2026-10-14に受領した。
その後の依頼で、広めの受け入れ試験と個別撤回を前提に、リスクが過大でない候補をできるだけ減らす方針へ進んだ。
2026-10-17の追加依頼でdialog・日本語codec・生成物をさらに検証した。前候補の操作問題なしとの報告を、
今回の新差分や全実機ゲートの合格へ読み替えない。

| 変更 | 必要な検証（実行結果は3.3.0記録を参照） |
|---|---|
| 文書のみ | `git status --short --branch`、`git diff --check`、リンク・追加文言の衛生確認 |
| CodeMirror宣言・lock整理 | clean `npm ci`、`npm run typecheck`、`npm test`、`npm run build:vite`。同じ入力・toolchainで前後graphを比較 |
| 共通frontend / レーン | App Store・Developer双方のlaneを指定したVite build、`npm run smoke:app-store-surface`、生成物のentry/chunk/参照確認。必要な両レーンnative preview build |
| Rust / PDF / helper | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`cargo test --manifest-path src-tauri/Cargo.toml`、import helperのfixture/live buildとprotocol確認、両レーンnative build |
| editor実機 | 長文日本語・折り返し・カーソル・IME未確定入力・Undo/Redo・L Mode出入り、Read-only/Assist-lock、Diff→Apply→Undo、保存・外部変更 |
| PDF実機 | 固定集合の取込比較、helper不在/error、OCR、取消、sandboxでの外部ファイル選択、失敗時の原稿保全 |
| 出荷候補 | 変更面に応じた同一候補の署名・TestFlight・VoiceOver/OS受け入れ。公開は別ゲート |

宣言整理だけなら既存の挙動テストを利用し、implementationを写すテストを増やさない。
バグ修正・分岐変更は可能なら失敗テストを先に固定する。
fixtureやjsdomはnative PDFKit、WKWebViewのIME、実sandboxの証拠にはしない。
詳細の手動項目は[smoke checklist](smoke-checklist.md)、配布は[App Store Build](app-store-build.md)を正本とする。

| 測るもの | 比較の単位 |
|---|---|
| 管理範囲 | 直接宣言、解決graph、共有経路、残す理由。直接件数が増えても説明可能なら可 |
| 取得・実行 | npm/Cargo/Swiftの取得集合、build script・生成処理の有無 |
| 配布物 | 同一lane・architecture・toolchainでfrontend chunk、native binary、helper、app/pkgを別々に比較 |
| 処理 | PDFの経路別結果・時間・失敗。性能を目的にする場合は反復と条件を記録 |
| 保守 | 変更入口、外部APIへの依存範囲、独自コード・patchの責務、更新・撤回方法 |

容量減少・高速化・安全性向上は対応する実測・検証がある場合だけ主張する。
CodeMirrorの束を外すことと、最終bundleが小さくなることは同じではない。
XtermもVite設定でAgent entryが除外される事実と、配布物から完全に不在という実測を分ける。

各候補は **調査対象 → 比較案 → 採用候補 → 実装済み → 自動検証済み → 実機受入済み** を区別する。
維持・保留で閉じた候補は実装キューから外す。
結果には基準commit、変更対象・理由、保った契約、前後の証跡、不足、維持/採用/保留、再開・撤回条件を残す。

## 10. 初期計画を閉じる条件

- 直接依存の用途・主要入口・レーン・維持理由を記録し、候補の暗黙依存を説明できる。
- CodeMirror構成整理を採用して受け入れた、または成立しない理由と再開条件を記録した。
- PDF比較で維持／限定／除去を判断した。未確認が残る場合は保留条件を明示して閉じた。
- 採用変更は一件ずつ独立し、原稿・保存形式・互換性・安全境界を守り、元へ戻せる。
- 実機・配布の未確認を明示し、効果の主張が証拠の範囲を超えない。

この条件を満たしたら、依存の自律化は継続保守テーマへ移し、メモ・縦書きへ戻る。
自作コードの保守が製品開発の自由を狭めるなら、維持・限定パッチを選ぶ。

## 根拠・関連資料

- 現行方針: [roadmap](roadmap.md)、[current-work](current-work.md)、[current-status](current-status.md)、[security boundary](security-boundary.md)。
- 宣言・解決: [package.json](../package.json)、[package-lock.json](../package-lock.json)、[Cargo.toml](../src-tauri/Cargo.toml)、[Cargo.lock](../src-tauri/Cargo.lock)、[Apple Assist Package.swift](../src-helpers/apple-assist/Package.swift)、[Import Assist Package.swift](../src-helpers/import-assist/Package.swift)。
- CodeMirror: [base setup](../src/features/editor/editorBaseSetup.ts)、[既存test](../src/features/editor/editorBaseSetup.test.ts)、[theme](../src/features/editor/codeMirrorTheme.ts)、[L Mode decoration](../src/features/editor/lMode/contentDecorations.ts)。
- PDF: [helper選択](../src-tauri/src/import_assist/helper.rs)、[native抽出入口](../src-tauri/src/import_assist/pdf_text.rs)、[command境界](../src-tauri/src/commands/import_assist.rs)。
- レーン・外観: [Vite設定](../vite.config.ts)、[Agent terminal](../src/components/agent/AgentTerminalView.tsx)、[native entry](../src-tauri/src/lib.rs)。
- CodeMirrorの構成方針は[公式System Guide](https://codemirror.net/docs/guide/)を参照。今回本文取得は403、公式検索結果とlocal実装で構成を照合した。
- YAMLのアンカー・alias・スカラー・型解決は[YAML 1.2.2仕様](https://yaml.org/spec/1.2.2/)を参照。小さな利用フィールド数だけを再実装の根拠にしない。
- sanitizeの責務と設定は[DOMPurify公式](https://github.com/cure53/DOMPurify)を参照。現行安全境界を維持する判断は本計画による。
- Rustの限定差替えは[Cargo公式 Overriding Dependencies](https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html)の`[patch]`で可能。必要になった候補だけに利用する。

外部一次資料の確認日: 2026-10-13。最新版への更新可否・脆弱性・全仕様互換を確認したという意味ではない。
