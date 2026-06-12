import { describe, expect, it } from "vitest";

import vitestConfig from "../vitest.config";

describe("test gate configuration", () => {
  it("pins the release test timeout above Vitest's default", () => {
    expect(vitestConfig).toMatchObject({
      test: {
        testTimeout: 20_000,
      },
    });
  });
});
