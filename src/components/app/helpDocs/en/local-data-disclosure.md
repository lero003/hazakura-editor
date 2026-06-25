# Local Data Disclosure

A short description of what this app's code does. It does not describe what the operating system or external services may do.

## Files you choose

The app opens text files and supported local image previews that you pick through the macOS file or folder picker. It does not scan files on its own or touch your home directory.

Pasted images are accepted only after the decoded PNG/JPEG/GIF/WebP image data fits within the 20 MB local image limit. Dragged image files use the same 20 MB file-size boundary before they are copied into the selected workspace's `assets/` folder.

## Auto-backup (.hazakura/backups/...)

Only when you enable auto-backup, the app saves local .bak snapshots under a `.hazakura/backups/...` folder inside the selected workspace. Backups stay inside that workspace.

## Preview and export

The preview blocks external images and dangerous HTML, script, iframe, object, and embed tags. Small embedded `data:image` PNG/JPEG/GIF/WebP references are allowed only within the preview/export inline cap. Workspace-relative text links open inside the selected workspace. Explicit clicks on `http:`, `https:`, `mailto:`, and `tel:` links are handed to the OS default browser or app, while absolute paths, workspace-outside paths, unsupported files, and unsafe schemes stay blocked so the app WebView does not navigate away from the editor. HTML export inlines local workspace images as data URIs.

EPUB export is a beta, explicit File menu or command palette action that writes the active Markdown document after a local Title / Author / Language metadata dialog and a Save As dialog. Workspace-local images are packaged into the EPUB when they stay within the same local image boundaries; images that cannot be read are replaced with an in-document warning, and external images are not fetched. Blank-line-flanked standalone `---` or `===` lines are treated as explicit page-break hints for e-book preview and EPUB export, so documents that use those lines as ordinary horizontal rules may render differently in the beta reading/export surfaces. The beta does not send the document anywhere, does not write metadata or page-break settings back into the Markdown source, and does not guarantee page counts across EPUB readers. EPUBCheck validation remains a manual outside-app step; the app does not launch external validators, cover editors, or vertical-writing converters.

## Hazakura Local Assist

The App Store submission build may bundle Hazakura Local Assist as an on-device writing companion. It calls Apple's Foundation Models framework through the bundled helper only after an explicit user action. The app does not send Hazakura Local Assist requests to external AI services or external APIs, and there is no network fallback.

## App Store build

The App Store build does not include Agent Workbench, a CLI agent, or an arbitrary command surface. Related Agent menus, switches, shortcuts, and IPC routes are disabled.

## Network and analytics

This app's App Store lane code does not include fetch, XHR, analytics, telemetry, crash reporting, or external AI/API calls. Hazakura Local Assist may use the bundled Hazakura Local Assist helper to call Apple's local Foundation Models framework, and enabled Agent Workbench in the Developer / GitHub lane can launch an allowlisted provider. Explicit actions such as Show in Finder, PDF export, and Move to Trash may pass the selected path or generated export content to macOS system services.
