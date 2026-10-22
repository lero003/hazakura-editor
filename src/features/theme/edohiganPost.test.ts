import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createEdohiganPost } from "./edohiganPost";

describe("edohigan bloom resolution", () => {
  it.each([[1280, 800], [901, 701], [1, 1]])(
    "samples adjacent half-resolution pixels after resizing to %i × %i",
    (width, height) => {
      const blurPasses: { direction: number[]; width: number; height: number }[] = [];
      let target: THREE.WebGLRenderTarget | null = null;
      const renderer = {
        setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { target = next; },
        clear: () => {},
        render: (scene: THREE.Scene) => {
          const material = (scene.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
          if (material.uniforms.uSun) {
            // 光条の光源範囲を画素比に関係なく太陽の周囲へ保つ。
            expect(material.uniforms.uAspect?.value).toBeCloseTo(width / height);
          }
          const direction = material.uniforms.uDirection?.value as THREE.Vector2 | undefined;
          if (direction && target) {
            blurPasses.push({ direction: direction.toArray(), width: target.width, height: target.height });
          }
        },
      } as unknown as THREE.WebGLRenderer;
      // The backdrop creates post-processing at 1 × 1 before applying its layout.
      const post = createEdohiganPost(THREE, renderer, 1, 1);
      try {
        post.setSize(width, height);
        post.present(0);
        const halfWidth = Math.max(1, Math.floor(width / 2));
        const halfHeight = Math.max(1, Math.floor(height / 2));
        expect(blurPasses).toEqual([
          { direction: [1 / halfWidth, 0], width: halfWidth, height: halfHeight },
          { direction: [0, 1 / halfHeight], width: halfWidth, height: halfHeight },
        ]);
      } finally {
        post.dispose();
      }
    },
  );
});
