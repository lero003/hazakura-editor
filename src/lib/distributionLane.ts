import type { AssistSurfacePreference } from "../types";

export type HazakuraDistributionLane = "developer" | "app-store";

export function readHazakuraDistributionLane(): HazakuraDistributionLane {
  return import.meta.env.VITE_HAZAKURA_DISTRIBUTION_LANE === "app-store"
    ? "app-store"
    : "developer";
}

export function isAppStoreDistributionLane(): boolean {
  return readHazakuraDistributionLane() === "app-store";
}

export function isExternalCliAssistSurfaceAllowed(): boolean {
  return !isAppStoreDistributionLane();
}

export function normalizeAssistSurfacePreferenceForDistribution(
  value: AssistSurfacePreference,
): AssistSurfacePreference {
  if (value === "external-cli" && !isExternalCliAssistSurfaceAllowed()) {
    return "apple-local";
  }
  return value;
}
