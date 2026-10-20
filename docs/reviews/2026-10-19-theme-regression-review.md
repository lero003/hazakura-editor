# テーマ刷新の不具合調整と確認

Status: Source and local signed package verified; candidate GUI acceptance pending
Scope: v3.4.0のS0〜S8 presentationとローカルApp Store候補
Authority: Review evidence
Last reviewed: 2026-10-19

v3.3は審査提出済みとのオーナー報告を受け、本テーマ刷新と調整はv3.4.0へ分けた。
以下の先行pkg検証は3.3.0として作成した旧ローカル候補の証跡で、提出済みv3.3との対応を示さない。
v3.4の候補と受け入れは[版別記録](../releases/3.4.0-theme-atmosphere.md)で区別する。

演出の豊かさと一定の描画負荷を許容する方針を維持し、テーマの簡素化や依存更新は行っていない。
Markdown source・保存形式・実行/path/AIの境界は変更しない。
紙面と日本語組版のCSSはL Mode・Readerにも適用されるため、それらの見え方まで「未変更」とは扱わない。

## 調整

- 深海・CRTで、起動時の強度に固定されていたDPRと描画間隔を設定変更へ追従させる。
  WebGLの再構築は行わず、水の時刻を保つ。
- 深海・CRT・夜光/曙光で、非表示/非アクティブ時の保留rAFを取り消して解除する。
  復帰時は張り直し、初期非表示でも無駄なループを開始しない。
- 品質回復の条件を12ms未満から18ms未満へ訂正。
  一時的な処理落ちの後、通常の60Hz（約16.7ms）でも安定すれば選択強度まで戻る。
  最低段は静止ではなく30fps/DPR 1であることもコメントへ合わせた。
- CRT背景に残っていたUV周期の細い走査線を除き、前景マスクの3 device px周期に統一。
  背景の砂嵐・太い帯・色収差は維持する。
- CRTマスクの初期非表示を尊重し、表示復帰でハムバーの位相を先頭へ戻さない。
  演出offでは本文の色収差ドリフトも止める。
- reduced-motionでテーマ別animationの詳細度が勝ち、保存✓が消える問題を修正。
  全7テーマで静止した✓を維持し、疑似要素の動きは隠す。
- 紙の乗算は明色面のコントラストを下げ得るため、「比は悪化しない」という説明を訂正。
  合成後の最悪ケースを検査する既存テストは維持する。

回帰はrAF/強度8件、CRTマスク2件、60Hz回復1件、走査線の単一所有1件、
保存✓の実CSSカスケード7テーマを追加し、それぞれ修正前の失敗を確認した。

## 自動検証

