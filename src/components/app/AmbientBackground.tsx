import { useEffect, useMemo, useRef } from "react";
import type { AmbientIntensity } from "../../types";
import {
  ambientQualityDprCap,
  ambientQualityFrameIntervalMs,
  initialAmbientQualityState,
  updateAmbientQuality,
} from "../../features/theme/ambientQuality";
import { nextElapsedSeconds } from "../../features/theme/ambientRenderBudget";
import {
  createAmbientParticleSeeds,
  sampleAmbientParticle,
  type AmbientParticleMode,
} from "../../features/theme/ambientParticles";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";

export type AmbientMode = AmbientParticleMode;

const SPRITE_SIZE_PX = 64;
const POINTER_PARALLAX_PX = 14;

type AmbientBackgroundProps = {
  intensity: AmbientIntensity;
  mode: AmbientMode;
};

/**
 * AmbientBackground — 夜光 / 曙光の粒を 1 枚の canvas に描く。
 *
 * 旧実装は 46〜52 個の `<span>` を `will-change` 付きで個別に CSS アニメーション
 * させていた。粒ごとの奥行き・明滅・共通の風を持てず、レイヤ数も多かった。
 * ここでは `ambientParticles.ts` の決定論的なモデルを、起動時に一度だけ作る
 * スプライトで描く。位置・不透明度はすべて純関数 `sampleAmbientParticle` が決める。
 *
 * ガード（既存の方針を維持）:
 *   - `intensity === "off"` と `prefers-reduced-motion` では rAF を回さない
 *   - 非表示・ウィンドウ非アクティブ中は時間を進めない（`nextElapsedSeconds`）
 *   - 品質段（実測フレーム時間）に応じて DPR と描画間隔を落とす
 *   - 外部テクスチャの fetch はしない。スプライトは実行時に生成する
 */
