import type { MenuLanguage } from "../../types";

export function ComparisonTargets({ left, right, menuLanguage, restorable = false }: {
  left: { name: string; label: string; path?: string };
  right: { name: string; label: string; path?: string };
  menuLanguage: MenuLanguage;
  restorable?: boolean;
}) {
  const copy = menuLanguage === "en"
    ? { targets: "Comparison targets", readOnly: "Read-only comparison. Closing it does not change or save the document.", restore: "Restore replaces the current buffer with the backup. It does not save automatically; Undo is available." }
    : menuLanguage === "kana"
      ? { targets: "くらべる ふみ", readOnly: "くらべるだけです。とぢても ふみは かへず、ほぞんしません。", restore: "もどすと いまの へんしゅうを バックアップに おきかへます。じどうでは ほぞんせず、もとに もどせます。" }
      : { targets: "比較対象", readOnly: "比較のみです。閉じても本文は変更せず、保存もしません。", restore: "復元すると現在の編集をバックアップに置き換えます。自動では保存せず、Undoで戻せます。" };
  return <div className="comparison-context">
    <div className="comparison-targets" role="group" aria-label={copy.targets}>
      {[left, right].map((target, index) => <div className="comparison-target" key={index}>
        <span>{target.label}</span><strong title={target.path || target.name}>{target.name}</strong>
      </div>)}
    </div>
    <p>{restorable ? copy.restore : copy.readOnly}</p>
  </div>;
}
