# Edohigan Theme Plan (v1.6)

Status: 最上級・静謐エディタ化
Scope: 江戸彼岸テーマの方針と実装メモ
Authority: Reference
Last reviewed: 2026-07-09

## 目的

彼岸の書斎 — 和紙の上に、ごく薄い春の気配だけがある。
他テーマより **高級感ある静かな執筆空間** としての最上級テーマ。
処理コストはジョーク枠として度外視してよいが、見た目は抑制する。

## テーマ一覧での位置

**末尾**（設定 UI / ネイティブメニュー共通）:

```
light → dark → yakou → shokou → crt → shinkai → edohigan
```

## コンセプト

**静かだが、追随を許さないほど凝る。**  
派手さでなく **層の数と計算の丁寧さ** で最上級を作る。

| 安い (排除) | 最上級・静謐 |
|---|---|
| キラキラ / 強グロー / 太陽ディスク / 多条 rays | 低コントラスト多層・遠方の光の気配 |
| 縦落ちの雪粒 | ひらひら花弁 3 層 + 微粒子 + 空気層 |
| 桃ベタ・「お遊び」 | 和紙・墨・ラベル「江戸彼岸（静謐）」 |

ラベル: `江戸彼岸（静謐）` / `Edohigan (Quietude)` / `えどひがん（しじま）`

## 構成

- `src/styles/edohigan-theme.css` — 和紙パレット、グローなし
- `EdohiganShaderOverlay.tsx` — 静謐背景 + 手の春風
- `EdohiganBootSequence.tsx` — 淡い起動 (2.6s)
- 設定 / `menu.rs` — 表示順末尾、ラベル「江戸彼岸」

## シェーダー語彙 (Boot / Overlay 同期)

```
多帯域春霞空 + 色温度うねり
→ 遠方ソフトハロー + 単軸の極薄光筋
→ 三重ドメインワープ雲 (縁に極薄桜・下影)
→ パララックス空気 2 層 + 水平霞帯
→ 浮遊微粒子 (暖白、雪ではない)
→ 花弁 SDF 3 層 (ゆっくりひらひら)
→ 手の春風 (控えめだが確実)
→ 紙の繊維 + 極薄 grain
```

### 花弁パラメータ (目安)

```
far: scale≈12, sizeBase≈0.12, density≈0.22
mid: scale≈7.2, sizeBase≈0.17, density≈0.18
fg:  scale≈4.5, sizeBase≈0.23, density≈0.14
```

## 解決済みメモ

- pnpm-lock 混入による CodeMirror クラッシュ (`ad0ec3e0`)
- 分岐内 fwidth による罫線
- ピンク霧 / 雪見え / 安い派手演出の排除

## 残課題

- 実機での密度・雲の見え方の好み微調整
- docs/roadmap・current-status の sakura → edohigan 表記
- origin への push
