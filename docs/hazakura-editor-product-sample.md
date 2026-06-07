---
title: "Hazakura Editor 商品紹介サンプル"
description: "Markdown-first、静かで安全な執筆・レビュー用エディタの紹介デモ"
tags:
  - markdown
  - writing
  - safe-editor
  - review
  - hazakura
status: draft
version: "0.15"
updated: "2026-06-07"
---

# Hazakura Editor

> **書くことに集中し、壊すことから少し離れる。**
> Hazakura Editor は、Markdown-first の落ち着いた文章作成・レビュー用エディタです。

![Hero screenshot placeholder](./screenshots/hero-workspace.png)

<!-- TODO: ここにメイン画面のスクリーンショットを配置 -->

---

## 1. Hazakura Editor とは

Hazakura Editor は、文章を書く人、AIと草稿を育てる人、長めのMarkdownを安全に扱いたい人のための、軽やかなデスクトップエディタです。

大きな特徴は、**できることを増やしすぎないこと**です。
汎用IDEのように何でも実行できる場所ではなく、文章・レビュー・整理に向いた、穏やかな作業場を目指しています。

### 向いている用途

- Markdown記事の執筆
- README / 仕様メモ / リリースノート作成
- AI出力の比較・レビュー
- 長文メモの整理
- 小説・エッセイ・企画書の下書き
- 画像つきドキュメントの作成

### 向いていない用途

- 本格的なIDEとしての開発
- 複雑なターミナル作業
- 多数のプラグインによる環境構築
- 実行環境込みのプロジェクト管理

> Hazakura Editor は「全部入り」ではありません。
> そのかわり、**書く・読む・比べる・整える**ことに集中できます。

---

## 2. 画面イメージ

### 作業場

![Workspace screenshot placeholder](./screenshots/workspace.png)

<!-- TODO: サイドバー・タブ・エディタ・プレビューが見えるスクリーンショット -->

| 領域 | 役割 | ポイント |
|---|---|---|
| Sidebar | ファイルや作業対象の確認 | 迷子になりにくい構造 |
| Editor | Markdown編集 | 書くことに集中 |
| Preview | 表示確認 | 公開前の見え方を確認 |
| Review | 差分・見出し・比較 | 長文レビューを補助 |

### Zen Mode

![Zen mode screenshot placeholder](./screenshots/zen-mode.png)

<!-- TODO: 余計なUIを隠した集中モードのスクリーンショット -->

Zen Mode では、画面上の情報量を減らし、文章だけに向き合えます。

```text
通知を減らす。
ボタンを減らす。
考える余白を増やす。
```

---

## 3. なぜ「Safe Editor」なのか

文章を書くための道具が、いつの間にか実行環境になっていることがあります。
それは便利な一方で、次のような不安も生みます。

1. うっかり危険なコマンドを実行してしまう
2. AIエージェントが想定外の操作をする
3. 執筆と開発作業の境界が曖昧になる
4. 画面が複雑になり、集中が途切れる

Hazakura Editor は、この境界を大切にします。

> **基本は安全な文章作業場。**
> 必要なときだけ、明示的に拡張する。

```mermaid
flowchart LR
  A[Markdownを書く] --> B[プレビューする]
  B --> C[差分を確認する]
  C --> D[整えて公開する]
  D --> E[次の草稿へ]
```

<!-- TODO: Mermaid表示が未対応の環境では、ここを画像に差し替え -->

---

## 4. 主な機能

### Markdown-first

Markdownを中心に、記事・メモ・仕様書・READMEを扱いやすくします。

#### 対応したいMarkdown表現の例

**太字**、*斜体*、~~取り消し線~~、`inline code`、リンク、画像、表、引用、コードブロックなど。

