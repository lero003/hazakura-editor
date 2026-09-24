# Hazakura Editor 海外販売・ストア設定ガイド

Status: Proposal — 未適用・オーナー確認待ち
Scope: Mac App Store の英語圏向け設定、掲載文案、公開前確認
Authority: Advisory（製品・配布・リリースの正本を上書きしない）
Last reviewed: 2026-09-24

## 結論と使い方

海外向けには **「Markdownで書き、本として読み、EPUB/PDFで届ける、買い切りのMac用エディタ」** を主軸にする。Local Assistは対応環境限定の補助価値として説明し、AIだけを購入理由にしない。まず英語圏の掲載・購入・初回起動を一続きに整える。新しい課金機構や多言語の大量追加は今回の前提にしない。

これは設定変更の実施記録ではない。App Store Connectの認証済み画面、販売国、現行価格、契約、プライバシー回答は未確認。2026-09-24の公開URL確認では製品ページは日本語、SupportとPrivacyの本文は英語だがHTMLの言語宣言は`ja`だった。オーナーは今回、英語掲載文を優先し、公式製品サイトの日本語維持を許容している。公開Privacyの任意通信・Core AIの記述はアプリ実装と再照合が必要。

- [英語掲載文案](app-store-en-US.json): 手動転記用。APIへの送信形式ではない。`metadata` の各値だけを対応欄へ貼る。
- [スクリーンショット・Web・告知案](screenshots-and-web.md): 実画像は別途撮影。Web変更も別作業。
- [文字数検査](validate_metadata.py): `python3 docs/international-launch/validate_metadata.py`。通信・アップロードは行わない。
- [3.1掲載文パケット](../releases/3.1.0-app-store-listing-copy.md): 日本語説明・画像案・審査メモへの入口。英語JSONも3.1へ更新済みだが、未適用のproposalを維持する。

買い切り、販売価格、対象国は提案であり承認済み設定ではない。既存の日本向け価格・販売国を勝手に変更しない。マージしてもストア、Web、アプリ本体の挙動は変わらない。

### v3.1 I-0での位置づけ

このディレクトリはI-0のうち、リポジトリから確認できる技術／掲載素材の棚卸しを担う。
対象地域・価格・契約・税務・公開URL・問い合わせ責任はオーナー確認が必要で、I-0全体の
完了条件には含めたままにする。棚卸しで見つかったHTML `lang`の不整合はI-0aで修正し、
メイン窓とLocal Assist窓を表示言語へ同期した。I-0bでは主要英語導線のcopyを静的に棚卸しし、
致命的フロントエラー復旧面の日本語固定を修正した。詳細は
[I-0b静的棚卸し](../reviews/2026-09-20-v3.1-i0b-english-major-flow-static-audit/README.md)。
bundleの言語宣言とI-1はbuilt app／署名候補の確認と上記判断が閉じた後に進める。
英語コピーの存在だけで英語受け入れや海外販売の完了を主張しない。

## 1. 調査した現状

以下の棚卸しは当時の `main` **`4d74b75a0ab2640471e6bc9977aec9785bcde148`** の履歴。
2026-09-22の英語JSONは`8dffa835`へ更新した。Core AIの管理・選択・生成接続は進んだが、
配布と実機受入は未完了。現在地は[3.1提出文案](../releases/3.1.0-app-store-release-notes.md)を参照する。
以下を現在の未実装判定や公開バイナリの証跡に使わない。

| 項目 | 確認結果と販売への含意 |
|---|---|
| 製品 | Markdown、L Mode、見開きReader、章のBook Scope、差分、明示保存、HTML/PDF/EPUB出力。まずこの流れを売る。 |
| 英語UI | `src/lib/locale/editorChrome.ts` に英語文言あり。`useAppPreferences.ts` の `readStoredMenuLanguage()` は保存値が `ja` / `kana` 以外なら `en`。**英語化をゼロから始める状態ではない**。全画面・ヘルプ・ネイティブUIの翻訳完了までは断定しない。 |
| 動作条件 | `src-tauri/tauri.conf.json` の最低OSは `26.0`。ストアの互換性表示と提出物も照合する。「すべてのMac対応」とは書かない。 |
| Local Assist | オンデバイスSystem経路のプレビュー。提案は明示反映、保存は別操作。利用可否に条件がある。 |
| 未実装・別レーン | モデルDL・選択・MLXは計画段階。Agent Workbench/外部CLIはDeveloper専用。Mac App Storeの販売文へ混ぜない。 |
| 通信 | リモート画像は既定OFFだが明示許可で通信する経路がある。外部リンクも開ける。「一切通信しない」は不可。 |
| 配布状態 | ソース3.0.3、App Store設定build 140。正本は9月18日の実機確認・申請の記録。3.0.3の公開済み・全地域配信済みとは確認していない。 |
| 既存画像 | READMEは1280×820のキャプチャと記載。Mac App Store規定サイズへの再撮影・書き出しが必要。 |

