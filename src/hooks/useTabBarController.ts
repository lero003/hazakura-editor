import { useTabNavigation } from "./useTabNavigation";
import { useTabReorder } from "./useTabReorder";

type UseTabBarControllerOptions = Parameters<typeof useTabNavigation>[0] & {
  setTabs: Parameters<typeof useTabReorder>[0];
};

export function useTabBarController(options: UseTabBarControllerOptions) {
  const navigationActions = useTabNavigation(options);
  const reorderActions = useTabReorder(options.setTabs);

  return {
    ...navigationActions,
    ...reorderActions,
  };
}
