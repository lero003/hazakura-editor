import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPreviewImagesNearViewport } from "./previewImageLoader";

type ObserverCallback = ConstructorParameters<typeof IntersectionObserver>[0];

class MockIntersectionObserver {
  static instance: MockIntersectionObserver | null = null;

  readonly observed = new Set<Element>();

  constructor(private readonly callback: ObserverCallback) {
    MockIntersectionObserver.instance = this;
  }

  disconnect() {
    this.observed.clear();
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(targets: Element[], isIntersecting = true) {
    this.callback(
      targets.map(
        (target) =>
          ({ isIntersecting, target }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  MockIntersectionObserver.instance = null;
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

function makeHost(paths: string[]): HTMLElement {
  const host = document.createElement("article");
  for (const path of paths) {
    const image = document.createElement("img");
    image.alt = path;
    image.loading = "lazy";
    image.setAttribute("data-hazakura-image-path", path);
    image.setAttribute("data-hazakura-image-origin", "workspace");
    host.append(image);
  }
  document.body.append(host);
  return host;
}

describe("loadPreviewImagesNearViewport", () => {
  it("falls back to bounded loading when WebKit never reports an intersection", async () => {
    vi.useFakeTimers();
    const host = makeHost(["/workspace/book/images/cover.png"]);
    const loadWorkspaceImage = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,COVER");
    const cleanup = loadPreviewImagesNearViewport(host, {
      loadWorkspaceImage,
    });

    expect(loadWorkspaceImage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);

    expect(loadWorkspaceImage).toHaveBeenCalledWith(
      "/workspace/book/images/cover.png",
    );

    cleanup();
    host.remove();
  });

  it("falls back when a nested Preview only reports a non-intersecting placeholder", async () => {
    vi.useFakeTimers();
    const host = makeHost(["/workspace/book/images/cover.png"]);
    const image = host.querySelector("img");
    const loadWorkspaceImage = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,COVER");
    const cleanup = loadPreviewImagesNearViewport(host, {
      loadWorkspaceImage,
    });

    if (image) {
      MockIntersectionObserver.instance?.trigger([image], false);
    }
    await vi.advanceTimersByTimeAsync(2_000);

    expect(loadWorkspaceImage).toHaveBeenCalledWith(
      "/workspace/book/images/cover.png",
    );

    cleanup();
    host.remove();
  });

  it("keeps viewport deferral when WebKit delivers observer callbacks", async () => {
    vi.useFakeTimers();
    const host = makeHost(["/visible.png", "/later.png"]);
    const loadWorkspaceImage = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,IMAGE");
    const cleanup = loadPreviewImagesNearViewport(host, {
      loadWorkspaceImage,
    });
    const visibleImage = host.querySelector("img");

    if (visibleImage) {
      MockIntersectionObserver.instance?.trigger([visibleImage]);
    }
    await vi.waitFor(() => {
      expect(loadWorkspaceImage).toHaveBeenCalledWith("/visible.png");
    });

    await vi.advanceTimersByTimeAsync(2_000);

    expect(loadWorkspaceImage).not.toHaveBeenCalledWith("/later.png");

    cleanup();
    host.remove();
  });

  it("does not retain placeholder loading attributes while decode is pending", async () => {
    const host = makeHost(["/large.png"]);
    const image = host.querySelector("img");
    let finishDecode: (() => void) | undefined;
    const decode = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDecode = resolve;
        }),
    );
    Object.defineProperty(image, "decode", { configurable: true, value: decode });
    const cleanup = loadPreviewImagesNearViewport(host, {
      loadWorkspaceImage: vi
        .fn()
        .mockResolvedValue("data:image/png;base64,LARGE"),
    });

    if (image) {
      MockIntersectionObserver.instance?.trigger([image]);
    }
    await vi.waitFor(() => {
      expect(decode).toHaveBeenCalledTimes(1);
    });
    expect(image?.getAttribute("src")).toBe("data:image/png;base64,LARGE");
    expect(image?.hasAttribute("data-hazakura-image-loading")).toBe(false);
    expect(image?.hasAttribute("loading")).toBe(false);

    finishDecode?.();
    await Promise.resolve();

    cleanup();
    host.remove();
  });

  it("keeps approved-local and remote loaders on their existing boundaries", async () => {
    const host = makeHost(["/shared/local.png"]);
    const localImage = host.querySelector("img");
    localImage?.setAttribute("data-hazakura-image-origin", "approved-local");
    const remoteImage = document.createElement("img");
    remoteImage.setAttribute(
      "data-hazakura-image-remote",
      "https://example.com/remote.png",
    );
    remoteImage.setAttribute("data-hazakura-image-origin", "remote");
    host.append(remoteImage);
    const loadApprovedLocalImage = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,LOCAL");
    const loadRemoteImage = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,REMOTE");
    const cleanup = loadPreviewImagesNearViewport(host, {
      loadWorkspaceImage: vi.fn(),
      loadApprovedLocalImage,
      loadRemoteImage,
    });

    MockIntersectionObserver.instance?.trigger(
      Array.from(host.querySelectorAll("img")),
    );
    await vi.waitFor(() => {
      expect(localImage?.getAttribute("src")).toBe(
        "data:image/png;base64,LOCAL",
      );
      expect(remoteImage.getAttribute("src")).toBe(
        "data:image/png;base64,REMOTE",
      );
    });
    expect(loadApprovedLocalImage).toHaveBeenCalledWith("/shared/local.png");
    expect(loadRemoteImage).toHaveBeenCalledWith(
      "https://example.com/remote.png",
    );

    cleanup();
    host.remove();
  });

  it("limits an intersecting image burst to two concurrent reads", async () => {
    const host = makeHost(["/one.png", "/two.png", "/three.png"]);
    const pendingResolvers: Array<(value: string) => void> = [];
    const loadWorkspaceImage = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );
    const cleanup = loadPreviewImagesNearViewport(host, {
      loadWorkspaceImage,
    });
    const images = Array.from(host.querySelectorAll("img"));

    MockIntersectionObserver.instance?.trigger(images);
    expect(loadWorkspaceImage).toHaveBeenCalledTimes(2);

    pendingResolvers[0]?.("data:image/png;base64,ONE");
    await Promise.resolve();
    await Promise.resolve();
    expect(loadWorkspaceImage).toHaveBeenCalledTimes(3);

    cleanup();
    host.remove();
  });

  it("keeps an honest blocked note when a deferred read fails", async () => {
    const host = makeHost(["/missing.png"]);
    const cleanup = loadPreviewImagesNearViewport(host, {
      loadWorkspaceImage: vi.fn().mockRejectedValue(new Error("missing")),
    });

    MockIntersectionObserver.instance?.trigger(
      Array.from(host.querySelectorAll("img")),
    );
    await vi.waitFor(() => {
      expect(
        host.querySelector('[data-hazakura-image-block="load-failed"]'),
      ).toBeTruthy();
    });
    expect(
      host
        .querySelector('[data-hazakura-image-block="load-failed"]')
        ?.getAttribute("data-hazakura-resolved-path"),
    ).toBe("/missing.png");

    cleanup();
    host.remove();
  });
});
