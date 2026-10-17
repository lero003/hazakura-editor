import type { Dispatch, RefObject, SetStateAction } from "react";
import type { OpenTextFileOptions } from "../document/useFileOpening";
import type {
  EditorPaneHandle,
  MarkdownFormat,
} from "../../components/editor/EditorPane";
import {
  commandPaletteEntry,
  type CommandPaletteCopy,
  type LModeCopy,
} from "../../lib/locale";
import type {
  EditorSettings,
  EditorTab,
  PreferencesDialogMode,
  ThemePreference,
} from "../../types";
import type { Command } from "./useCommandPalette";

export type CommandPaletteActions = {
  applyActiveMarkdownFormat: (kind: MarkdownFormat) => void;
  createNewFile: () => Promise<void>;
  exportEpubBeta: () => Promise<void>;
  exportHtml: () => Promise<void>;
  exportPdf: () => Promise<void>;
  pinExternalImages: () => Promise<void>;
  focusAdjacentTab: (direction: "next" | "previous") => void;
  handleSendSelectionToAgent: (text: string) => void;
  importSourceAsMarkdownDraft: () => Promise<void>;
  insertTable: () => void;
  openAgentWindow: (themePreference: ThemePreference) => void;
  openAppleAssistWindow: (themePreference: ThemePreference) => void;
  openFile: () => Promise<void>;
  openReferenceFile: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  openWorkspaceFile: (path: string, options?: OpenTextFileOptions) => Promise<EditorTab | null | void>;
  openOkfReview: (bundleRoot?: string | null) => void;
  createOkfScaffold: (templateId: "minimal" | "book-like") => void;
  requestCloseTab: (id: string) => void;
  requestRestoreFromBackup: () => void;
  requestReviewTabAgainstDisk: (tab: EditorTab) => void;
  requestWindowClose: () => void;
  saveActiveTab: () => Promise<void>;
  saveActiveTabAs: () => Promise<void>;
  setEditorSettings: Dispatch<SetStateAction<EditorSettings>>;
  setFindVisible: Dispatch<SetStateAction<boolean>>;
  setPreferencesDialogMode: Dispatch<
    SetStateAction<PreferencesDialogMode | null>
  >;
  togglePreviewSurface: () => void;
  toggleDiffPane: () => void;
  toggleLMode: () => void;
  toggleOutlinePane: () => void;
  toggleQuickOpen: () => void;
};

/**
 * Everything `buildCommandCommands` reads from the controller. Keeping the
 * inputs explicit lets the command table live outside the hook while the hook
 * keeps owning state, memoization and the action implementations.
 */
export type CommandEntryContext = {
  actions: CommandPaletteActions;
  activeTab: EditorTab | null;
  activeTabId: string | null;
  appleLocalAssistActive: boolean;
  appleLocalAssistAllowed: boolean;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  externalCliAllowed: boolean;
  lModeCopy: LModeCopy;
  markdownPaletteCommands: Command[];
  paletteCopy: CommandPaletteCopy;
  themePreference: ThemePreference;
  workspaceRootPath: string | null;
  /** Read lazily: the hook declares the global-search state after this memo. */
  openGlobalSearch: () => void;
};

