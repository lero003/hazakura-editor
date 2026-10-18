import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { lModeExtension, type LModeContext } from "./lMode";
import {
  editorReadOnlyExtensions,
  editorTheme,
  getEditorWrappingExtensions,
  invisibleCharactersField,
} from "./editorPresentation";

/**
 * Compartment values for the editor surface.
 *
 * `EditorPane` mounts the editor with seven compartments and reconfigures each
 * one from its own effect. Both paths used to spell the value expressions out
 * separately, which made it easy to change one and forget the other. These
 * builders are the single place that decides what each compartment holds; the
 * mount array and the reconfigure effects only choose which one to apply.
 */

export function editorWrappingCompartmentValue(
  wrapLines: boolean,
  lModeEnabled: boolean,
): Extension {
  return getEditorWrappingExtensions(wrapLines, lModeEnabled);
}

export function editorInvisiblesCompartmentValue(
  showInvisibles: boolean,
  lModeEnabled: boolean,
): Extension {
  return showInvisibles && !lModeEnabled
    ? invisibleCharactersField
    : [];
}

export function editorTabSizeCompartmentValue(tabSize: number): Extension {
  return EditorState.tabSize.of(tabSize);
}

export function editorSpellcheckCompartmentValue(enabled: boolean): Extension {
  return EditorView.contentAttributes.of({
    spellcheck: enabled ? "true" : "false",
  });
}

export function editorThemeCompartmentValue(
  theme: Parameters<typeof editorTheme>[0],
  fontSize: number,
  highlight: Extension,
): Extension {
  return [editorTheme(theme, fontSize), highlight];
}

export function editorLModeCompartmentValue(
  lModeEnabled: boolean,
  context: LModeContext,
  typewriterMode: boolean,
): Extension {
  return lModeExtension(lModeEnabled, context, { typewriterMode });
}

export function editorReadOnlyCompartmentValue(readOnly: boolean): Extension {
  return editorReadOnlyExtensions(readOnly);
}