確認元: [README](../../README.md)、[製品方針](../product-brief.md)、[現状](../current-status.md)、[配布境界](../app-store-build.md)、[通信境界](../security-boundary.md)、[英語文言](../../src/lib/locale/editorChrome.ts)、[初期言語](../../src/hooks/app/useAppPreferences.ts)、[Tauri設定](../../src-tauri/tauri.conf.json)、[MAS設定](../../src-tauri/tauri.conf.appstore.json)、[3.0.3変更内容](../releases/3.0.3-app-store-release-notes.md)。再調査時は上記固定コミットとの差分を確認する。

## 2. 最初にやる設定と順番

P0は海外向けに積極告知する前の確認、P1は掲載改善、P2は結果を見て追加する。担当はConnect操作＝オーナー、撮影/実機確認＝開発担当、Web公開＝サイト管理者。

| 優先 | 場所・操作 | 推奨する設定内容 | 完了条件 |
|---|---|---|---|
| P0 | Connect → Apps → Hazakura Editor | 現在の版、審査状態、言語、地域、価格予定を控える | 変更前の証跡を非公開で保存。申請中の3.0.3をこの作業のためだけに取り消さない |
| P0 | Business → Agreements / Banking / Tax | 有料配信用契約、銀行口座、必要税務情報の状態を確認 | 有料配信に必要な項目が有効。契約・税務の未処理を解消 [A4] |
| P0 | Monetization → Pricing and Availability | 告知対象国で実際に購入可能か確認 | 国別の価格と販売状態を確認。日本向け施策を壊さない |
| P0 | 実際の提出候補アプリ | 英語で初回起動から保存・Reader・出力まで確認 | 下記の英語受入チェックを完了 |
| P1 | 編集可能なmacOSバージョン → 言語メニュー | `English (U.S.)` を追加、または既存文案を更新 | 英語名・説明・Keywords・画像・URLが同じ版を説明する [A1–A3] |
| P1 | App Information | 英語Name `Hazakura Editor`、Subtitle `Markdown to EPUB & PDF` | 名前30文字/副題30文字以内。主カテゴリProductivityを維持 [A2] |
| P1 | macOSバージョンの英語欄 | 同梱JSONのDescriptionとKeywordsを転記 | 4000文字/100バイト以内。未出荷機能・誇張なし [A3] |
| P1 | Screenshots | 英語UI・英語原稿による5枚を優先 | 先頭3枚で書く/読む/届けるが伝わる。寸法・透明度・版が適合 [A6] |
| P0 | Support URL / Marketing URL / Privacy Policy URL | 実在する英語または日英併記ページへ接続 | ログインなしで開け、問い合わせ方法と利用条件が読める [A2,A3,A7] |
| P0 | App Privacy / Age Rating / Compliance | 実装・SDK・配布国に即して回答を再点検 | 「ローカルだから全項目なし」と機械的に回答しない |
| P2 | 追加言語・EU・その他の地域 | 実際の需要とサポート能力に応じて追加 | 言語ごとに説明・画像・サポートと規制確認を揃える |

### 言語と地域は3つに分ける

**販売地域、ストア説明の言語、アプリ本体の言語は別管理。** 英語説明を追加してもアプリの言語宣言は変わらない。逆に英語UIがあっても海外ストアで英語説明が表示されるとは限らない。各地域の対応ロケールとフォールバックを実ページで確認する。[A1]

最初の告知対象案は米国・英国・カナダ・オーストラリア・ニュージーランド。これは市場規模調査による順位ではなく、英語素材を共用して運用負担を抑える提案。既存の販売地域をこの5か国だけへ縮小する指示ではない。`en-US` を元稿に、必要な `en-GB` / `en-CA` / `en-AU` も対象ストアの対応を確認して揃える。