export function AmbientBackground({ intensity, mode }: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seeds = useMemo(
    () => createAmbientParticleSeeds(mode, intensity),
    [mode, intensity],
  );
  const reducedMotion = useReducedMotion();
  const active = intensity !== "off" && seeds.length > 0;

  useEffect(() => {
    if (!active || reducedMotion) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      // canvas が取れない環境では背景色だけが残る（演出は落ちるが操作は妨げない）。
      return;
    }

    // === スプライト ===
    // ラジアルグラデーションを毎フレーム作らないよう、起動時に一度だけ描く。
    // 色相は 4 度刻みに丸めて使い回す。
    const spriteCache = new Map<string, HTMLCanvasElement>();
    const spriteFor = (hue: number, glow: boolean): HTMLCanvasElement => {
      const bucket = Math.round(hue / 4) * 4;
      const key = `${glow ? "glow" : "dust"}-${bucket}`;
      const cached = spriteCache.get(key);
      if (cached) {
        return cached;
      }
      const sprite = document.createElement("canvas");
      sprite.width = SPRITE_SIZE_PX;
      sprite.height = SPRITE_SIZE_PX;
      const spriteContext = sprite.getContext("2d");
      if (spriteContext) {
        const half = SPRITE_SIZE_PX / 2;
        const gradient = spriteContext.createRadialGradient(
          half,
          half,
          0,
          half,
          half,
          half,
        );
        if (glow) {
          // 夜光の星 / 曙光の ember: 芯が明るく、外へ透明に落ちる。
          gradient.addColorStop(
            0,
            mode === "shokou"
              ? `hsl(${bucket}, 72%, 82%)`
              : `hsl(${bucket}, 88%, 94%)`,
          );
          gradient.addColorStop(
            0.55,
            mode === "shokou"
              ? `hsl(${bucket}, 58%, 62%)`
              : `hsl(${bucket}, 78%, 76%)`,
          );
          gradient.addColorStop(
            1,
            mode === "shokou"
              ? `hsla(${bucket}, 58%, 62%, 0)`
              : `hsla(${bucket}, 70%, 70%, 0)`,
          );
        } else {
          // 曙光の影粒: 明るい紙の上で「埃」として見える暗い粒。
          gradient.addColorStop(0, `hsl(${bucket}, 22%, 30%)`);
          gradient.addColorStop(0.58, `hsl(${bucket}, 16%, 16%)`);
          gradient.addColorStop(1, `hsla(${bucket}, 16%, 16%, 0)`);
        }
        spriteContext.fillStyle = gradient;
        spriteContext.fillRect(0, 0, SPRITE_SIZE_PX, SPRITE_SIZE_PX);
      }
      spriteCache.set(key, sprite);
      return sprite;
    };

    // === 品質段 ===
    let quality = initialAmbientQualityState(intensity);
    let cssWidth = window.innerWidth;
    let cssHeight = window.innerHeight;

    const applyResolution = () => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        ambientQualityDprCap(quality.tier),
      );
      cssWidth = window.innerWidth;
      cssHeight = window.innerHeight;
      const width = Math.max(1, Math.floor(cssWidth * dpr));
      const height = Math.max(1, Math.floor(cssHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        // 以後の描画は CSS px で行う。
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    applyResolution();
    window.addEventListener("resize", applyResolution);

    // === ポインタ視差 ===
    // 手前の粒ほど強く動く。動かしていないときは中央へ戻る。
    let pointerTarget = 0.5;
    let pointerSmooth = 0.5;
    const onPointerMove = (event: MouseEvent) => {
      pointerTarget = event.clientX / Math.max(window.innerWidth, 1);
    };
    window.addEventListener("mousemove", onPointerMove, { passive: true });

    // === 時間 ===
    let elapsedSeconds = 0;
    let lastFrameMs = 0;
    let lastDrawMs = 0;
    let frameId = 0;
    let pending = false;
    let running = true;
    let paused = document.hidden || !document.hasFocus();

    let render = () => {};

    const schedule = () => {
      if (!running || paused || pending) {
        return;
      }
      pending = true;
      frameId = window.requestAnimationFrame(() => {
        pending = false;
        render();
      });
    };

    render = () => {
      if (!running) {
        return;
      }
      const now = performance.now();
      const frameMs = lastFrameMs === 0 ? 0 : now - lastFrameMs;
      lastFrameMs = now;
      if (paused) {
        return;
      }
      elapsedSeconds = nextElapsedSeconds(elapsedSeconds, frameMs, true);
      const previousTier = quality.tier;
      quality = updateAmbientQuality(quality, frameMs);
      if (quality.tier !== previousTier) {
        applyResolution();
      }
      const minInterval = ambientQualityFrameIntervalMs(quality.tier);
      if (minInterval > 0 && now - lastDrawMs < minInterval) {
        schedule();
        return;
      }
      lastDrawMs = now;

      pointerSmooth += (pointerTarget - pointerSmooth) * 0.06;
      const pointerOffset = (pointerSmooth - 0.5) * POINTER_PARALLAX_PX * 2;

      context.clearRect(0, 0, cssWidth, cssHeight);
      for (const seed of seeds) {
        const frame = sampleAmbientParticle(
          seed,
          elapsedSeconds,
          cssWidth,
          cssHeight,
          pointerOffset,
        );
        if (frame.alpha <= 0.01) {
          continue;
        }
        const sprite = spriteFor(seed.hue, seed.glow);
        const box = frame.radiusPx * (seed.glow ? 6 : 5);
        context.globalCompositeOperation = seed.glow ? "lighter" : "source-over";
        context.globalAlpha = Math.min(1, frame.alpha);
        context.drawImage(sprite, frame.x - box / 2, frame.y - box / 2, box, box);
        if (seed.glow && mode === "yakou") {
          // 星のハロー。同じスプライトを広く薄く重ねる。
          const haloBox = box * 2.6;
          context.globalAlpha = Math.min(1, frame.alpha * 0.22);
          context.drawImage(
            sprite,
            frame.x - haloBox / 2,
            frame.y - haloBox / 2,
            haloBox,
            haloBox,
          );
        }
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      schedule();
    };
    schedule();

    const pause = () => {
      paused = true;
      if (pending) {
        window.cancelAnimationFrame(frameId);
      }
      pending = false;
    };
    const resume = () => {
      paused = document.hidden || !document.hasFocus();
      if (paused) {
        pause();
        return;
      }
      lastFrameMs = 0;
      schedule();
    };
    const handleVisibility = () => resume();
    const handleFocus = () => resume();
    const handleBlur = () => pause();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    const handleContextLoss = () => {
      running = false;
      pause();
    };
    canvas.addEventListener("contextlost", handleContextLoss);

    return () => {
      running = false;
      if (pending) {
        window.cancelAnimationFrame(frameId);
      }
      pending = false;
      window.removeEventListener("resize", applyResolution);
      window.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      canvas.removeEventListener("contextlost", handleContextLoss);
      spriteCache.clear();
    };
  }, [active, intensity, mode, reducedMotion, seeds]);

  if (!active) {
    return null;
  }

  return (
    <div className={`ambient ambient-${mode}`} aria-hidden="true">
      <canvas className="ambient-canvas" ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
