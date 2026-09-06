# Preview / reading controls 改善 — 外部レビュー引き継ぎ

Status: Draft PR / integration verification pending
Scope: Preview paint lifecycle and existing reading chrome
Base: `2e81d38a0c29664f9e3c6cdac7e3d2110f0466b3`
Date: 2026-09-07

## 目的と境界

ユーザーの依頼による、プレビューの安定性・UI・テーマに馴染む操作部の改善。
最新 main を基点にした別ブランチのソース変更であり、凍結済みの v2.8.0 / build 124
候補や公開版を更新したという意味ではない。バージョン、依存関係、lockfile、署名、
App Store設定、CSP、バックエンド、画像アクセス許可、保存形式を変更しない。
Local Assist、Diffの明示反映、Undo、電子書籍の改ページ処理も変更しない。

## 実装

### プレビューの安定性

- 空HTMLも完了した描画としてDOMを置き換える。本文を空にしたとき古い本文が残る
  early returnを除去。空の文書でも初回描画の完了を通知する。
- 文書identityが切り替わったらlayout effectで旧本文を消す。描画失敗時に別の文書を
  前の表示として残さない。同一文書の最後の正常表示だけを保持する。
- スケジュールされたMarkdown描画の例外を捕捉し、日英の回復文言と「もう一度表示」
  を用意する。例外文字列・文書内容・パスをエラー表示やログへ流さない。
- 選択中に保留したHTMLは、より新しいsourceの描画を開始する際に破棄する。
- pointerup / pointercancelに加え、window blur、ページの非表示、primary buttonを
  離したpointermoveでジェスチャーを終了する。unmount時は保持した親scrollerから
  選択中マーカーを取り除き、アニメーションフレームとイベント購読を掃除する。
- scrollTopはtransitionを予約した時点ではなく、DOMを書き換える直前に取得する。
  既存の画像キャッシュはDOM書き換え直後に適用し、選択中の本文差し替え抑制も維持する。
- リンクの既定遷移はルーティングcallbackの有無と無関係に抑制する。中クリックも
  WebView遷移へ流さない。通常クリックのリンク解釈は従来のcallbackに任せる。

### UI / テーマ / 配置

- 「プレビュー → 電子書籍 → アウトライン」を隣接させ、区切りの後に「参照 → 差分」。
- 「変更を確認」は末尾へ。利用できない間も同じローカライズ済みボタンの幅を予約し、
  visibility:hidden / aria-hidden / disabled / tabIndex=-1で操作と読み上げから外す。
  dirty状態が変わっても表示モードの位置がずれない。
- ツールバーのボタンを25pxから30px高へ。既存の34pxタイトルバー行を拡大せず収める。
  閉じる操作は32px角とSVGへ。選択中は下線も使い、色だけに頼らない。
- 1100px以下ではモードのcaptionをアイコンに縮める。aria-labelと既存titleを維持し、
  読み込み済み・非表示のReferenceには従来の名前とマーカーを残す。
- 新しいreading-surface.cssは既存の配色トークンを使用。Previewの紙面・余白・
  行間、空状態と回復状態、focus-visible、reduced motionを整える。
  ボタンの背景はテーマ変更時に即時切り替え、旧背景と新文字色の低コントラストを避ける。
- 新テーマ・外部画像・外部フォントは追加しない。アニメーションテーマの演出本体、
  L Mode、電子書籍のページ寸法には触れない。

## この環境で実行した確認

GitHubコネクターで取得した変更元5ファイルはローカルのgit blob SHAと照合した。
依存関係を含む完全なcheckoutではなく、取得したファイルだけを持つ部分checkout。
Hazakura Habitatの利用可能な接続は見つからなかった。

- `git diff --check`: 成功。
- TypeScript 5.8.3による変更対象・新規のTS/TSX計9ファイルのtranspile:
  syntax diagnostics 0。リポジトリ指定のTypeScriptによる型検査ではない。
- DOMにのみ依存する `previewDomSafety.ts` 単体のstrict型検査: 成功。
- 新規CSSとimportエントリのPostCSS構文解析: 成功。
- Chromium 144.0.7559.96上で、実装したDOM helperをtranspileして実行: 8項目成功。
  空描画、同一HTMLのnode保持、実レイアウトでの絶対scrollTop復元、通常クリック、
  中クリック、領域外リンク、pointer/blur/visibilityイベントと解除、他hostの非変更。
- 変更コンポーネントの独立した静的TSX/CSS fixtureで、1280 / 1100 / 900 / 600 / 360px
  の5幅を確認。確認ボタンの出現でモード位置がずれず、横方向にはみ出さず、操作高を維持。
  focus-visibleの2px枠とreduced motionのtransition停止も確認した。
- 既存light/darkトークンを使ったfixtureの画像を目視確認。選択中ラベルの文字/背景
  コントラスト比は約16.70 / 13.82。これはこの状態の測定であり全テーマの監査ではない。

fixtureはReactの統合実行ではなく、純粋なコンポーネント出力とCSSの独立表示。
アイコンは同寸の代替表示を使用した。アプリ全体、全CSS cascade、WebKit、ネイティブ
タイトルバー、IME、VoiceOverの確認を代替しない。生成画像によるデザイン検証ではない。

## 追加した回帰テスト（この環境では未実行）

- `PreviewPane.stability.test.tsx`: 10件。空文書、identity切替、失敗と再試行、
  保留描画の更新、blur / missing pointerup / unmount、リンク遷移抑制。
  描画器とschedulerをmockし、UI lifecycleに対象を限定している。
- `previewDomSafety.test.ts`: 5件。DOM書き換え・位置・リンク・購読解除。
- `RightPaneToggleControls.layout.test.tsx`: 3件。順序・名前・操作できない予約領域・Reference。

**18件を追加したが、Vitest 18件成功とは扱わない。**
既存のreal-renderer / image / selection / scroll / App Store surfaceテストも変更していない。

## マージ前に必要な確認

この環境では依存関係一式を取得できず、以下は未実行。Draftを解除する前に外部環境で実行する。

```sh
npm run typecheck
npm test -- src/components/editor/preview/PreviewPane.stability.test.tsx src/components/editor/preview/previewDomSafety.test.ts src/components/app/RightPaneToggleControls.layout.test.tsx src/components/editor/preview/PreviewPane.test.tsx src/components/app/RightPaneToggleControls.test.tsx
npm test
npm run smoke:app-store-surface
npm run build:vite
```

macOS実機では、長文の編集中スクロール、全削除→Undo、文書の高速切替、選択しながら
ペイン外へドラッグ→別窓へ移動→復帰、画像を含む文書、Preview/電子書籍/参照の往復を
確認する。light / dark / yakou / shokou / edohigan / crt / shinkaiで、狭幅・大きい文字・
キー操作・VoiceOverを確認する。Retained Referenceと「変更を確認」の右列所有権は
既存契約のままであることを確認する。

通常の例外からの回復を扱う変更であり、無限ループ・プロセスOOM・lazy chunk取得失敗を
このPRだけで回復できるという主張はしない。公開、署名済みビルド、CI成功の主張もない。
