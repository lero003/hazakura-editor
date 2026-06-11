# Open Source Acknowledgements

Hazakura Editor is built with open source software. This page is a readable acknowledgement for the app. It is not a complete legal license packet.

## JavaScript and UI

Primary direct JavaScript dependencies include:

- React and React DOM, MIT License
- CodeMirror packages, MIT License
- DOMPurify, MPL-2.0 or Apache-2.0
- marked, MIT License
- xterm.js and addon-fit, MIT License
- Tauri JavaScript API and dialog plugin, MIT or Apache-2.0

Development tooling includes Vite, TypeScript, Vitest, jsdom, Testing Library, and related build tools.

## Native app stack

Primary direct Rust and native app dependencies include:

- Tauri, MIT or Apache-2.0
- tauri-plugin-dialog, MIT or Apache-2.0
- serde and serde_json, MIT or Apache-2.0
- encoding_rs, MIT or Apache-2.0

The macOS app also uses platform APIs provided by Apple and the operating system.

## License scope

The full dependency set is tracked in `package-lock.json` and `src-tauri/Cargo.lock`. Before public submission, regenerate or review the complete third-party license packet from the current lockfiles.