[Hazakura project site](https://hazakura.dev)

> 引用は、文章のリズムを変えるためにも使えます。
> 長いレビューコメントや、AIからの提案を整理するときにも便利です。

---

### 画像ペースト / ドラッグ&ドロップ

画像を含む記事やメモも、自然に扱えます。

![Image asset screenshot placeholder](./screenshots/image-assets.png)

<!-- TODO: 画像を貼り付けた状態のスクリーンショット -->

```markdown
![sample image](./assets/sample.png)
```

---

### HTML Export

MarkdownからHTMLを書き出し、公開前の確認や別環境への共有に使えます。

```html
<article>
  <h1>Hazakura Editor</h1>
  <p>Markdown-first safe writing workspace.</p>
</article>
```

<details>
<summary>HTML Export の使いどころ</summary>

- ブログ記事の下書き確認
- LP用テキストの試作
- READMEの表示確認
- AI出力を整形して共有

</details>

---

### Review Navigation

長い文章では、いま自分がどこを読んでいるのか分からなくなりがちです。
見出し単位で移動できると、レビューの負担が下がります。

![Review navigation screenshot placeholder](./screenshots/review-navigation.png)

<!-- TODO: 見出しアウトラインや現在位置が分かるスクリーンショット -->

#### レビューで見るポイント

- [x] 見出し構造は自然か
- [x] 同じ説明を繰り返していないか
- [ ] スクリーンショットの位置は適切か
- [ ] 公開前にリンク切れがないか
- [ ] 読み手にとって最初の一文が分かりやすいか

---

### Non-Git Diff

Git管理されていない文章でも、差分を確認できると便利です。

```diff
- Hazakura Editor は高機能な万能エディタです。
+ Hazakura Editor は文章作業に集中するための安全なエディタです。
```

![Diff screenshot placeholder](./screenshots/non-git-diff.png)

<!-- TODO: 差分比較画面のスクリーンショット -->

---

## 5. モードの考え方

Hazakura Editor は、作業の温度感に合わせてモードを分ける構想を持っています。

| モード | 目的 | 雰囲気 |
|---|---|---|
| 編集モード | 通常のMarkdown作業 | きびきび |
| Safe Edit | 壊さない編集 | 慎重 |
| えるモード | 読む・書く・感じる | 静かな好奇心 |
| Zen Mode | 集中して書く | 余白 |

> モードは機能の切り替えであると同時に、作業の姿勢を変えるスイッチです。

---

## 6. AI時代の「メモ帳」へ

AI時代には、文章が一度で完成することは少なくなります。

人間が書く。
AIが提案する。
人間が選ぶ。
また書き直す。

Hazakura Editor は、この往復を支えるための場所です。

```md
人間: 方向を決める
AI: 案を出す
人間: 判断する
Editor: その過程を安全に置いておく
```

### AIとの作業で大切にしたいこと

- AIに任せすぎない
- 変更差分を確認する
- 元の文章を残す
- すぐ実行できる環境と、考える環境を分ける
- 完成品より、判断の過程を大事にする

---

## 7. サンプル記事ブロック

以下は、実際にHazakura Editorで書く文章のサンプルです。

### 葉桜のころに考える、道具の静けさ

春の盛りを過ぎた桜は、少しだけ目立たなくなる。
けれど、葉桜には葉桜の美しさがある。

満開の派手さではなく、次の季節へ移っていく途中の静けさ。
Hazakura Editor という名前には、そんな変化の途中にある道具でありたい、という気持ちが込められています。

> 書く道具は、主役でなくていい。
> ただ、考える手元に静かにいてくれればいい。

---

## 8. 料金・配布イメージ

> ※このセクションは商品ページ用の仮文です。実際の販売形態に合わせて調整してください。

| プラン | 内容 | 想定ユーザー |
|---|---:|---|
| Preview | 開発版・検証用 | 早期に試したい人 |
| Standard | 基本機能 | Markdownを書く人 |
| Supporter | 支援つき | 開発を応援したい人 |

```yaml
product:
  name: Hazakura Editor
  platform: macOS
  focus:
    - Markdown
    - Safe Editing
    - Review Workflow
    - Calm Writing
```

---

## 9. よくある質問

### Q. プログラミング用のエディタですか？

A. どちらかというと、文章・Markdown・レビューのためのエディタです。コードを書くこともできますが、実行環境としての万能性より、安全で落ち着いた作業場を優先しています。

### Q. AIエージェントは使えますか？

A. 構想上は、明示的に有効化した場合だけ利用できる作業領域を用意する方向です。通常の編集体験とは分け、安全な境界を保つことを重視しています。

### Q. 競合アプリとの違いは？

A. Hazakura Editor は、他のアプリを置き換えるというより、**文章を書く・読む・整える**ための静かな場所を目指しています。多機能さよりも、作業の安全性と集中感を大切にしています。

### Q. 誰に向いていますか？

A. Markdownで記事やメモを書く人、AI出力をレビューする人、長文の仕様書やREADMEを扱う人、軽やかなエディタが好きな人に向いています。

---

## 10. 公開前チェックリスト

- [ ] メイン画面のスクリーンショットを追加
- [ ] Zen Mode のスクリーンショットを追加
- [ ] Diff画面のスクリーンショットを追加
- [ ] Review Navigation のスクリーンショットを追加
- [ ] 実際の価格・配布方法に差し替え
- [ ] 対応OSを確認
- [ ] リンク先を確認
- [ ] App Store版とGitHub版の差分があれば明記
- [ ] 競合名を出さない表現になっているか確認

---

## 11. 短い紹介文

### 1行版

**Hazakura Editor は、Markdownを書く・読む・整えるための、安全で静かなデスクトップエディタです。**

### 3行版

Hazakura Editor は、Markdown-first の文章作成・レビュー用エディタです。
実行環境としての万能性よりも、書くことに集中できる安全な作業場を大切にしています。
AI時代の草稿、メモ、仕様書、記事づくりに向いた、軽やかなエディタです。

### 商品ページ用

Hazakura Editor は、Markdownで文章を書き、読み、整えるためのデスクトップエディタです。
複雑な開発環境ではなく、文章作業に集中できる静かなワークスペースを目指しました。
記事、README、仕様メモ、AI出力のレビュー、長文の下書きに。
「便利すぎて怖い」ではなく、「安心して考えられる」道具へ。

---

## 12. スクリーンショット差し替え一覧

| プレースホルダー | 推奨画像 | 用途 |
|---|---|---|
| `./screenshots/hero-workspace.png` | 全体画面 | 商品ページ冒頭 |
| `./screenshots/workspace.png` | 通常編集画面 | 機能紹介 |
| `./screenshots/zen-mode.png` | Zen Mode | 集中感の紹介 |
| `./screenshots/image-assets.png` | 画像貼り付け | 画像対応の説明 |
| `./screenshots/review-navigation.png` | 見出しナビ | 長文レビューの説明 |
| `./screenshots/non-git-diff.png` | 差分画面 | レビュー機能の説明 |

---

## 13. メモ

<!--
ここは公開時には削除してもOK。

撮影するとよさそうな画面:
1. 左にファイル、中央にMarkdown、右にプレビュー
2. Zen Modeで文章だけが見えている画面
3. Diffで変更前後が分かる画面
4. えるモード相当の落ち着いた執筆画面
5. 画像つき記事を書いている画面

注意:
- 他社アプリ名は出さない
- 「万能」「最強」より「安全」「静か」「集中」を前面に出す
- App Store向け文言では、外部CLIやエージェント機能の説明を慎重にする
-->
