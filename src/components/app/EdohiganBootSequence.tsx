import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * EdohiganBootSequence
 *
 * 江戸彼岸ジョークテーマへの切り替え (false → true) で流れる 2.6 秒の
 * 「咲いて、散る」起動演出。EdohiganShaderOverlay と同じフルスクリーン
 * クアッド方式 (FBM 花吹雪 + 青空 + 雲) で描き、ブート終了後に通常画面へ
 * 連続的に繋がる。u_progress (0..1) で density/scatter/fade を駆動する。
 *
 * ストーリー:
 *   bud      (0.0〜0.6s)  : 青空が現れ、白い雲が流れる
 *   bloom    (0.6〜1.2s)  : 花吹雪が灯り始め、満開へ向かう (density 0→1)
 *   fullbloom(1.2〜1.6s)  : 満開。花吹雪が画面を覆う
 *   scatter  (1.6〜2.6s)  : 風が吹き、花びらが散華してフェード
 *   done     (2.6s)
 *
 * ガード:
 *   - prefers-reduced-motion: reduce → 即 done
 *   - intensity === "off" → 即 done
 *   - trigger が true のままでも初回マウントで一度だけ発火する
 */

type EdohiganBootSequenceProps = {
  intensity: AmbientIntensity;
  trigger: boolean;
};

type Phase = "bud" | "bloom" | "fullbloom" | "scatter" | "done";

const PHASE_TIMINGS: { phase: Phase; at: number }[] = [
  { phase: "bud", at: 0 },
  { phase: "bloom", at: 600 },
  { phase: "fullbloom", at: 1200 },
  { phase: "scatter", at: 1600 },
  { phase: "done", at: 2600 },
];

const TOTAL_MS = PHASE_TIMINGS[PHASE_TIMINGS.length - 1].at; // 2600

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
  return "bud";
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_progress;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += amp * valueNoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

