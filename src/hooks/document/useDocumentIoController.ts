import { useDocumentPersistence } from "./useDocumentPersistence";
import { useSaveActions } from "./useSaveActions";

type UseDocumentIoControllerOptions = Parameters<typeof useSaveActions>[0] &
  Pick<
    Parameters<typeof useDocumentPersistence>[0],
    | "activeContents"
    | "autoBackupEnabled"
    | "materializeImagesOnExport"
    | "mediaAccess"
    | "bookScopeChapters"
    | "bookScopeUnavailable"
  >;

export function useDocumentIoController(
  options: UseDocumentIoControllerOptions,
) {
  const saveActions = useSaveActions(options);
  const persistenceActions = useDocumentPersistence(options);

  return {
    ...saveActions,
    ...persistenceActions,
  };
}
