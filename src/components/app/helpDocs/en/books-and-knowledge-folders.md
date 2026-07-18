# Books and knowledge folders

Use ordinary Markdown files. When you want several of them to act as one book, or to check a knowledge-folder layout, use the steps below. Nothing runs until you ask.

## Book tab

Open a workspace, then switch the sidebar from **Files** to **Book**.

- **Choose chapters** selects Markdown files and saves an order private to this app. Disk files and folders are not rearranged.
- After you save a scope, the list is for opening chapters and reading. **Read all** opens a read-only whole-book scroll view in that order.
- **Edit** changes membership or order. Setup actions stay there, not on the everyday list.
- Unavailable chapters stay listed until you recheck or remove them. The app does not drop them silently.

Each chapter is still a normal Markdown file. Only one primary edit buffer is active at a time.

## Suggest from workspace

From an empty Book view, or while editing chapters, **Suggest** can propose a draft from the open workspace.

- Root `index.md` internal links, when they resolve safely, come first.
- Other readable `.md` files follow in a stable path order. Support files such as `index.md` and `log.md` are left out of the chapter list.
- The result is a checkbox draft. Nothing is saved until you press **Save**.
- A suggestion is a Hazakura book order, not a claim that the folder is OKF-compliant.

The scan is one-shot, bounded, and cancellable. It does not start on app launch and does not keep a background index.

## Knowledge folder (OKF)

OKF (Open Knowledge Format) v0.1 Draft is a way to lay out linked Markdown notes. Hazakura can **check** or **start** that layout; it does not auto-repair it.

- **Review knowledge folder (OKF)** (Command Palette or folder context menu) runs an explicit, read-only check of the selected folder.
- Findings are grouped so ordinary manuscript folders stay writable as-is. Preparing as OKF is optional.
- **Open to edit** opens a file in the normal editor. After you save, run review again yourself.
- **Create knowledge folder starter** writes a fixed minimal or book-like template into a new uniquely named folder and opens `index.md`. The chapter layout in the book-like template is an example only; it is not Book scope.

## Export whole book

PDF and EPUB export can use **Current file** or **Whole book**.

- Whole book follows the saved Book order and prefers open unsaved tabs over disk for those files.
- A short preflight runs only when you start export. Missing chapters block whole-book export; heading or metadata gaps are warnings you can still decide on.
- Source Markdown is not rewritten by export.

## Boundaries

- No background workspace indexing, no silent multi-file rewrite, no automatic structure “fix.”
- Book order is app-private interpretation. OKF review is a separate compatibility check.
- The App Store lane stays a Safe Editor surface: no Agent Workbench, no arbitrary commands, no external AI network fallback for Local Assist.
