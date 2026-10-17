# v3.3依存削減 — dialog・日本語codec・生成物

Status: Review candidate
Scope: `87b1899d..c32a78d8` の採否、比較、検証、撤回条件
Authority: Operational evidence
Last reviewed: 2026-10-17

## 現在の判断

同じrfdへのdialog集約と、macOS iconvへの日本語codec委譲を追加候補として実装した。
macOS製品のruntime/build集合は今回7件減。件数の削減を、性能・互換性・配布受け入れの合格とは区別する。
UTF-8のSIMD検証は維持したが、legacy原稿の処理は遅くなった。大きなlegacy workspaceの待ち時間は受け入れ項目に残す。

前候補を触って問題なしとのオーナー報告を受けた追加作業であり、今回の差分への受け入れ報告ではない。
既存3.3.0/build 163の署名pkgは変更せず、今回の差分を含まない。新しいpkg・タグ・uploadは行っていない。
前回の採否・HTTP/PDF・容量・撤回試験は[3.3.0全体記録](../releases/3.3.0-dependency-autonomy.md)に保持する。

## 採用した変更と保守範囲

| 対象 | 実装と維持した契約 | 交換条件 |
|---|---|---|
| 非同期confirm | 破棄・モデル操作で明示的に結果を待つ。待機中の重複・unmount・対象内容やcatalog世代の変更を照合し、false/失敗で実行しない | confirm待機と対象の同一性をアプリ側で保守する |
| native dialog | 既存と同じrfd 0.16.0へ直接集約。固定3 IPCをmain窓に限定し、main threadでUIを生成。親窓、filter、default path、label、単複数・folder・取消とcore選択scopeを維持 | pluginのadapter責務を引き取る。adaptした上流コードの帰属をnoticeへ保持 |
| 日本語codec | iconvのCP932/CP51932、必要時のEUC-JP JIS0212と限定的な互換処理を利用。strictな失敗、判定順、BOM、元入力と保存前の原稿を保つ | OSの変換表・対応版とFFI/互換adapterに依存。encoding_rsはmacOSの比較testと非macOS fallbackに残す |
| UTF-8 | 既存simdutf8 0.1.5を直接維持。Intelはstd featureで安全なruntime SIMD dispatchを使う | 件数削減より通常原稿の速度を優先。Intel実行性能は未測定 |
| frontend生成物 | App Store build時だけAgent専用CSSのimportを元の位置で除外。版番号はpackage全体でなく必要値をimportし、両laneの生成物を検査 | npm package数は減らない。CSS順序と配布entryの境界を保守する |

旧pluginのwindow.confirm上書きはPromiseを返すため、同期条件式では取消前でもtruthyになる。
上流sourceとmockで再現し、明示待機へ修正した。旧アプリの実UIで破棄事故を再現したという意味ではない。
今回のnative confirm実UIも未実施であり、待機・取消・失敗・重複・対象変更は回帰testで確認した。