vec2 curl(vec2 p) {
  float eps = 0.001;
  float n_x_p = fbm(p + vec2(eps, 0.0), 3);
  float n_x_m = fbm(p - vec2(eps, 0.0), 3);
  float n_y_p = fbm(p + vec2(0.0, eps), 3);
  float n_y_m = fbm(p - vec2(0.0, eps), 3);
  float dx = (n_x_p - n_x_m) / (2.0 * eps);
  float dy = (n_y_p - n_y_m) / (2.0 * eps);
  return vec2(dy, -dx);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float p = u_progress;

  // ストーリー駆動の進行度
  float density = smoothstep(0.2, 0.62, p);
  float scatter = smoothstep(0.6, 1.0, p);
  float fade = 1.0 - smoothstep(0.7, 1.0, p);

  // 背景: 青空 (上) から薄桃 (下)。EdohiganShaderOverlay と同一値。
  vec3 skyBlue = vec3(0.55, 0.78, 0.92);
  vec3 skyPale = vec3(0.92, 0.88, 0.93);
  vec3 sky = mix(skyPale, skyBlue, pow(uv.y, 0.7));

  // 白い雲 (花びらと周波数帯を分離するため低周波)
  float t = p * 3.0;
  vec2 cloudUv = uv * vec2(aspect, 1.0) * 0.9 + vec2(t * 0.01, 0.0);
  float cloud = fbm(cloudUv, 4);
  cloud = smoothstep(0.45, 0.72, cloud) * smoothstep(0.2, 1.0, uv.y);
  sky = mix(sky, vec3(1.0, 0.98, 0.97), cloud * 0.6);

  vec3 col = sky;

  // 風: scatter で右方向への強風が加わる (散華)
  float motion = u_intensity / 1.2;
  vec2 flowPos = uv * vec2(aspect, 1.0) * 2.6 + vec2(t * 0.08, t * 0.05);
  vec2 wind = curl(flowPos) * 0.62 * motion;
  wind += vec2(0.6, -0.5) * scatter * motion;

  // 3層 depth 分離の花吹雪 (EdohiganShaderOverlay と共通)
  // 閾値を下げ (0.40-0.60)、スケールを雲 (0.9) と大きく分離 (5-11)。
  vec2 driftedFg = uv + wind * 0.10;
  driftedFg += vec2(
    fbm(driftedFg * vec2(aspect, 1.0) * 7.0 + t * 0.10, 3),
    fbm(driftedFg * vec2(aspect, 1.0) * 7.0 + 5.0 - t * 0.08, 3)
  ) * 0.011 * motion - 0.0055 * motion;
  float dustFg = fbm(driftedFg * vec2(aspect, 1.0) * 5.0 + t * 0.05, 3);
  float particleFg = smoothstep(0.42, 0.60, dustFg) * density;

  vec2 driftedNear = uv + wind * 0.085;
  driftedNear += vec2(
    fbm(driftedNear * vec2(aspect, 1.0) * 9.0 + t * 0.09, 3),
    fbm(driftedNear * vec2(aspect, 1.0) * 9.0 + 5.0 - t * 0.07, 3)
  ) * 0.0095 * motion - 0.0048 * motion;
  float dustNear = fbm(driftedNear * vec2(aspect, 1.0) * 7.0 + t * 0.04, 4);
  float particleNear = smoothstep(0.40, 0.58, dustNear) * density;

  vec2 driftedFar = uv + wind * 0.045;
  float dustFar = fbm(driftedFar * vec2(aspect, 1.0) * 11.0 - t * 0.025, 3);
  float particleFar = smoothstep(0.42, 0.58, dustFar) * density;

  float lightReach = mix(0.65, 1.25, pow(uv.y, 0.85));
  vec3 petalFgColor = vec3(0.92, 0.55, 0.68);
  vec3 petalNearColor = vec3(0.94, 0.70, 0.80);
  vec3 petalFarColor = vec3(0.92, 0.82, 0.88);

  // 加算ではなく mix で上書き (明るい青空背景では加算だと埋もれる)
  col = mix(col, petalFgColor * lightReach, particleFg * 0.85);
  col = mix(col, petalNearColor * lightReach, particleNear * 0.6);
  col = mix(col, petalFarColor * lightReach, particleFar * 0.35);

  float vig = smoothstep(1.25, 0.45, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.90, 1.0, vig);

  col = clamp(col, 0.0, 1.0);
  col *= fade;

  fragColor = vec4(col, 1.0);
}
`;

const INTENSITY_MAP: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 0.7,
  normal: 1.2,
  dramatic: 1.6,
};

export function EdohiganBootSequence({ intensity, trigger }: EdohiganBootSequenceProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    computeInitialPhase(intensity, trigger),
  );
  const prevTriggerRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const prev = prevTriggerRef.current;
    prevTriggerRef.current = trigger;

    const shouldFire = !prev && trigger;
    if (!shouldFire) {
      return;
    }

    const currentIntensity = intensityRef.current;

    if (currentIntensity === "off") {
      setPhase("done");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }

    startTimeRef.current = performance.now();
    setPhase("bud");
    const timers = PHASE_TIMINGS.map(({ phase: p, at }) =>
      window.setTimeout(() => setPhase(p), at),
    );

    return () => {
      for (const t of timers) {
        window.clearTimeout(t);
      }
    };
  }, [trigger]);

  const startTimeRef = useRef<number>(0);
  const booting = phase !== "done";
  useEffect(() => {
    if (!booting) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      return;
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
      return;
    }
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const u_resolution = gl.getUniformLocation(program, "u_resolution");
    const u_intensity = gl.getUniformLocation(program, "u_intensity");
    const u_progress = gl.getUniformLocation(program, "u_progress");

    const intensityValue = INTENSITY_MAP[intensityRef.current] ?? 1.2;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const startTime = startTimeRef.current || performance.now();
    let rafId: number | null = null;
    const render = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / TOTAL_MS));

      gl.uniform2f(u_resolution, canvas.width, canvas.height);
      gl.uniform1f(u_intensity, intensityValue);
      gl.uniform1f(u_progress, progress);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (progress < 1) {
        rafId = requestAnimationFrame(render);
      }
    };
    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", resize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (positionBuffer) {
        gl.deleteBuffer(positionBuffer);
      }
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
    };
  }, [booting]);

  if (phase === "done") {
    return null;
  }

  return (
    <div className={`edohigan-boot edohigan-boot-${phase}`} aria-hidden="true">
      <canvas ref={canvasRef} className="edohigan-boot-canvas" />
    </div>
  );
}
