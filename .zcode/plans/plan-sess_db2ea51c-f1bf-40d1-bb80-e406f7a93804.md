## 目的

テストフライト配信に向け、in-tree version を `1.8.0` → `1.10.0` へ上げ、v1.9 W1-W4 + v1.10 S1-S4 の内容をまとめたリリースノートを作成し、docs 整合・commit・push・TestFlight用pkgビルドまでを行う。Git tag は作成しない(pkgビルド・署名検証・TestFlight実機確認の後に別途明示承認で貼る)。

## 前提(確認済み)

- 全ローカルゲート緑: Vitest 173files/1460tests、Rust 338/2 ignored/0 fail、npm audit 0、cargo audit exit 0(unmaintained警告のみ)、cargo fmt / git diff --check / build:vite / Tauri build 全 OK
- v1.8.0 タグ以降 11 commit = v1.9 W1-W4 + v1.9 fix + v1.10 S1-S4 + smoke fixture + 1 docs refine
- 公開済みは 1.8.0(build 89)。TestFlight段階では「公開版」記述は 1.8.0 を維持し、「in-tree version」だけ 1.10.0 に更新する
- build counter(`tauri.conf.appstore.json` `bundleVersion`)は `build:app-store-pkg` が自動インクリメントするため手動変更しない
- 1.9 は独立リリースノートなし。v1.10 バイナリに含まれるため v1.10 リリースノート内で併記する

## 変更計画

### 1. バージョン表面の更新(3ファイル + lockfile)

- `package.json`: `"version": "1.8.0"` → `"1.10.0"`
- `src-tauri/tauri.conf.json`: `"version": "1.8.0"` → `"1.10.0"`
- `src-tauri/Cargo.toml`: `version = "1.8.0"` → `"1.10.0"`
- `Cargo.lock`: `hazakura-editor` の version を 1.10.0 へ(`cargo build` で再生成、あるいは手動修正後に `cargo check` で確認)

`tauri.conf.appstore.json` の `bundleVersion`(現在 `89`)は触らない。

### 2. リリースノート新規作成

`docs/releases/1.10.0-app-store-release-notes.md` を新規作成。1.7.0 / 1.8.0 の形式に倣う。status は `Prepared for TestFlight submission`(App Review通過前のため)。内容:

- **App Store Connect Copy**(日本語): v1.9「書く・読む・確かめる」整理 + v1.10 単一文書構造基盤を、ユーザー向けメッセージで簡潔に
  - v1.9: Start Panel の再開/復旧、ペイン状態の目的語説明、L Mode 往復・tab切替・Save As での作業文脈保持、コマンドパレット日本語/かな検索
  - v1.10: Outline に見出し階層とpage-breakを表示、構造助言(skipped level/空見出し/重複label/長章)、見出しレベル変更の Undo 可能な明示的操作、frontmatter/heading/page-break/EPUB navigation の共有解釈
  - 境界維持: Markdown source 正本、外部AI network fallback / auto-save / tool calling / workspace-wide indexing なし
- **Release Position**: v1.10 単一文書構造基盤。Safe Editor 不変条件維持
- **Boundary / Explicit Non-goals**: 既存のものを踏襲

### 3. docs 整合(「in-tree version」のみ更新、「公開版」は 1.8.0 維持)

- `docs/current-status.md`: 「Package/app version」の in-tree 記述を 1.10.0 へ。公開版 1.8.0 記述は維持。Next Safe Actions の「Keep package/app version at 1.8.0 until an explicit release-preparation decision」を「version prep 実施済み・TestFlight配信準備中」へ更新
- `docs/current-work.md`: 「Package/app version in tree」を 1.10.0 へ。v1.10 lane の位置づけを「source complete」→「TestFlight candidate prepared」へ
- `docs/roadmap.md`: v1.10 記述を「source complete」→「TestFlight candidate prepared」へ。in-tree version 記述を更新
- `docs/app-store-build.md`: 「Current source / Developer version」を 1.10.0 へ。公開版 1.8.0 記述は維持
- `README.md`: 「Current package/app version」の in-tree 記述を 1.10.0 へ。公開版 1.8.0 記述と latest tag(v1.8.0)は維持
- `docs/v1.8-plus-product-review-roadmap.md`: 必要なら last reviewed と v1.10 位置づけを微修正

### 4. リリース前チェック実施

`docs/release-pre-check.md` に従い、`v1.8.0..HEAD` 範囲で:
- Section 1(ローカルパス), 2(GitHub不適切内容), 3(セキュリティ) の diff grep
- Section 5(バンドルライセンス通知): pkgビルド後に `probe:macos-distribution` で確認

### 5. ゲート再確認(バージョン変更後)

バージョン変更・docs更新後に再実行:
- `npm run test` / `cargo test` / `npm run build:vite` / `cargo fmt --check` / `git diff --check`
- 必要なら `npm run build` でアプリビルド

### 6. commit + push

- commit 1: バージョン上げ(package.json, tauri.conf.json, Cargo.toml, Cargo.lock) + リリースノート + docs 整合
  - メッセージ例: `chore(release): v1.10.0 テストフライト配信準備`(日本語)
- `git push origin main` で push(tag は作成しない)

### 7. TestFlight用pkgビルド(ユーザー環境変数必要)

⚠️ **署名環境変数と provisioning profile が必要**:

```
APPLE_SIGNING_IDENTITY="Apple Distribution: <Name> (<TEAM_ID>)" \
APPLE_INSTALLER_SIGNING_IDENTITY="3rd Party Mac Developer Installer: <Name> (<TEAM_ID>)" \
  npm run release:candidate -- --with-app-store-pkg
```

- これら環境変数と `src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile`(ignored) は私が持っていないため、実行時にご提供いただくか、ご自身で実行いただく必要があります
- ラッパーは自動で build counter をインクリメント(89→90以降)、App Store surface smoke 実行、署名付き .pkg 生成、`docs/internal/app-store-candidates/latest.json` 更新(ignored)を行う
- 生成後、`pkgutil --check-signature` / `spctl --assess` / バンドルライセンス通知を検証

### 8. 報告

変更点・確認したこと・TestFlight用pkgのビルド結果(または環境変数不足によるブロック)・残タスク(tag作成・upload・TestFlight実機確認は別途承認)を簡潔に報告。

## 行わないこと

- Git tag `v1.10.0` の作成(pkg検証・TestFlight確認後に別途承認)
- GitHub Release 作成
- App Store Connect / Transporter への upload(別途承認)
- build counter の手動変更(自動インクリメントに委ねる)
- 「公開版は1.8.0」記述の変更(App Review通過後の別作業)
