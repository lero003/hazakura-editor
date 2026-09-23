# Privacy Policy

This Privacy Policy describes how Hazakura Editor handles data in the App Store version of the app. It focuses on the app's own behavior. It does not describe what macOS, Apple services, or files opened in other apps may do.

## Overview

Hazakura Editor is a local Markdown and text editor for macOS. The app is designed to open, edit, preview, compare, and save files that you choose.

## Files you choose

Hazakura Editor reads and writes files or folders you select through the app UI. It does not scan your home directory automatically, does not index a project in the background, and does not upload document contents.

## Local data

Hazakura Editor stores local preferences such as theme, tab state, editor settings, recent folders, and optional recovery and backup data on this Mac or inside the workspace you choose.

## Hazakura Local Assist

Hazakura Local Assist is an optional on-device writing companion. You can choose the Apple Intelligence system model, explicitly download the listed Gemma 4 12B Core AI model, or add a compatible Core AI resource folder from this Mac. A model must be available and pass the app's checks before you can use it. The Apple Intelligence model requires Apple Intelligence to be enabled; a compatible Core AI model can work while Apple Intelligence is turned off on a supported Apple silicon Mac running macOS 27 or later. Downloading or adding a model does not enable Local Assist or select that model for you. The app does not send your document or Local Assist requests to external AI services. You review each proposal and explicitly apply it in the main window; applied text remains unsaved until you save it.

## Network, analytics, and cloud services

The App Store version of Hazakura Editor does not include external AI calls, analytics, telemetry, third-party crash reporting, or cloud sync.

Remote images in Markdown preview are off by default. If you explicitly enable remote images, the app may make bounded HTTPS requests to image hosts. Local images outside the workspace follow a separate local-image permission setting. These image permissions do not enable external AI calls or an AI network fallback.

Explicitly downloading or updating the listed Core AI model uses Apple's asset-hosting service. Model acquisition is separate from inference: generation stays on-device after installation. You can select a compatible Core AI resource folder through the macOS folder picker; its files stay in that folder, and removing its registration does not delete them. Hazakura Editor does not download arbitrary model URLs or import standalone model packages or unsupported model formats.

Explicit user actions, such as printing, showing a file in Finder, or moving a file to Trash, may hand selected paths or temporary files to macOS system services.

## Contact

For support or privacy questions, please contact:

support@hazakura.dev

Support page: https://hazakura.dev/hazakura-editor/support/

Include only the information you choose to share.