Primary Languageは当面**現状を維持**。日本語から英語へ変えるなら、英語ローカライズの承認済み版・必要スクリーンショットなどAppleの条件を満たしてから別途判断する。新規言語には主言語の画像等が引き継がれるため、英語説明だけ追加して日本語画像を残さない。[A1]

## 3. 価格・販売設定の案

**先に現行海外価格を把握し、原則据え置きで掲載を改善する。** 値下げと画像変更を同時に行うと原因を切り分けにくい。価格未決定なら、米国 **US$4.99の買い切り** を初回検証候補にする。これは需要・競合価格を検証済みの最適値ではなく、オーナーが選ぶ試験価格。実際に選択できる価格ポイントをConnectで確認する。

| 項目 | 提案 |
|---|---|
| 課金方式 | アプリ本体の買い切りを優先。海外展開のためだけにサブスク/IAPを新設しない |
| 既存海外価格 | まず維持。未設定時だけ上記候補と比較して決定 |
| 他通貨 | 基準国の価格からAppleの比較価格を確認。換算額を手計算して販売価格として公表しない |
| 日本 | 日本だけ無料などの施策が現在有効なら、その価格予定を保全。現在無料とは未確認 |
| 将来値上げ | 購入・返金・問い合わせの実績を見て検討。予定が未承認のまま期間限定割引を宣伝しない |

Connectでは基準国の価格から他地域を自動調整する方式と地域別手動管理を区別する。手動管理した地域ではAppleによる為替・税の自動調整が止まる。[A4,A5]

日本だけ価格を変える場合は、Price Scheduleの**対象地域と基準国**を先に確認する。地域別のCustom Price Changeでは基準国を選べない。基準国を含む全地域の手動管理は自動調整の範囲も変えるため、「日本を無料にするつもりでGlobal Price Changeを無料へ変更」はしない。既存基準国を変更する必要があるときも、全地域の変更前後をオーナーが確認してから操作する。[A5]

価格文言を使うのは有料・サブスクなしを確認した地域だけ。`One-time purchase. No subscription.` は条件付き候補とし、無料地域に共用する本文には入れない。「将来の全メジャー版まで永久無料更新」は約束しない。

## 4. プライバシー・権利・地域条件

以下は提出前の確認事項で、法務・税務判断の代行ではない。

**App Privacy:** 候補は実態に合えば `Data Not Collected`。ただし今回、回答を確定する全依存・通信監査は実施していない。本文/AI処理、診断送信、第三者SDK、リモート画像、問い合わせ導線を棚卸しする。Appleの「収集」は単なる通信有無とは異なり、端末外でリアルタイム処理を超えてアクセス可能にする保存等を含む。Webサイトのアクセスログやサポートメールの扱いも説明し、アプリラベルとの範囲を整理する。任意送信だけで自動的に申告不要になるわけではない。[A7]

販売文では `Local Assist runs on your Mac without a cloud AI fallback.` のように対象を限定する。`No network traffic` / `Your data never leaves your device` / `100% secure` は使わない。リモート画像と外部リンクの通信可能性をプライバシー説明にも反映する。

**EUのDSA:** EU向けに配信するならtrader自己判定・必要情報の検証を確認する。個人開発者でも商業活動ならtraderに該当し得る。traderでは住所または私書箱、電話、メールが商品ページで公開される。EU非配信でもステータス申告は必要。「住所を出したくないからnon-trader」は判断理由にしない。判断が難しければ専門家へ確認し、未整備のまま新たにEUへ広げない。[A8]

**その他:** 年齢レーティングは現行質問票を実態どおり回答し、AIがあるから高年齢/エディタだから4+と決め打ちしない。暗号化申告はHTTPS・OS標準暗号と独自暗号の利用を提出物で確認する。中国本土など追加条件がある地域を一括で増やさない。画面素材、フォント、同梱ライセンス、第三者著作物の権利も確認する。アクセシビリティの対応ラベルは対象機能の実機検証後に申告する。[A2,A11]

カテゴリはApp Store設定とバンドルのProductivityを一致させる。副カテゴリは無理に埋めない。Copyrightは権利者を確認して記入（構成上の候補は `2026 Hazakura Lab`）。アプリ名・publisherの表示を変更しても販売者の法的名義を変更したことにはならない。

審査担当向けの説明は「アカウントの要否、英語操作導線、Local Assistの利用条件、明示反映/保存、AI非対応時の通常機能」を実機に合わせて準備する。実際の審査文・個人連絡先・契約情報・証明書・提出画像は既存ルールどおり非公開の `docs/internal/` 等で管理し、この公開文書には貼らない。

