import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * EdohiganBootSequence
 *
 * 江戸彼岸への 2.8 秒「彼岸へ渡る」起動。
 * Overlay と同じ薄暮空・雲・花弁語彙で、満開→散華→常時画面へ繋ぐ。
 * 深海の「潜る」に対抗する一発で分かる物語。
 *
 * open → bloom → full → scatter → done
 * ガード: reduced-motion / intensity off → 即 done
 */

type EdohiganBootSequenceProps = {
  intensity: AmbientIntensity;
  trigger: boolean;
};

type Phase = "open" | "bloom" | "full" | "scatter" | "done";

// タイミングは既存テスト契約 (600 / 1200 / 1600 / 2600) に合わせる
const PHASE_TIMINGS: { phase: Phase; at: number }[] = [
  { phase: "open", at: 0 },
  { phase: "bloom", at: 600 },
  { phase: "full", at: 1200 },
  { phase: "scatter", at: 1600 },
  { phase: "done", at: 2600 },
];

const TOTAL_MS = PHASE_TIMINGS[PHASE_TIMINGS.length - 1].at;

function computeInitialPhase(
  intensity: AmbientIntensity,
  trigger: boolean,
): Phase {
  if (!trigger) return "done";
  if (intensity === "off") return "done";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "done";
  }
  return "open";
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

float hashCell(vec2 id) {
  return hash21(id * 1.37 + vec2(7.1, 3.3));
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
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
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += amp * valueNoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return v;
}

float petalSdf(vec2 pos) {
  vec2 p = pos;
  float tip = smoothstep(0.0, 0.85, p.y);
  p.x = abs(p.x) + tip * tip * 0.16;
  float mid = 1.0 + 0.32 * clamp(p.y, -0.4, 0.75);
  p.x /= max(mid, 0.5);
  p.y *= 1.22;
  p.y += 0.05;
  float d = length(p) - 0.58;
  d += max(-pos.y - 0.48, 0.0) * 0.62;
  return d;
}

float windCloud(vec2 uv, float aspect, float t, float scale, float lo, float hi, float windX) {
  vec2 p = uv * vec2(aspect, 1.0) * scale + vec2(t * 0.015 + windX * 0.3, t * 0.004);
  vec2 q = vec2(fbm(p, 4), fbm(p + 5.2, 4));
  vec2 r = vec2(fbm(p + 1.7 * q, 5), fbm(p + 1.7 * q + 8.3, 5));
  float n = fbm(p + 1.4 * r, 6);
  float dens = smoothstep(lo, hi, n);
  dens *= smoothstep(0.08, 0.4, uv.y) * smoothstep(1.05, 0.45, uv.y);
  return dens;
}

