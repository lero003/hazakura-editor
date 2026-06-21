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

export function isDeveloperDistributionLane(): boolean {
  return readHazakuraDistributionLane() === "developer";
}

export function isExternalCliAssistSurfaceAllowed(): boolean {
  return !isAppStoreDistributionLane();
}

export function isAppleLocalAssistSurfaceAllowed(): boolean {
  return true;
}

export function isAssistSurfaceAllowedForDistribution(
  value: AssistSurfacePreference,
): boolean {
  if (value === "external-cli") {
    return isExternalCliAssistSurfaceAllowed();
  }
  if (value === "apple-local") {
    return isAppleLocalAssistSurfaceAllowed();
  }
  return true;
}

export function normalizeAssistSurfacePreferenceForDistribution(
  value: AssistSurfacePreference,
): AssistSurfacePreference {
  if (!isAssistSurfaceAllowedForDistribution(value)) {
    return "none";
  }
  return value;
}
