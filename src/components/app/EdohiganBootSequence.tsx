import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * EdohiganBootSequence
 *
 * 江戸彼岸（静謐）への 2.6 秒起動。Overlay と同じ「静かだが凝った」語彙
 * (多帯域春霞・三重雲・微粒子・花弁)。派手な散華ではなく淡く溶ける。
 *
 * bud: 空と雲 / bloom: 花弁点灯 / fullbloom: 密度ピーク / scatter: fade
 * ガード: reduced-motion / intensity off → 即 done
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

// 静謐だが凝った起動 — Overlay と同期。

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
  p.x = abs(p.x) + tip * tip * 0.15;
  float mid = 1.0 + 0.30 * clamp(p.y, -0.4, 0.75);
  p.x /= max(mid, 0.5);
  p.y *= 1.22;
  p.y += 0.05;
  float d = length(p) - 0.57;
  d += max(-pos.y - 0.48, 0.0) * 0.62;
  return d;
}

float softCloud(vec2 uv, float aspect, float t, float scale, float lo, float hi) {
  vec2 p = uv * vec2(aspect, 1.0) * scale + vec2(t * 0.007, t * 0.0018);
  vec2 q = vec2(fbm(p, 5), fbm(p + vec2(5.2, 1.3), 5));
  vec2 r = vec2(
    fbm(p + 1.8 * q + vec2(1.7, 9.2) + t * 0.008, 6),
    fbm(p + 1.8 * q + vec2(8.3, 2.8) - t * 0.006, 6)
  );
  float n = fbm(p + 1.5 * r, 7);
  float c = smoothstep(lo, hi, n);
  c *= smoothstep(0.14, 0.46, uv.y) * smoothstep(1.02, 0.52, uv.y);
  c *= 0.75 + 0.25 * smoothstep(0.2, 0.8, fbm(vec2(uv.x * aspect * 0.6 + t * 0.01, 3.1), 3));
  return c;
}

