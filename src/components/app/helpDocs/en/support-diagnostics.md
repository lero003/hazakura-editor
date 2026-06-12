# Support Diagnostics

A short, privacy-preserving snapshot of the app's state for sharing with support. It is generated locally on this Mac; the app never uploads it.

## What this is

The diagnostics pane runs the same `collectDiagnostics()` helper that the existing privacy tests cover. It returns app version, distribution lane, current feature flags, and a short list of recent error categories, then renders the result as JSON.

## What it includes

App version, distribution lane (`developer` or `app-store`), the current theme, whether line wrap, L Mode, auto-backup, and assist availability are on, and the platform reported by the browser. The pane refreshes on demand and shows the time the snapshot was built.

## What it does not include

No document contents, no file paths, no open tabs, no recent files, no provider transcripts, no command history, no window titles, no full error messages, and no secret-looking values. The helper redaction rule folds any unknown, path-like, or sensitive-looking error category to a generic "Other" tag before the snapshot is built, and a structural check rejects forbidden keys before the JSON is shown or copied.

## How to use it

Open this page through the Help menu or the command palette, review the JSON, and use Copy to put it on your clipboard. Paste it into a support request, such as the Hazakura Editor support page at [hazakura.dev/hazakura-editor/support](https://hazakura.dev/hazakura-editor/support/), only if you have reviewed the snapshot yourself; the helper does not see or send anything you do not explicitly copy.

## What is not yet wired

A bounded, sanitised recent error log is not yet available on the frontend, so the recent error categories list is empty until such a log ships. Every other field is read live from the current editor settings.
