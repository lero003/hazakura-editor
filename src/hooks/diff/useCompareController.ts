import { useCompareExecution } from "./useCompareExecution";
import { useCompareSetupActions } from "./useCompareSetupActions";

type UseCompareControllerOptions = Parameters<typeof useCompareSetupActions>[0] &
  Omit<
    Parameters<typeof useCompareExecution>[0],
    "clearCompareSource" | "setCompareSource"
  >;

export function useCompareController(options: UseCompareControllerOptions) {
  const setupActions = useCompareSetupActions(options);
  const executionActions = useCompareExecution({
    ...options,
    clearCompareSource: setupActions.clearCompareSource,
    setCompareSource: setupActions.setCompareSource,
  });

  return {
    ...setupActions,
    ...executionActions,
  };
}
