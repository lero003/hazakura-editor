# Edohigan Theme Plan (v1.6) — 深海越え

Status: 深海越え実装 (彼岸の春風)
Authority: Reference
Last reviewed: 2026-07-09

## North Star

深海が「水」なら江戸彼岸は「風」。  
空・雲・光・花粉・花弁が **同じ baseFlow** に乗り、手で払うと世界全体が流れて戻る。

## 勝ち筋 vs 深海

| | 深海 | 江戸彼岸 |
|---|---|---|
| 媒体 | 水 + curl + velocity field | **春風** + curl + velocity field |
| 形 | FBM 粒 | **SDF 花弁** + 雲 |
| 色 | 暗 teal | **薄暮 藍紫〜薄紅** |
| 起動 | 潜る | **彼岸へ渡る** (空が開く→満開→散華) |

## 構成

- `EdohiganShaderOverlay.tsx` — flow field + 全層が風に乗る
- `EdohiganBootSequence.tsx` — 2.6s 彼岸渡り
- `edohigan-theme.css` — 薄暮パレット・半透明 surface
- テーマ一覧 **末尾**、ラベル **江戸彼岸（静謐）**

## Flow field (深海パターン参照)

```
48×27 RG8, FORCE_BOOST≈9.5, RADIUS≈3.5
DAMPING 0.005 (余韻長め), DIFFUSE 0.13, ADVECT 0.55
```

## シェーダー層

```
薄暮空 → 春光ハロー/shaft(風で歪む)
→ 雲3層(flow ドリフト・裂け)
→ 霞・花粉3層
→ 花弁 SDF 3層
→ マウス陽光
```

## 残課題

- 実機での force / density 微調整
- roadmap / current-status の sakura 表記
