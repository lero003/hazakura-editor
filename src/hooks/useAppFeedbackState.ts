import { useState } from "react";

export function useAppFeedbackState() {
  const [status, setStatus] = useState("Ready");
  const [globalError, setGlobalError] = useState<string | null>(null);

  return {
    globalError,
    setGlobalError,
    setStatus,
    status,
  };
}