## 5. 英語向け出荷ゲート

次のチェックは**今回未実施**。ソースに英語文字列があることと、署名済み配布物の使いやすさは別。

- [ ] 新しい設定状態で英語起動し、日本語/英語の切替・再起動後の保持を確認。利用者の既存データは消さず専用テスト環境を使う。
- [ ] ネイティブメニュー、開始画面、保存/衝突/復元、Preferences、Help、Reader、出力、Local Assist、エラーと利用不可理由を英語で通す。翻訳漏れだけでなく長い英語ラベルの欠けも確認。
- [ ] 英語原稿を開く→編集→明示保存→再度開く。複数章を選んでReader→EPUB/PDF出力。HTMLは現在ファイルの出力として確認する。
- [ ] Local Assistが使えるMacで提案→比較→反映→Undo→保存を確認。利用不可でも通常の執筆/読書/出力が使えることを確認。
- [ ] 提出候補のInfo.plist、同梱ローカライズ、最低OS、対応アーキテクチャと、ストアの「言語」「互換性」を照合。宣言だけを増やして英語対応済みにしない。
- [ ] 英語UIの実画像と本文が同じ出荷版を示し、非対応機能やDeveloper専用メニューを見せていない。
- [ ] 各対象地域の価格・英語表示・購入導線、Support/Privacy/Marketingのリンクを公開後にも確認する。

## 6. 運用と計測

初回は英語説明、英語画像、英語サポートをひとまとまりに公開し、変更日時・対象地域を非公開運用メモへ残す。開始日と同じ時間帯基準で、まず4週間を観測窓の案とする。データが少なければ結論を急がない。

Sales and Trendsでアプリを絞り、地域別のApp Units、Sales、Proceeds、Refundsを確認する。日本の無料ダウンロード数を海外有料購入と混ぜず、更新/再DLも新規購入と区別。Proceedsは税と手数料後の見積りで、確定入金と同一ではない。[A9]

問い合わせでは「英語で迷った箇所」「期待と違った機能」「購入理由」を記録する。初回改稿後の次の改善は先頭画像・副題・価格のうち1つずつ。前後比較は季節性や流入変化を含む観測であり、無作為A/Bテストとは呼ばない。

AppleのProduct Page OptimizationとCustom Product Pagesは現行案内ではiOS/iPadOS向け。**ネイティブmacOSアプリの必須施策にしない**。[A10] App Analyticsの指標、キャンペーン帰属、広告商品もMacへの適用を個別確認し、画面にない指標や購入帰属を約束しない。計測だけを目的に追跡SDKを追加しない。

## 7. 文案の適用・検証範囲

同梱JSONは `publish_ready: false` の提案。`metadata` 以外の状態・条件・解説を掲載欄へ貼らない。`whats_new_version` は **3.1.0専用**で、別の提出版には流用せず変更履歴から書き直す。プロモーションテキストは170文字以下の任意素材で、Macの商品ページでの入力可否・表示を確認し、表示されなくても説明冒頭だけで価値が伝わる構成にしている。

この文案更新の検査対象は文書、JSONの構文・文字数・KeywordsのUTF-8バイト数・重複、文書内リンク、差分の空白と公開文の衛生。アプリのソース、依存、版数、署名設定は変更しない。別作業の署名pkg生成とは切り離し、今回の文案更新では実機確認、ストアへの保存/送信、Web公開は実施していない。

## 参考資料（Apple公式、2026-09-19確認）

- [A1: ストア情報のローカライズ](https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information)
- [A2: App information（名前・副題・カテゴリ等）](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)
- [A3: Platform version information（説明・Keywords・URL等）](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
- [A4: 価格設定](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/)
- [A5: 地域別・期間別の価格変更](https://developer.apple.com/help/app-store-connect/manage-app-pricing/schedule-price-changes-for-apps)
- [A6: スクリーンショット仕様](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [A7: App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [A8: EU DSAのtrader要件](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
- [A9: Units・Sales・Proceeds・Refunds](https://developer.apple.com/help/app-store-connect/measure-app-performance/view-units-proceeds-sales-and-pre-orders)
- [A10: Product Page Optimization](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization)、[Custom Product Pages](https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions)
- [A11: App Store Connect Help（年齢・暗号化・各地域・アクセシビリティの現行手順）](https://developer.apple.com/help/app-store-connect/)
