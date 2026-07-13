/**
 * Purpose-led right-pane toggle titles that reflect open / hidden /
 * retained state (v1.9 Writing Loop Clarity W2).
 */

export type PaneToggleTitleCopy = {
  previewTabTitle: string;
  previewTabTitleHide: string;
  referenceTabTitle: string;
  referenceTabTitleHide: string;
  referenceTabTitleRetained: string;
  ebookTabTitle: string;
  ebookTabTitleHide: string;
  outlineTabTitle: string;
  outlineTabTitleHide: string;
  diffTabTitle: string;
  diffTabTitleHide: string;
};

export type PaneToggleTitleState = {
  previewActive: boolean;
  referenceActive: boolean;
  /** Reference session is loaded even when the column is hidden. */
  referenceLoaded: boolean;
  ebookActive: boolean;
  outlineActive: boolean;
  diffActive: boolean;
};

export type ResolvedPaneToggleTitles = {
  preview: string;
  reference: string;
  ebook: string;
  outline: string;
  diff: string;
};

export function resolvePaneToggleTitles(
  copy: PaneToggleTitleCopy,
  state: PaneToggleTitleState,
): ResolvedPaneToggleTitles {
  return {
    preview: state.previewActive
      ? copy.previewTabTitleHide
      : copy.previewTabTitle,
    reference: state.referenceActive
      ? copy.referenceTabTitleHide
      : state.referenceLoaded
        ? copy.referenceTabTitleRetained
        : copy.referenceTabTitle,
    ebook: state.ebookActive ? copy.ebookTabTitleHide : copy.ebookTabTitle,
    outline: state.outlineActive
      ? copy.outlineTabTitleHide
      : copy.outlineTabTitle,
    diff: state.diffActive ? copy.diffTabTitleHide : copy.diffTabTitle,
  };
}
