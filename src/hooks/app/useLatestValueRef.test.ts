import { useLayoutEffect } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestValueRef } from "./useLatestValueRef";

describe("useLatestValueRef", () => {
  it("updates before downstream layout effects can read the ref", () => {
    const layoutReads: string[] = [];

    const { rerender } = renderHook(
      ({ value }: { value: string }) => {
        const valueRef = useLatestValueRef(value);

        useLayoutEffect(() => {
          layoutReads.push(valueRef.current);
        }, [value, valueRef]);

        return valueRef;
      },
      { initialProps: { value: "before" } },
    );

    rerender({ value: "after" });

    expect(layoutReads).toEqual(["before", "after"]);
  });
});
