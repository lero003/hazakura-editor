type ShortcutKeyboardEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export function isImeComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.key === "Process";
}

export function isEditorKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".editor-host") !== null;
}

export function isCommandKeyPressed(event: ShortcutKeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

export function isCommandShortcut(
  event: ShortcutKeyboardEvent,
  key: string,
): boolean {
  return isCommandKeyPressed(event) && event.key.toLowerCase() === key;
}

export function isCommandAltShortcut(
  event: ShortcutKeyboardEvent,
  key: string,
): boolean {
  return (
    isCommandKeyPressed(event) &&
    event.altKey &&
    event.key.toLowerCase() === key
  );
}

export function isCommandShiftShortcut(
  event: ShortcutKeyboardEvent,
  key: string,
): boolean {
  return (
    isCommandKeyPressed(event) &&
    event.shiftKey &&
    event.key.toLowerCase() === key
  );
}

export function isCommandAltArrowShortcut(
  event: ShortcutKeyboardEvent,
): boolean {
  return (
    isCommandKeyPressed(event) &&
    event.altKey &&
    (event.key === "ArrowLeft" || event.key === "ArrowRight")
  );
}
