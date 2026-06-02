import { useEffect, useRef } from "react";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  Compartment,
  EditorState,
  Prec,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
} from "@codemirror/view";
import { tags as highlightTags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import type { BaseTheme } from "../types";

type CandidateEditorProps = {
  documentKey: string;
  value: string;
  theme: BaseTheme;
  fontSize: number;
  tabSize: number;
  wrapLines: boolean;
  spellcheckEnabled: boolean;
  placeholder: string;
  readOnly: boolean;
  ariaLabel: string;
  onChange: (nextValue: string) => void;
};

// CandidateEditor is a self-contained CodeMirror 6 editor used as the
// right-side manual candidate input slot in Review Desk. It mirrors the
// theme and Markdown highlighting shape of the main EditorPane so the
// candidate feels like a real editing surface rather than a plain
// textbox, while keeping Compare / Apply as explicit buttons and the
// existing candidate edit / tab / buffer safety guards untouched. The
// state contract (value + onChange) is the same as the previous
// <textarea>, so useReviewDeskState and its safety wiring are not
// affected. See docs/roadmap.md 0.8 and the foundation slice notes in
// docs/current-status.md.
export function CandidateEditor({
  ariaLabel,
  documentKey,
  fontSize,
  placeholder,
  readOnly,
  spellcheckEnabled,
  tabSize,
  theme,
  value,
  wrapLines,
  onChange,
}: CandidateEditorProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const themeCompartmentRef = useRef(new Compartment());
  const wrapCompartmentRef = useRef(new Compartment());
  const tabSizeCompartmentRef = useRef(new Compartment());
  const spellCompartmentRef = useRef(new Compartment());
  const readOnlyCompartmentRef = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const view = new EditorView({
      doc: value,
      parent: mountRef.current,
      extensions: [
        basicSetup,
        Prec.highest(keymap.of([indentWithTab])),
        markdown(),
        readOnlyCompartmentRef.current.of(
          EditorState.readOnly.of(readOnly),
        ),
        themeCompartmentRef.current.of([
          candidateEditorTheme(theme, fontSize),
          syntaxHighlighting(candidateEditorHighlightStyle()),
        ]),
        wrapCompartmentRef.current.of(
          wrapLines ? EditorView.lineWrapping : [],
        ),
        tabSizeCompartmentRef.current.of(
          EditorState.tabSize.of(tabSize),
        ),
        spellCompartmentRef.current.of(
          EditorView.contentAttributes.of({
            "data-placeholder": placeholder,
            spellcheck: spellcheckEnabled ? "true" : "false",
          }),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });
    viewRef.current = view;

    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [documentKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure([
        candidateEditorTheme(theme, fontSize),
        syntaxHighlighting(candidateEditorHighlightStyle()),
      ]),
    });
  }, [fontSize, theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartmentRef.current.reconfigure(
        wrapLines ? EditorView.lineWrapping : [],
      ),
    });
  }, [wrapLines]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: tabSizeCompartmentRef.current.reconfigure(
        EditorState.tabSize.of(tabSize),
      ),
    });
  }, [tabSize]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: spellCompartmentRef.current.reconfigure(
        EditorView.contentAttributes.of({
          "data-placeholder": placeholder,
          spellcheck: spellcheckEnabled ? "true" : "false",
        }),
      ),
    });
  }, [placeholder, spellcheckEnabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
  }, [value]);

  return (
    <div
      className="review-surface-candidate-editor"
      aria-label={ariaLabel}
    >
      <div
        id="review-surface-candidate-editor-mount"
        className="editor-mount"
        ref={mountRef}
      />
    </div>
  );
}

function candidateEditorTheme(theme: BaseTheme, fontSize: number) {
  const safeFontSize = Math.min(Math.max(fontSize, 12), 22);
  return EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--surface)",
        color: "var(--text)",
        height: "100%",
        fontSize: `${safeFontSize}px`,
      },
      ".cm-scroller": {
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      ".cm-content": {
        caretColor: "var(--cm-caret)",
        padding: "12px 0",
      },
      ".cm-line": {
        padding: "0 18px",
      },
      ".cm-gutters": {
        backgroundColor: "var(--cm-gutter-bg)",
        borderRight: "1px solid var(--cm-gutter-border)",
        color: "var(--cm-gutter-fg)",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--cm-active-line-bg)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--cm-active-gutter-bg)",
      },
      ".cm-selectionLayer .cm-selectionBackground": {
        backgroundColor: "var(--cm-selection-bg)",
        opacity: "1",
      },
      "&.cm-focused .cm-selectionLayer .cm-selectionBackground": {
        backgroundColor: "var(--cm-selection-bg)",
      },
      ".cm-content ::selection": {
        backgroundColor: "var(--cm-selection-bg)",
      },
      "&.cm-focused": {
        outline: "none",
      },
    },
    { dark: theme === "dark" },
  );
}

function candidateEditorHighlightStyle() {
  return HighlightStyle.define([
    {
      tag: [
        highlightTags.heading,
        highlightTags.heading1,
        highlightTags.heading2,
        highlightTags.heading3,
      ],
      color: "var(--cm-mark-heading)",
      fontWeight: "700",
    },
    {
      tag: [highlightTags.strong, highlightTags.emphasis],
      color: "var(--cm-mark-strong)",
    },
    {
      tag: [highlightTags.link, highlightTags.url],
      color: "var(--cm-mark-link)",
      textDecoration: "underline",
    },
    {
      tag: highlightTags.monospace,
      color: "var(--cm-mark-monospace)",
    },
    {
      tag: highlightTags.quote,
      color: "var(--cm-mark-quote)",
      fontStyle: "italic",
    },
  ]);
}
