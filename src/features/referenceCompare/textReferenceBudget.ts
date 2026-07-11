export const MAX_TEXT_REFERENCE_CHARS = 1_500_000;
export const MAX_TEXT_REFERENCE_LINES = 50_000;

/**
 * Reference text is rendered as natural-height source so wrapping, selection,
 * and copy remain correct. Keep that full-DOM surface within a separate budget
 * rather than inheriting the editor's broader 10 MB file-open ceiling.
 */
export function isTextReferenceWithinBudget(contents: string): boolean {
  if (contents.length > MAX_TEXT_REFERENCE_CHARS) {
    return false;
  }

  let lines = 1;
  for (let index = 0; index < contents.length; index += 1) {
    if (contents.charCodeAt(index) === 10) {
      lines += 1;
      if (lines > MAX_TEXT_REFERENCE_LINES) {
        return false;
      }
    }
  }
  return true;
}
