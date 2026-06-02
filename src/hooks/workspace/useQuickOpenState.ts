import { useCallback, useState } from "react";

export function useQuickOpenState() {
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);

  const closeQuickOpen = useCallback(() => {
    setQuickOpenVisible(false);
  }, []);

  const toggleQuickOpen = useCallback(() => {
    setQuickOpenVisible((visible) => !visible);
  }, []);

  return {
    closeQuickOpen,
    quickOpenVisible,
    toggleQuickOpen,
  };
}
