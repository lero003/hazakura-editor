import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * CrtBootSequence
 *
 * CRT ジョークテーマへの切り替え (false → true) で流れる 1.5 秒の
 * 「ブラウン管 TV の電源 ON → 起動メッセージ → 起動完了」演出。
 * サイバーパンク調の純オリジナル文体で、実 BIOS / Ghostty の文言を避ける。
 *
 * phase 構成:
 *   power-on (0〜0.35s) : 中央の横線 → 円形フラッシュ
 *   signal   (0.35〜1.1s): 1 行目タイプライター表示
 *   ready    (1.1〜2.0s) : 2 行目タイプライター表示
 *   collapse (2.0〜2.5s) : 縦線に縮んで消える (ブラウン管 OFF 風)
 *
 * ガード:
 *   - prefers-reduced-motion: reduce → 即 done (演出スキップ)
 *   - intensity === "off" → 即 done (他 CRT 演出と一貫)
 *   - trigger が true のままでも初回マウントで一度だけ発火する
 *     (アプリ起動時に crt テーマなら自動発生)
 */

type CrtBootSequenceProps = {
  intensity: AmbientIntensity;
  trigger: boolean;
};

type Phase = "power-on" | "signal" | "ready" | "collapse" | "done";

const PHASE_TIMINGS: { phase: Phase; at: number }[] = [
  { phase: "power-on", at: 0 },
  { phase: "signal", at: 350 },
  { phase: "ready", at: 1100 },
  { phase: "collapse", at: 2000 },
  { phase: "done", at: 2500 },
];

export function CrtBootSequence({ intensity, trigger }: CrtBootSequenceProps) {
  const [phase, setPhase] = useState<Phase>("done");
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

    // intensity === "off" は演出しない (他 CRT 演出と一貫)
    if (intensity === "off") {
      setPhase("done");
      return;
    }

    // prefers-reduced-motion では演出をスキップ
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }

    setPhase("power-on");
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
    <div className={`crt-boot crt-boot-${phase}`} aria-hidden="true">
      <div className="crt-boot-flash" />
      <div className="crt-boot-lines">
        <span className="crt-boot-line crt-boot-line-1">
          SIGNAL FOUND // HAZAKURA NEURAL LINK
        </span>
        <span className="crt-boot-line crt-boot-line-2">
          AUTH OK // WELCOME BACK, NETRUNNER
        </span>
      </div>
    </div>
  );
}
