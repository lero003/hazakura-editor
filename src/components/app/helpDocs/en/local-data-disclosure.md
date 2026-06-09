# Local Data Disclosure

A short description of what this app's code does. It does not describe what the operating system or external services may do.

## Files you choose

The app only opens text files you pick through the macOS file or folder picker. It does not scan files on its own or touch your home directory.

## Auto-backup (.hazakura/backups/...)

Only when you enable auto-backup, the app saves local .bak snapshots under a `.hazakura/backups/...` folder inside the selected workspace. Backups stay inside that workspace.

## Preview and export

The preview blocks external images and dangerous HTML, script, iframe, object, and embed tags. The preview only routes link clicks to workspace-relative text file opens inside the selected workspace; external scheme links (`http:`, `https:`, `mailto:`, `tel:`, etc.) and absolute paths are ignored with a status message, so the click never navigates away from the editor. HTML export inlines local workspace images as data URIs.

## Apple Local Assist

Apple Local Assist is an experimental on-device helper that uses Apple's on-device model. The code runs on this Mac and does not send anything to a mail service or a server. Every change is recorded as an explicit action and can be reviewed through a diff before you save.

## App Store build

The App Store build does not include Agent Workbench, a CLI agent, or an arbitrary command surface. Related menus, switches, and shortcuts are also disabled.

## Network and analytics

This app's code does not include fetch, XHR, analytics, telemetry, or crash reporting. Apple Local Assist may use the bundled Apple Local Assist helper when the user enables it and the system supports it. In the Developer / GitHub lane, enabled Agent Workbench can launch an allowlisted provider. Explicit actions such as Show in Finder, print handoff, and Move to Trash may pass the selected path or a temporary file to macOS utilities.