vec3 drawPetals(
  vec2 uv, float aspect, float motion, float t,
  float scale, float sizeBase, float density, float fall, float drift, float windX,
  vec3 tipCol, vec3 rootCol, out float alpha
) {
  alpha = 0.0;
  vec3 col = vec3(0.0);
  vec2 p = uv * vec2(aspect, 1.0) * scale;
  p.x += t * drift * motion * scale + windX * scale * 0.5;
  p.y += t * fall * motion * scale;
  p.x += sin(t * 0.18 + uv.y * 2.5) * 0.4;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float aa = 1.2 * scale / max(u_resolution.y, 1.0);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 offset = vec2(float(i), float(j));
      vec2 id = cell + offset;
      float r0 = hashCell(id);
      if (r0 > density) continue;
      float r1 = hashCell(id + 7.7);
      float r2 = hashCell(id + 13.3);
      float r3 = hashCell(id + 21.1);
      float r4 = hashCell(id + 29.7);
      vec2 local = (f - offset) + (vec2(r1, r2) - 0.5) * 0.65;
      float phase = t * (0.55 + r4 * 0.7) + id.x * 1.2;
      local.x += sin(phase) * 0.18 * motion;
      local.x += windX * 0.4;
      float sz = sizeBase * (0.78 + r3 * 0.5);
      float angle = r1 * 6.28 + t * (0.15 + r2 * 0.22) * motion + windX * 1.2;
      vec2 petalLocal = rot2(angle) * (local / max(sz, 1e-4));
      float d = petalSdf(petalLocal) * sz;
      float mask = 1.0 - smoothstep(-aa, aa, d);
      if (mask <= 0.001) continue;
      float rootMix = clamp(-petalLocal.y * 0.55 + 0.4, 0.0, 1.0);
      vec3 petalCol = mix(tipCol, rootCol, rootMix * 0.78);
      col = mix(col, petalCol, mask);
      alpha = max(alpha, mask * 0.92);
    }
  }
  return col;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float p = u_progress;

  float reveal = smoothstep(0.0, 0.25, p);
  float density = smoothstep(0.22, 0.55, p);
  float scatter = smoothstep(0.62, 0.95, p);
  float fade = 1.0 - smoothstep(0.7, 1.0, p);
  float t = 1.0 + p * 5.0;
  float motion = max(u_intensity / 1.2, 0.4);
  float windX = scatter * 1.1 * motion;

  // 薄暮の彼岸空 (Overlay 同期)
  vec3 skyTop = vec3(0.22, 0.20, 0.38);
  vec3 skyMid = vec3(0.42, 0.28, 0.42);
  vec3 skyLow = vec3(0.62, 0.38, 0.42);
  vec3 skyBot = vec3(0.72, 0.48, 0.48);
  float hy = clamp(uv.y, 0.0, 1.0);
  vec3 sky = mix(skyBot, skyLow, smoothstep(0.0, 0.3, hy));
  sky = mix(sky, skyMid, smoothstep(0.25, 0.65, hy));
  sky = mix(sky, skyTop, smoothstep(0.55, 1.0, hy));

  vec2 lightPos = vec2(0.78, 0.88);
  float lightD = length((uv - lightPos) * vec2(aspect, 1.0));
  sky += vec3(1.0, 0.82, 0.78) * exp(-lightD * 3.2) * 0.35 * reveal;

  // 暗幕から空が開く
  vec3 voidCol = vec3(0.08, 0.06, 0.12);
  vec3 col = mix(voidCol, sky, reveal);

  // 雲
  float c0 = windCloud(uv, aspect, t * 0.5, 0.85, 0.34, 0.58, windX);
  float s0 = fbm(uv * vec2(aspect, 1.0) * 0.8, 4);
  vec3 cloud0 = mix(vec3(0.35, 0.28, 0.38), vec3(0.85, 0.78, 0.82), smoothstep(0.3, 0.75, s0));
  col = mix(col, cloud0, c0 * 0.72 * reveal);

  float c1 = windCloud(uv + vec2(0.05, -0.02), aspect, t * 0.85, 1.4, 0.36, 0.6, windX);
  col = mix(col, vec3(0.88, 0.78, 0.82), c1 * 0.5 * reveal);

  // 花弁
  vec3 tip = vec3(0.98, 0.9, 0.92);
  vec3 root = vec3(0.88, 0.55, 0.65);
  float aFar = 0.0;
  vec3 farP = drawPetals(
    uv, aspect, motion, t * 0.5,
    11.0, 0.13, 0.26 * density, 0.04, 0.05, windX,
    mix(tip, root, 0.2), mix(root, tip, 0.25), aFar
  );
  float aFg = 0.0;
  vec3 fgP = drawPetals(
    uv, aspect, motion, t * 0.85,
    4.4, 0.24, 0.2 * density, 0.07, 0.08, windX,
    tip, root, aFg
  );
  col = mix(col, farP, clamp(aFar, 0.0, 1.0) * 0.55 * density);
  col = mix(col, fgP,  clamp(aFg, 0.0, 1.0) * 0.88 * density);

  // full 付近で光を少し強める
  float fullGlow = smoothstep(0.4, 0.55, p) * (1.0 - scatter);
  col += vec3(1.0, 0.85, 0.8) * fullGlow * 0.06;

  float vig = smoothstep(1.4, 0.4, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.82, 1.0, vig);

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
    if (!shouldFire) return;

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
    setPhase("open");
    const timers = PHASE_TIMINGS.map(({ phase: ph, at }) =>
      window.setTimeout(() => setPhase(ph), at),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [trigger]);

  const startTimeRef = useRef<number>(0);
  const booting = phase !== "done";

  useEffect(() => {
    if (!booting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
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
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
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
      if (progress < 1) rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [booting]);

  if (phase === "done") return null;

  // CSS クラスは既存テスト互換のため open を bud 相当として残しつつ新 phase 名も付与
  const cssPhase =
    phase === "open"
      ? "bud"
      : phase === "full"
        ? "fullbloom"
        : phase;

  return (
    <div className={`edohigan-boot edohigan-boot-${cssPhase}`} aria-hidden="true">
      <canvas ref={canvasRef} className="edohigan-boot-canvas" />
    </div>
  );
}
