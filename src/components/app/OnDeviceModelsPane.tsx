import { useEffect, useRef } from "react";
import type { PreferencesCopy } from "../../lib/locale";
import type { MenuLanguage } from "../../types";
import { CoreAiGenerationProfile } from "./CoreAiGenerationProfile";
import { CoreAiModelManager } from "./CoreAiModelManager";

/**
 * オンデバイスモデルの独立ページ（Preferences の `models` モード）。
 *
 * ダウンロード・選択・登録解除はモデル一覧が担い、実効の生成設定は helper が返した
 * 直近の記録から出す。Apple-hosted asset pack の保存先は選べない。
 * 外部ローカルモデルは明示フォルダ選択で登録する。自動ダウンロードや起動時の広域スキャンは足さない
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
      <p className="field-hint">{copy.onDeviceModelsIntro}</p>
      <CoreAiModelManager label={copy.onDeviceModels} language={language} />
      <details className="core-ai-manager-details">
        <summary>{copy.onDeviceModelsStorageLabel}</summary>
        <p className="field-hint">{copy.onDeviceModelsStorage}</p>
      </details>
      <CoreAiGenerationProfile language={language} />
    </section>
  </div>;
}
