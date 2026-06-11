# Local Data Disclosure

A short description of what this app's code does. It does not describe what the operating system or external services may do.

## Files you choose

The app opens text files and supported local image previews that you pick through the macOS file or folder picker. It does not scan files on its own or touch your home directory.

Pasted images are accepted only after the decoded PNG/JPEG/GIF/WebP image data fits within the 20 MB local image limit. Dragged image files use the same 20 MB file-size boundary before they are copied into the selected workspace's `assets/` folder.

## Auto-backup (.hazakura/backups/...)

Only when you enable auto-backup, the app saves local .bak snapshots under a `.hazakura/backups/...` folder inside the selected workspace. Backups stay inside that workspace.

## Preview and export

The preview blocks external images and dangerous HTML, script, iframe, object, and embed tags. Small embedded `data:image` PNG/JPEG/GIF/WebP references are allowed only within the preview/export inline cap. The preview only routes link clicks to workspace-relative text file opens inside the selected workspace; external scheme links (`http:`, `https:`, `mailto:`, `tel:`, etc.) and absolute paths are ignored with a status message, so the click never navigates away from the editor. HTML export inlines local workspace images as data URIs.

## Apple Local Assist

The App Store submission build does not bundle Apple Local Assist and does not call Apple Foundation Models, external AI services, or external APIs. Developer / GitHub builds may expose Apple Local Assist as a separate alpha feature.

## App Store build

The App Store build does not include Agent Workbench, a CLI agent, Apple Local Assist helper, or an arbitrary command surface. Related menus, switches, shortcuts, and IPC routes are also disabled.

## Network and analytics

This app's App Store lane code does not include fetch, XHR, analytics, telemetry, crash reporting, or external AI/API calls. In the Developer / GitHub lane, Apple Local Assist may use the bundled Apple Local Assist helper and enabled Agent Workbench can launch an allowlisted provider. Explicit actions such as Show in Finder, print handoff, and Move to Trash may pass the selected path or a temporary file to macOS utilities.
