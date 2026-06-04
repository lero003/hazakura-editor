import { useEffect, useRef } from "react";
import type { AutoBackupEntry } from "../../lib/tauri/autoBackup";
import type { AutoBackupRestoreCopy } from "../../lib/locale/autoBackup";
import { formatTimestamp } from "./formatBackupTimestamp";

type RestoreFromBackupDialogProps = {
  copy: AutoBackupRestoreCopy;
  entries: AutoBackupEntry[];
  error: string | null;
  fileLabel: string;
  loading: boolean;
  onClose: () => void;
  onSelect: (entry: AutoBackupEntry) => void;
};

export function RestoreFromBackupDialog({
  copy,
  entries,
  error,
  fileLabel,
  loading,
  onClose,
  onSelect,
}: RestoreFromBackupDialogProps) {
  // Move keyboard focus to the first interactive element on mount
  // (Close when the list is empty / loading / errored, the first
  // row otherwise) so screen reader and keyboard users land in a
  // sensible place without needing a second tab.
  const firstEntryRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (loading || error || entries.length === 0) {
      closeButtonRef.current?.focus();
    } else {
      firstEntryRef.current?.focus();
    }
  }, [entries.length, error, loading]);

  // Self-contained Escape-to-close. The central
  // `useModalKeyboardGuard` only knows about the v0.7-era
  // modals, so the picker handles its own dismiss to keep
  // the wiring local.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="close-dialog restore-backup-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        tabIndex={-1}
      >
        <h2>{copy.title}</h2>
        <p className="restore-backup-file" title={fileLabel}>
          {fileLabel}
        </p>

        {error ? (
          <p className="restore-backup-message" role="alert">
            {copy.loadErrorPrefix} {error}
          </p>
        ) : loading ? (
          <p className="restore-backup-message">…</p>
        ) : entries.length === 0 ? (
          <p className="restore-backup-message">{copy.emptyMessage}</p>
        ) : (
          <ul
            className="restore-backup-list"
            role="listbox"
            aria-label={copy.title}
          >
            {entries.map((entry, index) => (
              <li key={entry.path} role="presentation">
                <button
                  ref={index === 0 ? firstEntryRef : null}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="restore-backup-row"
                  onClick={() => onSelect(entry)}
                >
                  <span className="restore-backup-row-name">{entry.name}</span>
                  <span className="restore-backup-row-meta">
                    {formatTimestamp(entry.modifiedAtMs)} · {formatBytes(entry.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="dialog-actions">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
          >
            {copy.closeButton}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
