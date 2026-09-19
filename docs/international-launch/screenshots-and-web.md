# 英語スクリーンショット・Web・告知の制作指示

Status: Proposal — 素材未制作・Web未公開
Scope: 海外向け購入導線と公開用文案
Authority: Advisory
Last reviewed: 2026-09-19

設定・根拠・出荷条件は[販売設定ガイド](README.md)。以下の英語は新規の制作文案で、公開済みサイトからの引用ではない。アプリの追加機能を約束するものではない。

## 1. スクリーンショット

Mac App Storeの受入寸法は **1280×800 / 1440×900 / 2560×1600 / 2880×1800**（16:10）。1〜10枚、JPEG/PNG、アルファ・透明度なしを守る。今回は **2880×1800の5枚** を制作案とする。既存READMEの1280×820を無理に変形せず、英語UIの実際の提出候補から規定に合う構図で撮り直す。[Apple公式仕様](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

デスクトップの個人情報、実原稿、ファイル名、ユーザー名、通知を含めない。入力済みの公開可能なサンプルで撮る。UI文字を後から英語に塗り替えたり、未実装のボタンを加えたりしない。キャッチコピー用の余白を作る場合も、実際のUIを主役にし、縦横比と可読性を保つ。加工後のファイルも寸法・透過・文字の読める大きさを検査する。

| 順 | 英語見出し | 補助コピー | 撮る場面・注意 |
|---|---|---|---|
| 1 | Write in Markdown. Stay in flow. | Your words, with a clear preview beside them. | 編集＋プレビュー。英語の見出し・箇条書き・本文が見える。最初の1枚で何のアプリか分かる |
| 2 | Read your draft like a book. | See the bigger picture with a two-page spread. | Readerの見開き＋目次。複数章を実際に選び、文章のまとまりを示す |
| 3 | From Markdown to EPUB and PDF. | Turn your selected chapters into a book. | 出力ダイアログの実画面。HTMLは現在ファイルのみであることと矛盾させない。ストアへの直接出版機能を示唆しない |
| 4 | Review changes. Keep control. | Choose what to apply and when to save. | 差分確認。旧文と新文の短い変更が読み取れる状態。自動保存・自動採用に見せない |
| 5 | Refine with on-device suggestions. | Local Assist preview on supported Macs. | 対応実機でのLocal Assist提案と確認面。条件付きプレビューの注記を切り落とさない。撮影・英語生成が未検証なら代わりにL Modeを使う |

5枚目の代替案: **A quieter space for your next draft.** / **Focus on the writing with L Mode.** 英語原稿のL Modeと季節テーマを実表示で撮る。AI機能が売り物の全てに見えない並びを守る。

アプリ名・機能名・英語見出しの表記を、掲載本文とWebで揃える。日本語の固有テーマ名は味として残してよいが、メインコピーで意味不明な固有名を増やさない。最初の公開では動画を必須にせず、5枚の静止画の読みやすさを優先する。

### 撮影用の原稿案

架空の個人名や他社ロゴは不要。以下を3つのMarkdownファイルに分ければ、編集、Reader、章の順序、書き出しを同じ内容で説明できる。

```markdown
# A Small Guide to Quiet Work

Good writing starts with a little space: space to notice, to choose,
and to put one clear thought after another.

## Start with one page

- Name the idea you want to explore.
- Write a first paragraph without polishing every sentence.
- Leave a note about what to revisit.
```

```markdown
# Read Before You Revise

Reading a draft in a different shape can reveal what the editing
view hides. A paragraph may need room to breathe. A chapter may need
a clearer beginning.

## A question for the next draft

What should the reader understand before turning the page?
```

```markdown
# Share What Is Ready

Choose the chapters that belong together. Read them once more,
review the changes, and export a copy for someone else to read.

The next draft can begin with what you learn from this one.
```

差分用の修正例: `Good writing starts with a little space.` → `Good writing begins with room to think.`。AI提案として見せる場合は実際の生成結果を使い、この文を生成結果と偽らない。

## 2. Webの設定・原稿案

既存の掲載先候補は次の3つ。**現在の英語掲載・応答状況は未検証**。新しいURLを先にConnectへ入れず、ページを公開してから到達確認する。

| 項目 | 候補URL | 必須確認 |
|---|---|---|
| Marketing URL | `https://hazakura.dev/hazakura-editor/` | 英語または日英併記の製品紹介、購入ボタン、実機画像 |
| Support URL | `https://hazakura.dev/hazakura-editor/support/` | 実際に連絡できる方法、英語FAQ、不具合報告方法 |
| Privacy Policy URL | `https://hazakura.dev/hazakura-editor/privacy/` | アプリ固有の処理と任意通信、問い合わせ/サイトのデータ取扱い |

英語専用URLを作る場合の**未作成案**は `/en/hazakura-editor/` と、その配下の `support/` / `privacy/`。現行ルーティングを確認して採用し、まだ存在しないURLを商品ページへ保存しない。既存URLで日英併記にする方が短い作業なら、その方法でよい。

### 製品ページの英語案

**Page title**

```text
Hazakura Editor - Markdown Writing for Mac
```

**Meta description**

```text
Write in Markdown, read your draft like a book, and export to EPUB or PDF. A calm Mac editor with reviewed changes and optional on-device writing assistance.
```

**H1**

```text
Write in Markdown. Read like a book.
```

**Lead**

```text
A calm space for your next draft. Work with your Markdown files,
read across selected chapters, and export to EPUB or PDF when
it is time to share.
```

**CTA**

```text
View on the Mac App Store
```

購入ボタンには既存のApple ID `6778637880` を使い、Connectで取得した製品リンクを対象地域で確認する。日本ストア固定のリンクだけを海外告知に流さない。言語指定と購入地域は同一ではなく、URLだけで購入者の地域を変更できるとは案内しない。App StoreバッジはApple配布素材と利用条件を確認し、自作の認定マークは加えない。

**Feature headings**

```text
A focused writing view
A book-like reading experience
Changes you can review
EPUB, PDF, and HTML export
On-device assistance, when available
```

価格は対象地域の確認済み表示へ誘導する。固定通貨をWeb本文へ埋め込むより `View pricing on the Mac App Store` とする。買い切りが確認できた有料向けページだけに `One-time purchase. No subscription.` を追加する。

### FAQ原稿

**What files can I work with?**

```text
Hazakura Editor is built around Markdown and text files. Your Markdown
remains the editable source, including when you use L Mode or read
selected chapters as a book.
```

**Can I export a book?**

```text
You can select Markdown chapters in a Book Scope and export them to
EPUB or PDF. Standalone HTML export is for the current document.
Hazakura Editor does not upload your book to a publishing service.
```

**Do I need Local Assist?**

```text
No. Writing, reading, and export work without Local Assist.
Local Assist is an optional on-device preview feature. Availability
depends on your Mac and system configuration.
```

**Does Local Assist send my writing to cloud AI?**

```text
Local Assist uses an available on-device model and has no cloud AI
fallback. You review a proposal before applying it, and choose when
to save. Other optional actions, such as loading remote images or
opening external links, may use a network connection.
```

**Which Macs are supported?**

```text
The current source configuration requires macOS 26.0 or later.
Check the Mac App Store compatibility section for the released build.
Local Assist has additional availability requirements.
```

これは確認前のFAQ文案。公開時には最後の項目の `source configuration` を、提出/公開物との照合後に製品向け表現へ整える。Intel/Apple silicon対応は実際の配布アーキテクチャを見て追記し、ソースの最低OSだけから全Mac対応を推定しない。

### サポートページと受付

英語の問い合わせ導線、対象アプリの名前、版/OSの確認方法を載せる。連絡先はオーナーが受信を検証したものだけを公開する。24時間対応や返信期限を根拠なく約束しない。

```text
Need help with Hazakura Editor?

Please include your app version, macOS version, the steps you tried,
and what happened instead. A short sample document is helpful,
but please remove personal or confidential information first.

For Local Assist issues, please also tell us whether the app shows
an availability message. You do not need to send your private writing.
```

公開する前に、製品・サポート・プライバシーの各ページから英語で相互に移動できること、メール等が受信できることを検査する。プライバシーポリシー全体はこの短いFAQで代用せず、実際のサイト運用とアプリ処理に合わせて日英整合させる。

## 3. GitHub・外部告知の設定案

このPRではGitHubのAbout設定や公開READMEを変更しない。採用時は次を候補にする。

| 場所 | 提案内容 |
|---|---|
| GitHub About description | `A calm Markdown editor for Mac. Write, read like a book, review changes, and export to EPUB or PDF.` |
| GitHub Website | 公開・到達確認済みの英語製品ページ。未作成の英語URLは使わない |
| GitHub Topics | `markdown-editor`, `macos`, `writing`, `epub`, `tauri`。ライセンスが異なるので `open-source` と宣伝しない |
| README冒頭 | 英語の製品説明とMac App Storeへの導線を追加する別変更。Developer専用Agentと購入版の違いを維持 |
| 公開用メディア | 英語の実画像、短い製品概要、対応条件、正式な購入先を揃える。非公開の提出画像/メモとは分離 |

英語告知文のたたき台:

```text
I built Hazakura Editor for people who like writing in Markdown
but want to read their drafts like a book.

It brings focused editing, a two-page reading view, change review,
and EPUB/PDF export into one Mac app. On supported systems,
optional on-device writing assistance lets you review suggestions
before applying them.

I would love feedback on the write -> read -> revise workflow,
especially from people working on essays or multi-chapter drafts.
```

告知では開発者本人であることを明示し、投稿先の自己宣伝ルールをその時点で確認する。大量の同文投稿、好意的レビューとの交換、競合名を使ったKeywords詰め込みはしない。まず既存の発信先と、執筆・Markdownに関心のある小さな対象へ届ける。掲載前に英語の第三者に購入ページと初回利用を見てもらい、「何ができるアプリか」「AIなしでも欲しいか」を確認する。

## 4. 初回公開の完了条件

英語原稿、5枚の実画像、英語サポート、プライバシー説明、地域別価格、実機受入が同じ出荷版について揃ったら公開する。必要項目が揃っていない状態で「海外対応完了」と宣伝しない。改善結果は[販売設定ガイド](README.md)のSales and Trendsと問い合わせ記録で観測する。
