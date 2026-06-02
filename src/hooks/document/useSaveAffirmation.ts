import { useEffect, useRef, useState } from "react";

const AFFIRMATION_DURATION_MS = 1400;
const AFFIRMATION_MESSAGES = new Set(["Saved", "保存しました"]);

export type SaveAffirmationState = {
  affirmation: boolean;
  lastAffirmedAt: number | null;
};

export function useSaveAffirmation(status: string): SaveAffirmationState {
  const [affirmation, setAffirmation] = useState(false);
  const [lastAffirmedAt, setLastAffirmedAt] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!AFFIRMATION_MESSAGES.has(status)) {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAffirmation(true);
    setLastAffirmedAt(Date.now());
    timeoutRef.current = setTimeout(() => {
      setAffirmation(false);
      timeoutRef.current = null;
    }, AFFIRMATION_DURATION_MS);
  }, [status]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return { affirmation, lastAffirmedAt };
}
