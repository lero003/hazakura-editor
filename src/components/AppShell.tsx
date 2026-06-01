import type { ComponentProps } from "react";
import type { ResolvedTheme } from "../types";
import { AppDocumentFeedback } from "./AppDocumentFeedback";
import { AppOverlays } from "./AppOverlays";
import { AppStatusBar } from "./AppStatusBar";
import { AppTopChrome } from "./AppTopChrome";
import { AppWorkspace } from "./AppWorkspace";
import { SakuraPetals } from "./SakuraPetals";

export type AppShellProps = ComponentProps<typeof AppTopChrome> &
  ComponentProps<typeof AppDocumentFeedback> &
  ComponentProps<typeof AppWorkspace> &
  ComponentProps<typeof AppStatusBar> &
  ComponentProps<typeof AppOverlays> & {
    resolvedTheme: ResolvedTheme;
    zenMode: boolean;
  };

export function AppShell(props: AppShellProps) {
  return (
    <main className={`app-shell${props.zenMode ? " zen-mode" : ""}`}>
      {props.resolvedTheme === "sakura" ? <SakuraPetals /> : null}
      <AppTopChrome {...props} />
      <AppDocumentFeedback {...props} />
      <AppWorkspace {...props} />
      <AppStatusBar {...props} />
      <AppOverlays {...props} />
    </main>
  );
}
