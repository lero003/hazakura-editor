import { useEffect, useRef } from "react";
import type { PreferencesCopy } from "../../lib/locale";
import type { MenuLanguage } from "../../types";
import { CoreAiGenerationProfile } from "./CoreAiGenerationProfile";
import { CoreAiModelManager } from "./CoreAiModelManager";

/**
 * オンデバイスモデルの独立ページ（Preferences の `models` モード）。
 *
 * ダウンロード・選択・削除はモデル一覧が担い、実効の生成設定は helper が返した
 * 直近の記録から出す。保存先は Apple-hosted asset pack のため選べないので、
 * 選ばせずに説明だけを置く。このページは自動ダウンロードも起動時スキャンも足さない
 * （既存の「明示操作」境界を維持する）。
 */
export function OnDeviceModelsPane({
  copy,
  language,
}: {
  copy: PreferencesCopy;
  language: MenuLanguage;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // 設定本文の入口から来ると、押したボタンごと前のページが消えるのでフォーカスが落ちる。
  // ヘッダーの選択で来た場合は選択にフォーカスが残っているので、そこから奪わない。
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".preferences-header")) return;
    headingRef.current?.focus();
  }, []);

  return <div className="preferences-sections settings-preferences models-preferences">
    <section className="preference-section" aria-label={copy.onDeviceModels}>
      <h3 ref={headingRef} tabIndex={-1}>{copy.onDeviceModels}</h3>
      <p className="field-hint">{copy.onDeviceModelsStorage}</p>
      <CoreAiModelManager label={copy.onDeviceModels} language={language} />
      <CoreAiGenerationProfile language={language} />
    </section>
  </div>;
}
