import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync("package.json", "utf8"),
) as { scripts: Record<string, string> };

const macosLanesScript = readFileSync(
  "scripts/build-macos-lanes.sh",
  "utf8",
);

describe("macOS build scripts", () => {
  it("keeps npm run build on the normal App Store preview lane", () => {
    expect(packageJson.scripts["build:tauri"]).toBe("tauri build");
    expect(packageJson.scripts.build).toBe("npm run build:app-store-preview");
    expect(packageJson.scripts["build:app-store-preview"]).toContain(
      "HAZAKURA_DISTRIBUTION_LANE=app-store",
    );
    expect(packageJson.scripts["build:app-store-preview"]).toContain(
      "VITE_HAZAKURA_DISTRIBUTION_LANE=app-store",
    );
    expect(packageJson.scripts["build:app-store-preview"]).toContain(
      "npm run build:tauri",
    );
  });

  it("uses the dedicated Developer lane script before copying the Dev bundle", () => {
    expect(packageJson.scripts["build:developer-preview"]).toContain(
      "HAZAKURA_DISTRIBUTION_LANE=developer",
    );
    expect(packageJson.scripts["build:developer-preview"]).toContain(
      "VITE_HAZAKURA_DISTRIBUTION_LANE=developer",
    );
    expect(packageJson.scripts["build:developer-preview"]).toContain(
      "npm run build:tauri",
    );
    expect(macosLanesScript).toContain("npm run build:developer-preview");
    expect(macosLanesScript).not.toContain(
      "HAZAKURA_DISTRIBUTION_LANE=developer VITE_HAZAKURA_DISTRIBUTION_LANE=developer npm run build",
    );
  });
});