- `npm run typecheck`: 成功。
- `npm test`: frontend 329 files / 3,067 tests、scripts 31件成功。
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: 成功。
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`: 515成功 / 4 ignored。
- `npm run build:vite`: Developer lane成功。既存のlarge chunk警告あり。
- pkg生成時のApp Store lane Vite buildとfrontend bundle境界検査も成功。
- 候補生成入口の `npm run smoke:app-store-surface`: 137件成功。
- 追加差分と未追跡のテキストを含むローカルパス/秘密の簡易衛生、`git diff --check`: 成功。

## WKWebViewの確認範囲

macOS 27.0.1の非永続WKWebViewに、実ソースの演出部品・全CSSと代表DOMを束ねた隔離fixtureを使用。
Tauriの本体アプリ、実CodeMirror、配布候補のGUI操作とは分ける。

- 深海overlay・CRT・深海bootのGLSL ES 300/WebGL2のcompile・link・drawを確認。
  各9条件、合計27描画で `getError() === 0`、非空画素と階調差を検査。
- 全7テーマの代表画面を描画。江戸彼岸・深海・CRTを含む画面の欠落/全面黒化/明白なレイアウト破綻は見られなかった。
- 夜光/曙光/深海/CRTでoff→onと強度切替の実描画、matchMediaを模擬した低モーション停止/再開を確認。
  保存✓もmedia一致のみをCSSOMで切り替え、全7テーマのcomputed animation/opacityを確認した。
  OSのアクセシビリティ設定そのものは変更していない。
- CRTマスクの実画素alphaが3 device pxごとに繰り返され、canvas寸法がviewport×DPRと一致。
  今回のDPRは1で、Retinaの検証ではない。最終の関連57ソースdigestは検証時と一致した。
- 検証スクリプトと画像・結果・ソースdigestはignoredの `docs/internal/theme-wkwebview-smoke/` に保持。

## ローカルpkg

正本の `npm run release:candidate -- --with-app-store-pkg --no-prune-pkgs --keep-pkgs=1000` で生成した。
version/build/hashはignoredの候補記録を参照する。旧pkgと候補記録は保持した。

- pkg署名と元app/展開後appのdeep/strict署名、universal arm64/x86_64構成を確認。
- appとextensionの版・build・profile・App Group/sandbox、3 helperのsandbox/inheritを照合。
- 展開payloadの全14ファイル/symlink/modeが署名済みappと一致。
  bundled LICENSE/noticesのbyte一致、最低macOS 26.0、installer XMLも確認。
- 直前候補pkgのSHA-256は不変。記録した製品ソース1,028ファイルのSHA-256も生成中/生成後で不変。
- 既知の `productbuild` の `write: Permission denied` 4行は残ったが終了0、署名・payload検証は成功。
  既存のchunk/dead_code警告と、macOS 27 SDKのIntel非推奨警告もログへ保持。
- sourceはdirtyで、基準commitは配布物全体を表すSHAではない。コミット・push・uploadは行っていない。

## S9再調整の追試（2026-10-19）

読む面の不透明紙、chrome-bar-surface、江戸彼岸の全画面配置を確認した。
追加で次の2点と、実測に基づく補助文字の余裕を調整した。

- 深海の暗いビネットも文字へ重なると比を下げるため、水流/ビネットをUIより後ろの階層へ移動。
  同じz-indexへ置くだけでDOM順により前へ出る状態を避け、canvas→ビネット→UIの順を固定した。
- 電子書籍の共通pane/page-sheetに残っていた半透明紙の参照を、不透明なreading-surfaceへ統一。
  特殊3テーマ以外にも適用し、ページの寸法・本文/source・保存は変更していない。
- 深海shaderの9描画条件ではRGB各成分最大値が `[178,205,209]` となり、仮置き背景より明るかった。
  0.95の紙へ合成すると旧補助文字は約4.35:1。紙の透け方を維持し、補助文字を `#80b1c6`へ調整した。
  実測色と白下地の静的パレットをred→greenで固定した。実測色もshaderの厳密な上限ではない。

検証はfrontend 330 files / 3,094 tests・scripts 31件、Rust 515成功 / 4 ignored、
型検査・fmt・両lane Vite・App Store surface 137件が成功。
全体試験初回にReaderのcallback通知を同期で判定する1件が失敗し、単独42件は再現しなかった。
既存の同種試験と同じ `waitFor`へ揃え、表示/hidden/inert/通知の検査内容を維持して全件成功。
製品のReader処理は変更していない。

隔離WKWebViewでは実CSSクラス/祖先構造へfixtureを合わせ、全7テーマのPreview・電子書籍・
全幅Readerの不透明な紙、深海/CRTの実boot完了後、3 shader/27描画、chromeの半透明設定を確認した。
前景演出を停止した白黒下地の透過検査では紙面の空白画素差は0。通常の動的画面のコントラスト検査とは分ける。
証跡はignoredの `docs/internal/theme-s9-wkwebview-smoke/`。
今回もDPR 1・代表DOMであり、実CodeMirrorや配布候補アプリのGUIではない。
最終の深海補助文字を再検証し、source digestの一致を照合した。

S9の最終署名pkgもversion/build・profile・権限・universal構成・署名・notice・展開payload14項目を再検証した。
以前の4つのpkgはSHA-256不変で保持し、明部の補助文字修正前の中間候補は採用対象から外した。
最新候補はignoredの `latest.json` とS9用の検証記録で照合する。既知のproductbuild警告4行は残る。

数値の主張は静的パレットと検査条件へ限定する。color合成はWCAG相対輝度の固定を保証せず、
CRTの前景マスクや夜光の粒子も文字の画素へ作用する。例としてCRT補助文字/バーの静的比5.49:1は、
黒alpha 0.3の走査線を両者へ重ねると約3.12:1となる。本文上の走査線はジョークテーマの意図として維持し、
動的画面全体のAA適合やアクセシビリティ受け入れ完了とは扱わない。

## 次の確認

最新pkgのversion/build/hash/source状態はignoredの `docs/internal/app-store-candidates/latest.json` を照合する。
今回は未コミットのテーマ差分を含むローカル確認用候補。upload前には意図したsourceをcommitして再生成する。
Intel・macOS 26・Retina/DPR変更、実CodeMirrorの長文/IME、L Mode/Readerの組版とページ再計測、
200%文字・VoiceOver・署名候補そのもののGUI・TestFlightは未確認。
