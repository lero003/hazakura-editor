import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAppleLocalAssistSurfaceAllowed,
  isExternalCliAssistSurfaceAllowed,
  normalizeAssistSurfacePreferenceForDistribution,
} from "./distributionLane";

describe("distributionLane", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows Apple Local Assist but not external CLI assist in the App Store lane", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");

    expect(isAppleLocalAssistSurfaceAllowed()).toBe(true);
    expect(isExternalCliAssistSurfaceAllowed()).toBe(false);
    expect(
      normalizeAssistSurfacePreferenceForDistribution("apple-local"),
    ).toBe("apple-local");
    expect(
      normalizeAssistSurfacePreferenceForDistribution("external-cli"),
    ).toBe("none");
  });
});
