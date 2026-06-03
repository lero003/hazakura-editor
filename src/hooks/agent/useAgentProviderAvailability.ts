import { useEffect, useMemo, useState } from "react";
import type { AgentProviderAvailability } from "../../lib/tauri";
import { listAgentProviderAvailability } from "../../lib/tauri";

// `useAgentProviderAvailability` is a thin shared wrapper around the
// `list_agent_provider_availability` Tauri command. Both the main
// window's preferences pane and the detached Agent window need the
// same snapshot at mount, so the fetch + state plumbing lives here
// once. Returns the raw list and a `Map<provider, entry>` lookup
// (computed via `useMemo` so consumers do not rebuild it per
// render). The fetch is best-effort: a failed call leaves the
// snapshot empty and the lookup map returns undefined for every
// provider, so the dropdown degrades to "treat as available".

export type UseAgentProviderAvailabilityResult = {
  availability: AgentProviderAvailability[];
  availabilityByProvider: Map<string, AgentProviderAvailability>;
};

export function useAgentProviderAvailability(): UseAgentProviderAvailabilityResult {
  const [availability, setAvailability] = useState<AgentProviderAvailability[]>(
    [],
  );

  useEffect(() => {
    let disposed = false;
    void listAgentProviderAvailability()
      .then((snapshot) => {
        if (!disposed) {
          setAvailability(snapshot);
        }
      })
      .catch((err) => {
        console.warn("Failed to read Agent provider availability", err);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const availabilityByProvider = useMemo(
    () => new Map(availability.map((entry) => [entry.provider, entry])),
    [availability],
  );

  return {
    availability,
    availabilityByProvider,
  };
}
