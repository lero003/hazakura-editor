import { useEffect, useState } from "react";
import type { MenuLanguage } from "../../types";
import {
  getLocalAssistGenerationProfile,
  listenLocalAssistGenerationProfileChanges,
  type LocalAssistGenerationProfile,
} from "../../lib/tauri/coreAiModels";

/**
 * Read-only view of the last Local Assist run's generation settings.
 *
 * Every value is recorded by Rust from the helper's own `usage` envelope. The
 * panel renders what it is handed and never restates a limit or sampler of its
 * own, so a wiring change cannot leave the screen describing the old harness.
 */
export function CoreAiGenerationProfile({ language }: { language: MenuLanguage }) {
  const [profile, setProfile] = useState<LocalAssistGenerationProfile | null>(null);
  const copy = profileCopy(language);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    // 通知は「購読してから読む」。逆順だと、購読が終わる前の更新を取り逃し、
    // 古いスナップショットが残る。`generation` は通知が届いたことを数え、
    // 保留中だった取得結果が後から上書きするのを防ぐ。
    let generation = 0;
    // この面は診断用。読めなくても Preferences の残りを止めず、空状態のままにする。
    void (async () => {
      let stop: (() => void) | undefined;
      try {
        stop = await listenLocalAssistGenerationProfileChanges((next) => {
          generation += 1;
          if (!disposed) setProfile(next);
        });
      } catch {
        // 購読できない場合は、下のスナップショットだけでも表示する。
      }
      if (disposed) {
        stop?.();
        return;
      }
      unlisten = stop;
      const observedGeneration = generation;
      try {
        const next = await getLocalAssistGenerationProfile();
        // 取得中に通知が来ていれば、その通知の方が新しい。
        if (!disposed && generation === observedGeneration) setProfile(next);
      } catch {
        // 取得できなければ空状態のまま。
      }
    })();
    return () => { disposed = true; unlisten?.(); };
  }, []);

  const rows = profile ? [
    { label: copy.maximumResponseTokens, value: profile.maximumResponseTokens == null
      ? copy.unknown
      : copy.tokens(profile.maximumResponseTokens) },
    { label: copy.samplingRequested, value: profile.samplingRequested ?? copy.unknown },
    { label: copy.samplingEffective, value: profile.samplingEffective ?? copy.unknown },
    { label: copy.tokenCounts, value: tokenCounts(profile, copy) },
    { label: copy.model, value: profile.modelId },
  ] : [];

  return <details className="core-ai-model-manager core-ai-generation-profile">
    <summary>
      <span className="core-ai-model-manager-heading core-ai-generation-profile-summary">
        <span>{copy.title}</span>
        <span>{copy.sessionScope}</span>
      </span>
    </summary>
    {profile ? <div className="core-ai-model-list">
      {rows.map((row) => <div className="core-ai-model-row" key={row.label}>
        <div>
          <strong>{row.label}</strong>
          <span>{row.value}</span>
        </div>
      </div>)}
    </div> : <p className="field-hint" role="status">{copy.empty}</p>}
    <p className="field-hint">{copy.boundary}</p>
  </details>;
}

type ProfileCopy = ReturnType<typeof profileCopy>;
function tokenCounts(profile: LocalAssistGenerationProfile, copy: ProfileCopy): string {
  const parts: string[] = [];
  if (profile.promptTokens != null) parts.push(copy.promptTokens(profile.promptTokens));
  if (profile.outputTokens != null) parts.push(copy.outputTokens(profile.outputTokens));
  if (profile.cachedTokens != null) parts.push(copy.cachedTokens(profile.cachedTokens));
  return parts.length > 0 ? parts.join(" / ") : copy.unknown;
}

function profileCopy(language: MenuLanguage) {
  if (language === "en") return {
    title: "Last generation record",
    sessionScope: "This session",
    maximumResponseTokens: "Max output",
    samplingRequested: "Sampling (requested)",
    samplingEffective: "Sampling (effective)",
    tokenCounts: "Last token counts",
    model: "Last model",
    unknown: "Not recorded",
    tokens: (count: number) => `${count} tokens`,
    promptTokens: (count: number) => `in ${count}`,
    outputTokens: (count: number) => `out ${count}`,
    cachedTokens: (count: number) => `cached ${count}`,
    empty: "No Core AI generation has been recorded in this session yet. Run one generation with a Core AI model and the requested and effective settings appear here.",
    boundary: "These values come from this Mac's own run. Nothing is saved or sent.",
  };
  if (language === "kana") return {
    title: "さいきんの せいせいきろく",
    sessionScope: "この きどうちゅうの きろく",
    maximumResponseTokens: "しゅつりょくの かぎり",
    samplingRequested: "えらびかた（もとめた もの）",
    samplingEffective: "えらびかた（じっさいの もの）",
    tokenCounts: "さいきんの トークンの かず",
    model: "さいきんの もでる",
    unknown: "きろくなし",
    tokens: (count: number) => `${count} トークン`,
    promptTokens: (count: number) => `にゅうりょく ${count}`,
    outputTokens: (count: number) => `しゅつりょく ${count}`,
    cachedTokens: (count: number) => `キャッシュ ${count}`,
    empty: "この きどうでは まだ Core AI の せいせいを きろくして ゐません。Core AI の もでるで いちど せいせいすると、もとめた せっていと じっさいの せっていが ここに でます。",
    boundary: "この きろくは この Mac の けっかだけを しめします。ほぞんも そうしんも しません。",
  };
  return {
    title: "直近の生成記録",
    sessionScope: "この起動中の記録",
    maximumResponseTokens: "出力の上限",
    samplingRequested: "サンプリング（要求）",
    samplingEffective: "サンプリング（実効）",
    tokenCounts: "直近のトークン数",
    model: "直近のモデル",
    unknown: "記録なし",
    tokens: (count: number) => `${count} トークン`,
    promptTokens: (count: number) => `入力 ${count}`,
    outputTokens: (count: number) => `出力 ${count}`,
    cachedTokens: (count: number) => `キャッシュ ${count}`,
    empty: "この起動ではまだ Core AI の生成を記録していません。Core AI モデルで一度生成すると、要求した設定と実際に使われた設定がここに出ます。",
    boundary: "この記録はこの Mac での実行結果だけを表示します。保存も送信もしません。",
  };
}