export function buildCommandCommands(ctx: CommandEntryContext): Command[] {
  return [
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.new",
        ...commandPaletteEntry(ctx.paletteCopy, "file.new", [
          "create",
          "new",
          "tab",
        ]),
        run: () => {
          void ctx.actions.createNewFile();
        },
        shortcut: "⌘N",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.open",
        ...commandPaletteEntry(ctx.paletteCopy, "file.open", [
          "open",
          "file",
          "load",
        ]),
        run: () => {
          void ctx.actions.openFile();
        },
        shortcut: "⌘O",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.importPdfImageDraft",
        ...commandPaletteEntry(ctx.paletteCopy, "file.importPdfImageDraft", [
          "import",
          "pdf",
          "image",
          "ocr",
          "vision",
          "markdown",
          "draft",
          "scan",
        ]),
        run: () => {
          void ctx.actions.importSourceAsMarkdownDraft();
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.openReference",
        ...commandPaletteEntry(ctx.paletteCopy, "file.openReference", [
          "reference",
          "compare",
          "side-by-side",
          "readonly",
        ]),
        run: () => {
          void ctx.actions.openReferenceFile();
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.openWorkspace",
        ...commandPaletteEntry(ctx.paletteCopy, "file.openWorkspace", [
          "workspace",
          "folder",
          "directory",
          "open",
        ]),
        run: () => {
          void ctx.actions.openWorkspace();
        },
        shortcut: "⇧⌘O",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.quickOpen",
        ...commandPaletteEntry(ctx.paletteCopy, "file.quickOpen", [
          "quick",
          "open",
          "file",
          "search",
        ]),
        run: () => {
          ctx.actions.toggleQuickOpen();
        },
        shortcut: "⌘P",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.save",
        ...commandPaletteEntry(ctx.paletteCopy, "file.save", ["save", "write"]),
        ...(ctx.activeTab
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needActiveDocument,
            }),
        run: () => {
          void ctx.actions.saveActiveTab();
        },
        shortcut: "⌘S",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.saveAs",
        ...commandPaletteEntry(ctx.paletteCopy, "file.saveAs", [
          "save",
          "as",
          "duplicate",
        ]),
        ...(ctx.activeTab
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needActiveDocument,
            }),
        run: () => {
          void ctx.actions.saveActiveTabAs();
        },
        shortcut: "⇧⌘S",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.closeTab",
        ...commandPaletteEntry(ctx.paletteCopy, "file.closeTab", ["close", "tab"]),
        ...(ctx.activeTabId
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needActiveDocument,
            }),
        run: () => {
          if (ctx.activeTabId) {
            ctx.actions.requestCloseTab(ctx.activeTabId);
          }
        },
        shortcut: "⌘W",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.closeWindow",
        ...commandPaletteEntry(ctx.paletteCopy, "file.closeWindow", [
          "close",
          "window",
          "quit",
        ]),
        run: () => {
          void ctx.actions.requestWindowClose();
        },
        shortcut: "⇧⌘W",
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.exportHtml",
        ...commandPaletteEntry(ctx.paletteCopy, "file.exportHtml", [
          "export",
          "html",
        ]),
        ...(ctx.activeTab
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needActiveDocument,
            }),
        run: () => {
          void ctx.actions.exportHtml();
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.exportEpubBeta",
        ...commandPaletteEntry(ctx.paletteCopy, "file.exportEpubBeta", [
          "export",
          "epub",
          "book",
        ]),
        ...(ctx.activeTab
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needActiveDocument,
            }),
        run: () => {
          void ctx.actions.exportEpubBeta();
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.exportPdf",
        ...commandPaletteEntry(ctx.paletteCopy, "file.exportPdf", [
          "export",
          "pdf",
        ]),
        ...(ctx.activeTab
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needActiveDocument,
            }),
        run: () => {
          void ctx.actions.exportPdf();
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.pinExternalImages",
        ...commandPaletteEntry(ctx.paletteCopy, "file.pinExternalImages", [
          "pin",
          "image",
          "assets",
          "media",
        ]),
        ...(!ctx.activeTab
          ? {
              disabledReason: ctx.paletteCopy.disabledReasons.needActiveDocument,
            }
          : !ctx.workspaceRootPath
            ? {
                disabledReason: ctx.paletteCopy.disabledReasons.needWorkspace,
              }
            : {}),
        run: () => {
          void ctx.actions.pinExternalImages();
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.restoreBackup",
        ...commandPaletteEntry(ctx.paletteCopy, "file.restoreBackup", [
          "restore",
          "backup",
          "auto",
          "snapshot",
          "recover",
        ]),
        run: () => {
          ctx.actions.requestRestoreFromBackup();
        },
      },
      {
        category: ctx.paletteCopy.categories.edit,
        id: "edit.find",
        ...commandPaletteEntry(ctx.paletteCopy, "edit.find", [
          "find",
          "search",
          "match",
        ]),
        run: () => {
          ctx.actions.setFindVisible(true);
        },
        shortcut: "⌘F",
      },
      {
        category: ctx.paletteCopy.categories.edit,
        id: "edit.findInFiles",
        ...commandPaletteEntry(ctx.paletteCopy, "edit.findInFiles", [
          "find",
          "search",
          "files",
          "workspace",
          "grep",
        ]),
        run: () => {
          ctx.openGlobalSearch();
        },
        shortcut: "⇧⌘F",
      },
      ...ctx.markdownPaletteCommands,
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.preview",
        ...commandPaletteEntry(ctx.paletteCopy, "view.preview", [
          "preview",
          "view",
          "render",
        ]),
        run: () => {
          ctx.actions.togglePreviewSurface();
        },
        shortcut: "⌥⌘P",
      },
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.wrap",
        ...commandPaletteEntry(ctx.paletteCopy, "view.wrap", [
          "wrap",
          "word",
          "line",
        ]),
        run: () => {
          ctx.actions.setEditorSettings((current) => ({
            ...current,
            wrapLines: !current.wrapLines,
          }));
        },
        shortcut: "⌥⌘W",
      },
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.invisibles",
        ...commandPaletteEntry(ctx.paletteCopy, "view.invisibles", [
          "invisible",
          "whitespace",
          "characters",
        ]),
        run: () => {
          ctx.actions.setEditorSettings((current) => ({
            ...current,
            showInvisibles: !current.showInvisibles,
          }));
        },
        shortcut: "⌥⌘I",
      },
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.outline",
        ...commandPaletteEntry(ctx.paletteCopy, "view.outline", [
          "outline",
          "headings",
          "navigation",
        ]),
        run: () => {
          ctx.actions.toggleOutlinePane();
        },
      },
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.diff",
        ...commandPaletteEntry(ctx.paletteCopy, "view.diff", ["diff", "compare"]),
        run: () => {
          ctx.actions.toggleDiffPane();
        },
      },
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.nextTab",
        ...commandPaletteEntry(ctx.paletteCopy, "view.nextTab", [
          "tab",
          "next",
          "focus",
        ]),
        run: () => {
          ctx.actions.focusAdjacentTab("next");
        },
        shortcut: "⌥⌘→",
      },
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.prevTab",
        ...commandPaletteEntry(ctx.paletteCopy, "view.prevTab", [
          "tab",
          "previous",
          "focus",
        ]),
        run: () => {
          ctx.actions.focusAdjacentTab("previous");
        },
        shortcut: "⌥⌘←",
      },
      {
        category: ctx.paletteCopy.categories.view,
        id: "view.toggleLMode",
        keywords: ["l", "mode", "focus", "zen", "える", "エル", "reading"],
        label: ctx.lModeCopy.paletteCommand,
        run: () => {
          ctx.actions.toggleLMode();
        },
        shortcut: "⇧⌘L",
      },
      {
        category: ctx.paletteCopy.categories.review,
        id: "review.tabAgainstDisk",
        ...commandPaletteEntry(ctx.paletteCopy, "review.tabAgainstDisk", [
          "review",
          "diff",
          "disk",
        ]),
        // Pathless drafts (new file / Import Assist) have activeTab but no
        // disk path; openTextFile("") would fail if we only checked tab presence.
        ...(ctx.activeTab?.path
          ? {}
          : {
              disabledReason: ctx.activeTab
                ? ctx.paletteCopy.disabledReasons.needSavedDocument
                : ctx.paletteCopy.disabledReasons.needActiveDocument,
            }),
        run: () => {
          if (ctx.activeTab?.path) {
            ctx.actions.requestReviewTabAgainstDisk(ctx.activeTab);
          }
        },
      },
      {
        category: ctx.paletteCopy.categories.review,
        id: "review.okfDraftCompatibility",
        ...commandPaletteEntry(ctx.paletteCopy, "review.okfDraftCompatibility", [
          "okf",
          "compatibility",
          "bundle",
          "frontmatter",
          "review",
        ]),
        ...(ctx.workspaceRootPath
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needWorkspace,
            }),
        run: () => {
          ctx.actions.openOkfReview();
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.okfScaffoldMinimal",
        ...commandPaletteEntry(ctx.paletteCopy, "file.okfScaffoldMinimal", [
          "okf",
          "scaffold",
          "template",
          "starter",
          "knowledge",
        ]),
        ...(ctx.workspaceRootPath
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needWorkspace,
            }),
        run: () => {
          ctx.actions.createOkfScaffold("minimal");
        },
      },
      {
        category: ctx.paletteCopy.categories.file,
        id: "file.okfScaffoldBookLike",
        ...commandPaletteEntry(ctx.paletteCopy, "file.okfScaffoldBookLike", [
          "okf",
          "scaffold",
          "template",
          "book",
          "chapter",
        ]),
        ...(ctx.workspaceRootPath
          ? {}
          : {
              disabledReason: ctx.paletteCopy.disabledReasons.needWorkspace,
            }),
        run: () => {
          ctx.actions.createOkfScaffold("book-like");
        },
      },
      ...(ctx.externalCliAllowed
        ? [
            {
              category: ctx.paletteCopy.categories.agent,
              id: "agent.open",
              ...commandPaletteEntry(ctx.paletteCopy, "agent.open", [
                "agent",
                "claude",
                "codex",
                "opencode",
                "pi",
                "workbench",
              ]),
              run: () => {
                void ctx.actions.openAgentWindow(ctx.themePreference);
              },
            },
          ]
        : []),
      ...(ctx.appleLocalAssistActive
        ? [
            {
              category: ctx.paletteCopy.categories.writingCompanion,
              id: "apple-assist.openWindow",
              ...commandPaletteEntry(ctx.paletteCopy, "apple-assist.openWindow", [
                "apple",
                "local",
                "assist",
                "writing",
                "companion",
                "foundation",
                "models",
                "hazakura",
              ]),
              run: () => {
                void ctx.actions.openAppleAssistWindow(ctx.themePreference);
              },
            },
          ]
        : []),
      ...(ctx.externalCliAllowed
        ? [
            {
              category: ctx.paletteCopy.categories.agent,
              id: "agent.sendSelection",
              ...commandPaletteEntry(ctx.paletteCopy, "agent.sendSelection", [
                "agent",
                "send",
                "selection",
              ]),
              run: () => {
                const text = ctx.editorPaneRef.current?.getSelectionText() ?? "";
                ctx.actions.handleSendSelectionToAgent(text);
              },
            },
          ]
        : []),
      ...(ctx.externalCliAllowed || ctx.appleLocalAssistAllowed
        ? [
            {
              category: ctx.externalCliAllowed
                ? ctx.paletteCopy.categories.agent
                : ctx.paletteCopy.categories.settings,
              id: ctx.externalCliAllowed
                ? "agent.preferences"
                : "assist.preferences",
              ...commandPaletteEntry(
                ctx.paletteCopy,
                ctx.externalCliAllowed
                  ? "agent.preferences"
                  : "assist.preferences",
                ctx.externalCliAllowed
                  ? ["agent", "preferences", "settings", "workbench"]
                  : ["assist", "apple", "local", "preferences", "settings"],
              ),
              run: () => {
                ctx.actions.setPreferencesDialogMode("agent");
              },
            },
          ]
        : []),
      {
        category: ctx.paletteCopy.categories.settings,
        id: "settings.open",
        ...commandPaletteEntry(ctx.paletteCopy, "settings.open", [
          "settings",
          "preferences",
        ]),
        run: () => {
          ctx.actions.setPreferencesDialogMode("settings");
        },
        shortcut: "⌘,",
      },
      {
        category: ctx.paletteCopy.categories.help,
        id: "help.localDataDisclosure",
        ...commandPaletteEntry(ctx.paletteCopy, "help.localDataDisclosure", [
          "privacy",
          "local",
          "data",
          "policy",
          "disclosure",
          "telemetry",
          "analytics",
          "backup",
          "sync",
          "network",
        ]),
        run: () => {
          ctx.actions.setPreferencesDialogMode("privacy");
        },
      },
      {
        category: ctx.paletteCopy.categories.help,
        id: "help.supportDiagnostics",
        ...commandPaletteEntry(ctx.paletteCopy, "help.supportDiagnostics", [
          "support",
          "diagnostics",
          "diagnostic",
          "snapshot",
          "json",
          "redacted",
          "share",
          "copy",
        ]),
        run: () => {
          ctx.actions.setPreferencesDialogMode("diagnostics");
        },
      },
      {
        category: ctx.paletteCopy.categories.help,
        id: "help.privacyPolicy",
        ...commandPaletteEntry(ctx.paletteCopy, "help.privacyPolicy", [
          "privacy",
          "policy",
          "app",
          "store",
          "metadata",
          "local",
          "data",
        ]),
        run: () => {
          ctx.actions.setPreferencesDialogMode("privacy-policy");
        },
      },
      {
        category: ctx.paletteCopy.categories.help,
        id: "help.openSourceAcknowledgements",
        ...commandPaletteEntry(ctx.paletteCopy, "help.openSourceAcknowledgements", [
          "open",
          "source",
          "license",
          "licenses",
          "acknowledgements",
          "dependencies",
          "third-party",
        ]),
        run: () => {
          ctx.actions.setPreferencesDialogMode("open-source-acknowledgements");
        },
      },
      {
        category: ctx.paletteCopy.categories.help,
        id: "help.booksAndKnowledgeFolders",
        ...commandPaletteEntry(ctx.paletteCopy, "help.booksAndKnowledgeFolders", [
          "book",
          "books",
          "chapter",
          "okf",
          "knowledge",
          "folder",
          "structure",
          "markdown",
          "export",
          "scope",
        ]),
        run: () => {
          ctx.actions.setPreferencesDialogMode("books-and-knowledge-folders");
        },
      },
      {
        category: ctx.paletteCopy.categories.help,
        id: "help.about",
        ...commandPaletteEntry(ctx.paletteCopy, "help.about", [
          "about",
          "version",
          "support",
          "hazakura",
          "editor",
          "lane",
        ]),
        run: () => {
          ctx.actions.setPreferencesDialogMode("about");
        },
      },
  ];
}
