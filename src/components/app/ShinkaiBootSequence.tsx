import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * ShinkaiBootSequence
 *
 * 深海ジョークテーマへの切り替え (false → true) で流れる 2.6 秒の
 * 「静寂 → 水流が満ちる → チリが光を帯びる → 静かに落ち着く」演出。
 * サイバー調のタイプライター文字も縞も持たず、滑らかな光の勾配だけで描く。
 * CRT の「電源 ON → 収縮」の真逆で、静かで有機的。
 *
 * phase 構成:
 *   still   (0〜0.5s)  : 静寂、上端に光が静かに差し込む
 *   flow    (0.5〜1.2s): 水流が満ち、光が水中へ広がる
 *   drift   (1.2〜2.0s): チリが光を帯び、水中光が安定する
 *   settle  (2.0〜2.6s): ブートがフェードアウトし、背面 canvas が自然に現れる
 *   done    (2.6s)
 *
 * ガード:
 *   - prefers-reduced-motion: reduce → 即 done (演出スキップ)
 *   - intensity === "off" → 即 done (他 shinkai 演出と一貫)
 *   - trigger が true のままでも初回マウントで一度だけ発火する
 *     (アプリ起動時に shinkai テーマなら自動発生)
 */

type ShinkaiBootSequenceProps = {
  intensity: AmbientIntensity;
  trigger: boolean;
};

type Phase = "still" | "flow" | "drift" | "settle" | "done";

const PHASE_TIMINGS: { phase: Phase; at: number }[] = [
  { phase: "still", at: 0 },
  { phase: "flow", at: 500 },
  { phase: "drift", at: 1200 },
  { phase: "settle", at: 2000 },
  { phase: "done", at: 2600 },
];

// 初回マウント時に発火条件を満たすなら "still" で始める。
// 通常は初回 phase="done" → null で、effect 実行後に "still" になるが、
// その間の frame でブートが存在せず、背後の canvas (水中チリ) と半透明化した
// クロムが一斉に薄洩れしてチラつく。初回から "still" で不透明なブート全面覆いを
// 置くことで、frame 0 から canvas とクロムを隠す。
// 発火条件は effect 内の shouldFire と一貫 (trigger && !off && !reduce-motion)。
function computeInitialPhase(
  intensity: AmbientIntensity,
  trigger: boolean,
): Phase {
  if (!trigger) {
    return "done";
  }
  if (intensity === "off") {
    return "done";
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "done";
  }
  return "still";
}

export function ShinkaiBootSequence({ intensity, trigger }: ShinkaiBootSequenceProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    computeInitialPhase(intensity, trigger),
  );
  // trigger の前回値。初回マウント時は起動状態を保持しないため false 扱いで、
  // trigger === true なら初回でも発火する。
  const prevTriggerRef = useRef(false);
  // 進行中のタイマー群。クリーンアップで全破棄する。
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const prev = prevTriggerRef.current;
    prevTriggerRef.current = trigger;

    // false → true の遷移、または初回マウント時に trigger === true なら発火
    const shouldFire = !prev && trigger;
    if (!shouldFire) {
      return;
    }

    // intensity === "off" は演出しない (他 shinkai 演出と一貫)
    if (intensity === "off") {
      setPhase("done");
      return;
    }

    // prefers-reduced-motion では演出をスキップ
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }

    setPhase("still");
    const timers = PHASE_TIMINGS.map(({ phase: p, at }) =>
      window.setTimeout(() => setPhase(p), at),
    );
    timersRef.current = timers;

    return () => {
      for (const t of timers) {
        window.clearTimeout(t);
      }
      timersRef.current = [];
    };
  }, [trigger, intensity]);

  if (phase === "done") {
    return null;
  }

  return (
    <div className={`shinkai-boot shinkai-boot-${phase}`} aria-hidden="true">
      <div className="shinkai-boot-ray" />
      <div className="shinkai-boot-glow" />
    </div>
  );
}
