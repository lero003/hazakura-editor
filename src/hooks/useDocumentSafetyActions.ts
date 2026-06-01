import { useExternalChangeActions } from "./useExternalChangeActions";
import { useRecoveryActions } from "./useRecoveryActions";
import { useTabCloseFlow } from "./useTabCloseFlow";

type UseDocumentSafetyActionsOptions = Parameters<typeof useTabCloseFlow>[0] &
  Parameters<typeof useRecoveryActions>[0] &
  Parameters<typeof useExternalChangeActions>[0];

export function useDocumentSafetyActions(
  options: UseDocumentSafetyActionsOptions,
) {
  const tabCloseActions = useTabCloseFlow(options);
  const recoveryActions = useRecoveryActions(options);
  const externalChangeActions = useExternalChangeActions(options);

  return {
    ...tabCloseActions,
    ...recoveryActions,
    ...externalChangeActions,
  };
}
