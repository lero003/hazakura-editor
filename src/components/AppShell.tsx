import type { ComponentProps } from "react";
import type { ResolvedTheme, ReviewSurface as ReviewSurfaceKind } from "../types";
import type { ReviewDeskCopy } from "../locale";
import type { ReviewDeskMode } from "../types";
import { AppDocumentFeedback } from "./AppDocumentFeedback";
import { AppOverlays } from "./AppOverlays";
import { AppStatusBar } from "./AppStatusBar";
import { AppTopChrome } from "./AppTopChrome";
import { AppWorkspace } from "./AppWorkspace";
import { ReviewSurface } from "./ReviewSurface";
import { SakuraPetals } from "./SakuraPetals";

export type AppShellProps = ComponentProps<typeof AppTopChrome> &
  ComponentProps<typeof AppDocumentFeedback> &
  ComponentProps<typeof AppWorkspace> &
  ComponentProps<typeof AppStatusBar> &
  ComponentProps<typeof AppOverlays> & {
    onCloseReviewDesk: () => void;
    resolvedTheme: ResolvedTheme;
    reviewDeskCopy: ReviewDeskCopy;
    reviewDeskMode: ReviewDeskMode;
    reviewSurface: ReviewSurfaceKind;
    zenMode: boolean;
  };

export function AppShell(props: AppShellProps) {
  return (
    <main className={`app-shell${props.zenMode ? " zen-mode" : ""}`}>
      {props.resolvedTheme === "sakura" ? <SakuraPetals /> : null}
      <AppTopChrome {...props} />
      <AppDocumentFeedback {...props} />
      {props.reviewSurface !== null ? (
        <ReviewSurface
          onClose={props.onCloseReviewDesk}
          reviewDeskCopy={props.reviewDeskCopy}
          reviewDeskMode={props.reviewDeskMode}
        />
      ) : (
        <AppWorkspace {...props} />
      )}
      <AppStatusBar {...props} />
      <AppOverlays {...props} />
    </main>
  );
}
