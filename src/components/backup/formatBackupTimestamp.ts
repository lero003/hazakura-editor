// Localized timestamp formatter for the auto-backup picker.
// Kept separate from the editor save-affirmation formatter
// because the picker's user-visible "modified at" string uses a
// slightly different layout (date + time on one line, no seconds)
// — splitting the two avoids making the shared helper branch
// on a flag.

function formatBackupTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export { formatBackupTimestamp as formatTimestamp };
