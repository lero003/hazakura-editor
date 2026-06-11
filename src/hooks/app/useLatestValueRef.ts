import { useLayoutEffect, useRef } from "react";

export function useLatestValueRef<T>(value: T) {
  const valueRef = useRef(value);

  useLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);

  return valueRef;
}