codecは[Encoding Standard](https://encoding.spec.whatwg.org/)のShift_JIS/EUC-JP互換を旧encoding_rsと比較する。
SJISの単独0x80、EUC-JPの8F A2 B7、円記号・overline・minusの変換、SJIS私用領域の拒否を限定処理にした。
大きな独自変換表は持たない。descriptorは操作ごとのRAII所有とし、未消費入力、変換不能、reset失敗、
不正UTF-8や容量超過を失敗にする。旧codec同様の変換別名があるため、Unicode→legacy→Unicodeの完全可逆性は主張しない。

## 件数と生成物の測定

| 尺度 | 前候補 → 今回 | 意味 |
|---|---:|---|
| macOS両architectureの保守的なCargo normal/build集合、root除外 | 254 → 247 | 初期追加基準 `25f21528` の301件から54件減。弱いoptional参照を含み得る |
| cargo treeのnormal/build経路の和、root除外 | 234 → 227 | コンパイル経路の比較。最終binaryのdynamic library数ではない |
| 全target Cargo.lock block、root込み | 434 → 431 | macOS test/非macOSに残るcodec依存はlockから消えない |
| npm lock entry、root除外 | 182 → 182 | runtime到達32件、開発用150件。取得集合を配布同梱数と同一視しない |

dialogの削除はtauri-plugin-dialog、tauri-plugin-fs、tauri-pluginの3件。
codecはencoding_rs、multiversion_no_op、rustversion、core_detectをmacOS製品経路から外し、simdutf8を残した。
新規package・残存版・取得元・checksum/integrityの更新はない。view 6.43.13とCore AI pin/patchも維持する。

Cargo metadataは同じpackageの非macOS normalとmacOS dev edgeをmergeすることがある。
notice generatorはrootの既知target条件を照合し、対象外normalを製品依存として数えないよう修正した。
未知root cfgは要確認として失敗させ、推移edgeの保守的な集計は維持する。Python 6 testで固定し、
保存済みの旧metadataでも254件、dialog集約後は251件となることを再照合した。集計方式だけによる見かけの減少ではない。

frontend整理だけを同じsource/toolchainで切り替えた比較では、両laneのJSが各5,183 bytes減、
Store CSSが8,004 bytes減、StoreのJS+CSSが13,187 bytes減った。これは整理スライスの差であり、
confirm修正等を含む今回全体の純減ではない。Developer CSSはbyte一致し、Storeの非Agent 2,221 selector/条件/宣言列も一致した。

## 性能の交換条件

Apple Silicon/macOS 27のrelease harness、同じ入力、3回の中央値。旧encoding_rsと実production codecを比較した。
I/O・UI・workspace検索全体、Intel/macOS 26、起動時間は測定外。

| 入力・処理 | 旧 → 新 |
|---|---:|
| UTF-8、1 MiBを100回、検出+decode | 15.74 → 15.73 ms |
| Shift-JIS、1 MiBを100回、検出+decode | 0.819 → 3.42秒 |
| EUC-JP、1 MiBを100回、検出+decode | 1.041 → 2.88秒 |
| JIS0212連続、1 MiB、decode | 0.583 → 22.10 ms |
| JIS0212連続、1 MiB、検出+decode | 13.13 → 44.31 ms |
| JIS0212連続、10 MiB、decode | 5.912 → 224.91 ms |
| JIS0212連続、10 MiB、検出+decode | 132.95 → 451.80 ms |

JIS0212は `8F A2 AF` の反復と末尾 `A1 F1` でEUC-JP選択まで通す入力。旧出力と完全一致し、入力も不変だった。
連続JIS0212ではfallbackを文字単位で呼ぶ費用が出る。10 MiBで約0.45秒かかる結果を許容上限の保証にはしない。
検索のbudget・製品仕様は変更していない。実際のlegacy workspaceで許容できなければcodec変更だけを戻す。

## 実行した検証

- `VITEST_MAX_WORKERS=4 npm test`: frontend 2,904件 / 312 files、scripts 31件が成功。
- 型検査、App Store surface 134件、両laneのVite buildと生成物境界検査が成功。
- Rust fmt、locked/offlineのRust全体515 pass / 4 ignored。全3-byte値比較のignored testを別に明示実行し、
  Shift-JIS/EUC-JP合計33,554,432件が成功。他のignored testを成功扱いにしない。
- 単一/2-byte/EUC-JP 3-byte、両codecの全1,112,064 Unicode scalar、複合不正入力・NUL・random byte/文字列80万例、
  約10 MiB文書6種の旧codec比較と入力不変を確認。UTF-8/BOM、file保存、workspace検索の近接testも成功。
- Pythonのnotice test 6件、noticeの247 Cargo/32 npm一致を確認。x86_64製品のcargo checkは成功。Intel runtimeは未実施。
- 両laneの隔離arm64 native appをbuildし、ad-hocのdeep/strict署名、同梱LICENSE/noticeとsourceのbyte一致を確認。
- Developerでnative file/folder選択、Shift-JIS/EUC-JP別名保存を実操作し、旧codecの137/140 bytesと一致。
  既存HTMLの未保存確認Cancelで本文保持、legacyを含むworkspaceの「髙」検索6 files/6 matchesも確認。
- Store形状の診断用ad-hoc sandboxで、OS選択したEUC-JP/Shift-JISのopenと別名保存137/140 bytes一致、
  Open取消時の本文保持、L Modeの出入りとReaderの日本語表示を確認。
  専用ID・user-selected read/write・bookmarkで隔離し、Background Download extensionとApp Group profileは未同梱。
  正式MAS/TestFlightの権限・全操作受け入れではない。
- 固定範囲 `87b1899d..780468a0` と `780468a0..c32a78d8` の独立agent静的レビューは修正必須指摘なし。
  人間の外部レビューやテスト・実機の独立再実行とは区別する。

## 採用しなかった案

- CoreFoundationだけの日本語変換は、機種依存文字・波dash・JIS0212等の旧codec互換を満たさず採用しない。
- UTF-8をstd validatorだけにすると測定上大きく遅くなるため、既存SIMD leafを残す。
- AppKitのdialog全面自作はrfd一件の追加削減に対する保守範囲が大きい。React pluginの除去もFast Refreshを失うため採用しない。
- React/Tauri/CodeMirror、HTML/CSS構文、marked/yaml/DOMPurify、Xterm、test基盤、Core AIの全面置換・自作は行わない。

## 個別撤回と次のゲート

| commit | 単位・撤回時の注意 | 単独撤回後の保守的Cargo集合 / tree arm64・Intel / 全target lock |
|---|---|---|
| `ab672e9b` | 非同期confirmと対象照合。旧dialog backendへ戻してもこの修正は維持できる | 247 / 227・227 / 431 |
| `f5dc7a92` | rfd直接利用。plugin、ACL、旧IPC入口を一緒に戻す。codecのtarget条件を保持する | 250 / 230・230 / 434 |
| `780468a0` | frontend生成物整理と境界検査。単独撤回できる | 247 / 227・227 / 431 |
| `c32a78d8` | OS codec、target別依存、対応するnotice集計/CI。macOS製品をencoding_rsへ戻す | 251 / 230・231 / 431 |

clean treeから対象commitだけをrevertし、現行の無関係な変更を保持する。
noticeは `python3 scripts/update-dependency-notices.py --write` で再生成し、対象testと両lane buildを再確認する。
`c32a78d8` の新規一時clone 4つで今回4変更を一つずつ撤回し、両targetのlocked/offline metadata、
notice、diff check、他3変更の専用file保持を確認した。dialog撤回後の型検査も成功。
dialogだけはnotice 3箇所が文脈競合する。各blockのHEAD側を残してmarkerを除き、generatorを実行して250件へ整合する。
Cargo manifest/lock/lib.rsは自動mergeし、codecは維持された。他3変更は競合なし。
これは今回の個別撤回の構成・集計照合であり、撤回後のnative compile・runtime・全UI操作は未実施。
前回6変更の撤回試験とは別の証拠として扱う。

次は今回を含む追加差分の人間による外部レビュー、同SHAのCI、同一署名候補の長文日本語/IME・VoiceOver・
Intel/macOS 26・大きなlegacy workspace・sandbox外部PDF取込・TestFlightを受け入れる。
今回のsource test・診断app成功は、Apple upload・審査・公開を示さない。
