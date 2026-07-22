# Books and knowledge folders

Use ordinary Markdown files. When you want several of them to act as one book, or to check a knowledge-folder layout, use the steps below. Nothing runs until you ask.

## Book tab

Open a workspace, then switch the sidebar from **Files** to **Book**.

- **Choose chapters** selects Markdown files and saves an ordered tree private to this app. Disk files and folders are not rearranged.
- After you save a scope, the list is for opening chapters and reading. **Read all** opens a read-only whole-book scroll view in that order. The reader shows the current chapter, previous/next chapter controls, and an in-memory search of already loaded chapter names and visible Markdown (no background index).
- **Edit** changes membership or order. Arrow moves stay inside the current group; they do not silently move a chapter into another work or section. Setup actions stay there, not on the everyday list.
- Unavailable chapters stay listed until you recheck or remove them. The app does not drop them silently.
- The saved book tree is kept only in app-private settings for up to eight workspace roots. It is not written into the project folder. Saving a tree for another workspace may drop the oldest saved entry to keep storage small.

Each chapter is still a normal Markdown file. Only one primary edit buffer is active at a time.

## Suggest from workspace

From an empty Book view, or while editing chapters, **Suggest from workspace** can propose a draft from the open workspace.

- Root `index.md` internal links, when they resolve safely, shape the proposed tree. Linked nested `index.md` files expand their local chapter links in place, and index section headings become quiet Book groups.
- Relative links and bundle-root links beginning with `/` are interpreted by the current OKF input adapter. The saved Book tree itself does not store an OKF version, so later OKF changes do not redefine an already saved book silently.
- **Include index.md as cover / contents pages** is on by default. With it on, the root index and each linked nested index are included immediately before their local chapters. Turn the option off and regenerate for a body-only draft, or uncheck any individual index in the draft.
- Remaining readable `.md` files follow in a stable path order. Support files such as `log.md` stay out of the suggestion.
- The result is a checkbox draft. Nothing is saved until you press **Save**.
- A suggestion is a Hazakura book order, not a claim that the folder is OKF-compliant.

The scan is one-shot, bounded, and cancellable. It does not start on app launch and does not keep a background index.

## Knowledge folder (OKF)

OKF (Open Knowledge Format) v0.1 Draft is a way to lay out linked Markdown notes. Hazakura can **check** or **start** that layout; it does not auto-repair it.

- **Review knowledge folder (OKF)** (Command Palette or folder context menu) runs an explicit, read-only check of the selected folder.
- Findings are grouped so ordinary manuscript folders stay writable as-is. Preparing as OKF is optional.
- **Open to edit** opens a file in the normal editor. After you save, run review again yourself.
- **Create knowledge folder starter** writes a fixed minimal or book-like template into a new uniquely named folder and opens `index.md`. The chapter layout in the book-like template is an example only; it is not the Book chapter list.

## Export whole book

PDF and EPUB export can use **Current file** or **Whole book**.

- Whole book follows the saved Book tree in reading order and prefers open unsaved tabs over disk for those files. EPUB uses the same saved groups for its table of contents.
- A short preflight runs only when you start export. Missing chapters block whole-book export; heading or metadata gaps are warnings with a short fix hint you can still decide on.
- After a successful PDF, EPUB, or HTML export, the finished file is revealed in Finder so long exports do not end only as a status path.
- Source Markdown is not rewritten by export.

## Boundaries

- No background workspace indexing, no silent multi-file rewrite, no automatic structure “fix.”
- Book order is app-private interpretation for up to eight workspaces only. OKF review is a separate compatibility check.
- The App Store lane stays a Safe Editor surface: no Agent Workbench, no arbitrary command execution, no external AI network fallback for Local Assist.
