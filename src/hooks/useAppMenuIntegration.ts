import { useAppMenuActionListener } from "./useAppMenuActionListener";
import { useAppMenuActionsRef } from "./useAppMenuActionsRef";

type UseAppMenuIntegrationOptions = {
  actions: Parameters<typeof useAppMenuActionsRef>[0];
  listener: Omit<
    Parameters<typeof useAppMenuActionListener>[0],
    "actionsRef"
  >;
};

export function useAppMenuIntegration({
  actions,
  listener,
}: UseAppMenuIntegrationOptions) {
  const actionsRef = useAppMenuActionsRef(actions);

  useAppMenuActionListener({
    actionsRef,
    ...listener,
  });
}