vec3 drawPetals(
  vec2 uv,
  float aspect,
  float motion,
  float t,
  float scale,
  float sizeBase,
  float density,
  float drift,
  float fall,
  vec3 tipCol,
  vec3 rootCol,
  out float alpha
) {
  alpha = 0.0;
  vec3 col = vec3(0.0);
  vec2 p = uv * vec2(aspect, 1.0) * scale;
  p.x += t * drift * motion * scale;
  p.y += t * fall * motion * scale;
  p.x += sin(t * 0.11 + uv.y * 2.2) * 0.35;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float aa = 1.25 * scale / max(u_resolution.y, 1.0);

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
      vec2 local = (f - offset) + (vec2(r1, r2) - 0.5) * 0.6;
      float phase = t * (0.4 + r4 * 0.55) + id.x * 1.1;
      local.x += sin(phase) * 0.16 * motion;
      local.y += cos(phase * 0.75) * 0.07 * motion;
      float sz = sizeBase * (0.8 + r3 * 0.45);
      float angle = r1 * 6.28 + t * (0.1 + r2 * 0.14) * motion;
      vec2 petalLocal = rot2(angle) * (local / max(sz, 1e-4));
      float d = petalSdf(petalLocal) * sz;
      float mask = 1.0 - smoothstep(-aa, aa, d);
      if (mask <= 0.001) continue;
      float rootMix = clamp(-petalLocal.y * 0.55 + 0.42, 0.0, 1.0);
      vec3 petalCol = mix(tipCol, rootCol, rootMix * 0.75);
      col = mix(col, petalCol, mask);
      alpha = max(alpha, mask * 0.9);
    }
  }
  return col;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float p = u_progress;

  float density = smoothstep(0.2, 0.55, p);
  float fade = 1.0 - smoothstep(0.68, 1.0, p);
  float reveal = smoothstep(0.0, 0.3, p);
  float t = 0.9 + p * 4.0;
  float motion = max(u_intensity / 1.2, 0.35);

  // 多帯域春霞 (Overlay 同期)
  vec3 skyTop = vec3(0.68, 0.75, 0.82);
  vec3 skyUpper = vec3(0.78, 0.82, 0.86);
  vec3 skyMid = vec3(0.88, 0.87, 0.87);
  vec3 skyLow = vec3(0.93, 0.90, 0.89);
  vec3 skyBot = vec3(0.94, 0.91, 0.90);
  float hy = clamp(uv.y, 0.0, 1.0);
  vec3 sky = mix(skyBot, skyLow, smoothstep(0.0, 0.28, hy));
  sky = mix(sky, skyMid, smoothstep(0.22, 0.55, hy));
  sky = mix(sky, skyUpper, smoothstep(0.48, 0.78, hy));
  sky = mix(sky, skyTop, smoothstep(0.7, 1.0, hy));

  vec2 lightPos = vec2(0.74, 0.80);
  float lightD = length((uv - lightPos) * vec2(aspect, 1.0));
  sky += vec3(1.0, 0.97, 0.94) * (exp(-lightD * 3.8) * 0.12 + exp(-lightD * 1.6) * 0.05);

  vec3 washi = vec3(0.937, 0.902, 0.878);
  vec3 col = mix(washi, sky, reveal);

  // 雲 3 層
  float c0 = softCloud(uv, aspect, t * 0.45, 0.75, 0.36, 0.60);
  float s0 = fbm(uv * vec2(aspect, 1.0) * 0.7 + t * 0.004, 5);
  vec3 cloud0 = mix(vec3(0.78, 0.81, 0.86), vec3(0.97, 0.97, 0.98), smoothstep(0.25, 0.75, s0));
  float e0 = smoothstep(0.08, 0.38, c0) * (1.0 - smoothstep(0.38, 0.88, c0));
  cloud0 = mix(cloud0, vec3(0.96, 0.92, 0.93), e0 * 0.14);
  col = mix(col, cloud0, c0 * 0.58 * reveal);

  float c1 = softCloud(uv + vec2(0.04, -0.02), aspect, t * 0.7, 1.25, 0.38, 0.62);
  float s1 = fbm(uv * vec2(aspect, 1.0) * 1.2 + 3.0, 5);
  vec3 cloud1 = mix(vec3(0.80, 0.82, 0.87), vec3(0.98, 0.98, 0.99), smoothstep(0.2, 0.78, s1));
  float e1 = smoothstep(0.08, 0.36, c1) * (1.0 - smoothstep(0.36, 0.82, c1));
  cloud1 = mix(cloud1, vec3(0.97, 0.93, 0.94), e1 * 0.16);
  col = mix(col, cloud1, c1 * 0.48 * reveal);

  float c2 = softCloud(uv + vec2(-0.06, 0.03), aspect, t * 1.05, 1.95, 0.42, 0.66);
  col = mix(col, vec3(0.96, 0.96, 0.97), c2 * 0.32 * reveal);

  // 空気層
  float air0 = smoothstep(0.4, 0.7, fbm(uv * vec2(aspect, 1.0) * 1.8 + t * 0.01, 5)) * 0.06;
  col = mix(col, vec3(0.94, 0.92, 0.92), air0 * reveal);

  vec3 petalTip = vec3(0.985, 0.955, 0.955);
  vec3 petalRoot = vec3(0.91, 0.78, 0.82);

  float aFar = 0.0;
  vec3 pFar = drawPetals(
    uv, aspect, motion, t * 0.42,
    12.0, 0.12, 0.22 * density, 0.022, 0.02,
    mix(petalTip, petalRoot, 0.18), mix(petalRoot, petalTip, 0.3),
    aFar
  );
  float aMid = 0.0;
  vec3 pMid = drawPetals(
    uv, aspect, motion, t * 0.55,
    7.2, 0.17, 0.18 * density, 0.03, 0.028,
    petalTip, petalRoot,
    aMid
  );
  float aFg = 0.0;
  vec3 pFg = drawPetals(
    uv, aspect, motion, t * 0.68,
    4.5, 0.23, 0.14 * density, 0.04, 0.035,
    petalTip, petalRoot,
    aFg
  );

  col = mix(col, pFar, clamp(aFar, 0.0, 1.0) * 0.48 * density);
  col = mix(col, pMid, clamp(aMid, 0.0, 1.0) * 0.62 * density);
  col = mix(col, pFg,  clamp(aFg, 0.0, 1.0) * 0.78 * density);

  float vig = smoothstep(1.45, 0.48, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.93, 1.0, vig);

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
