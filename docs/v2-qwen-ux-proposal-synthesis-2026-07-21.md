# v2 Qwen UX Proposal Synthesis (2026-07-21)

Status: Advisory planning input  
Scope: Distilled judgment on Qwen-generated UX review + design proposal for tree `2.0.0`  
Authority: Medium (does **not** override `current-work.md`, hard rails, or the 2026-07-18 review pool)  
Last reviewed: 2026-07-21

## Purpose

Local Drive notes from a Qwen-assisted review (2026-07-21) sketched a full UX
improvement program (P-1–P-11) with phased v2.1 / v2.2 / v2.3 design detail.
This document **extracts what is useful**, **corrects model mistakes**, and
**records product judgment** so future slices can cite one place instead of the
raw proposal pair.

- **Does:** triage themes; map to existing phases; name boundary alarms.
- **Does not:** adopt a rigid v2.1–v2.3 train; claim interactive UI review;
  change the active packaging gate; expand Safe Editor rails.
- **Queue of record remains:** `docs/current-work.md`.
- **Phase order remains:** `docs/roadmap.md`.
- **Sibling advisory pool:** `docs/v2-external-review-synthesis-2026-07-18.md`
  (four-agent synthesis). Prefer **both** pools when picking candidates; this
  file is UX-transfer focused, that file is broader (packaging + engineering).

Original private notes (local Drive; not in repo):

| Label | File (local) | Role |
|-------|--------------|------|
| Review | `qwen3.8_2.0rev.md` | Product / UX evaluation + P-1–P-11 sketch |
| Design pack | `qwen3.8_改善提案.md` | Planning + detailed design for P-1–P-7 (+ guidelines) |

Human direction when filing this synthesis: **do not swallow the pack whole**;
**L Mode appearance / mode-model parts looked mistaken**; organize as docs first.

---

## 1. Review provenance and claim hygiene

| Claim in the Qwen pack | How to treat it here |
|------------------------|----------------------|
| Based on GitHub README / docs / release notes | **Repo-document review**, not interactive app walkthrough. UX severity is hypothesis. |
| App Store / tree version facts in the pack | Align with `current-status.md` (MAS + tag **`2.0.0`** as of 2026-07-21). Do not let this file become a second release ledger. |
| “Tests = 106”, chunk-size as sole debt, etc. | **Stale-risk numbers.** Do not pin counts; re-measure if acting. |
| Success metrics (e.g. “mode back 30% ↓”) | **Aspirational only.** No product analytics lane; not acceptance gates. |
| Rigid Phase → `v2.1.0` / `v2.2.0` / `v2.3.0` | **Reject as schedule.** Map to Now / parked / v2.x / later / hygiene only. |
| ~45 engineer-days total | Rough; ignore for queue sizing. Prefer 1 verifiable slice. |

---

## 2. Corrections: mode model and L Mode

These corrections are the main reason not to implement P-1 “as designed.”

### 2.1 Modes are not five peer states

The pack treats **通常編集 / L Mode / Preview / 電子書籍 / Book Scope** as one
flat mode enum that needs a permanent pill.

Product model (canonical surfaces):

| Layer | Surfaces | Role |
|-------|----------|------|
| Writing surface | Normal edit, **L Mode (えるモード)** | Edit Markdown; L Mode is Live Source **presentation**, source stays truth |
| Read / view | Preview, e-book / whole-book Reader | Read-oriented; not a second document model |
| Multi-file book workspace | Book sidebar + scope tree | Explicit chapter set / order / read-export — **not** “another edit mode” |
| Assist / review | Local Assist, Diff, conflict, etc. | Explicit, low-prominence, non-auto-apply |

So “5 modes → one badge system” over-flattens layers that already have different
chrome, entry points, and trust notes. Prefer **layer-aware orientation** over
a single mode rainbow.

### 2.2 L Mode misconceptions in the pack

| Pack assumption | Correction |
|-----------------|------------|
| L Mode ≈ “WYSIWYG-tier” / preview-like writing | **Live Source**: decorations / calm layout; **Markdown source remains canonical**. Not Preview DOM editing, not `contenteditable`. See `docs/l-mode-plan.md`. |
| Normal vs L Mode differs mainly by typography | L Mode also **hides surrounding chrome** (tree, tabs, status noise) and brings the body forward. Typography is one part of a larger quiet surface. |
| Permanent colored mode pill + switch toast improves L Mode | Conflicts with L Mode’s **静けさ** and chrome reduction. A always-on badge under the tab bar is the opposite of “surrounding UI を隠す”. |
| Onboarding Step 2: write one line → **switch to Preview** to show value | That teaches **Preview**, not L Mode. L Mode value is *stay in one calm writing surface* while source stays Markdown. |
| P-8: magazine presets as early UX | Optional later polish under L Mode plan; not a fix for “mode confusion,” and not a theme marketplace. |

**Reframed need (if any):** when *not* in L Mode, make the **current primary
action layer** (書く / 読む / Book / 確かめる) already introduced in Theme A
easier to notice. Do **not** plaster L Mode with status chrome.

### 2.3 Related over-simplifications

- **Diff “6 kinds”** are different lifecycle events (disk, draft, conflict,
  recovery, AI candidate, file-vs-file), not six equal “tools” needing a Git-like
  center by default.
- **Book Scope complexity** is partly real for power users, but source already
  has UX quieting (settled list = read/edit primary; suggest/recheck progressive).
  Progressive disclosure should **extend quieting**, not reintroduce jargon UI.
- **Local Assist blank on unsupported Mac** is a real copy/expectation problem
  (also in the July 18 pool as X-9). That does **not** automatically justify a
  new static-lint product surface.

---

## 3. Consensus strengths the pack correctly praised

Keep these while polishing (aligns with July 18 §1):

- Safe Editor rails: no Git / LSP / general terminal / plugins / arbitrary exec
- Explicit operations: no auto-save, no auto-apply, no background indexing
- Local Assist: on-device, no network fallback, Diff then explicit apply
- App Store vs Developer lane separation
- Japanese-first copy; quiet writing bias
- Source-canonical Markdown

Do not trade these for “more visible” chrome or a permanent Compare sidebar that
reads like a VCS client.

---

## 4. Disposition of proposals (P-1–P-11)

Legend:

| Tag | Meaning |
|-----|---------|
| **Adopt-candidate** | Small, rail-safe; promote only when chosen as a slice |
| **Reframe** | Problem is real; proposed UI is wrong or oversized |
| **Hold** | Needs product decision; not free polish |
| **Reject / park** | Out of phase, boundary risk, or based on wrong model |

### 4.1 High-priority in the pack → judged

| ID | Pack title | Disposition | Judgment |
|----|------------|-------------|----------|
| **P-1** | Mode pill + toast + more shortcuts | **Reframe → Reject as designed** | Wrong mode model; fights L Mode quiet chrome. If orientation is weak after manual smoke, prefer existing purpose-led controls / Book-vs-Files clarity / Help — not a five-color pill. Optional micro-copy on first Book or Reader entry is enough. |
| **P-2a** | Assist unavailable: gray-out + reason | **Adopt-candidate** | Aligns with July 18 **X-9**. Small honesty win. No new engine. |
| **P-2b** | Rule-based “静的チェック” lint + click-apply | **Hold** | New assist-adjacent surface (inline lint, preferences matrix, apply path ≠ Diff). Local-only is good, but it is **not** “UX of existing Assist.” Requires explicit product accept vs `assist-surface-strategy.md`. Do not ship as silent Phase-1. |
| **P-3** | First-run 3-step welcome | **Reframe → Adopt-candidate (narrow)** | Aligns with July 18 **N-5**. Keep: one short, skippable, silence-safe sheet; “does not network / auto-save / run projects” as reassurance. Drop: L Mode→Preview demo; heavy Assist pitch on unsupported Mac. Prefer core loop **開く → 書く → 本として読む/出す**. Reuse Help “はじめに” if a second surface is enough. |

### 4.2 Mid-priority in the pack → judged

| ID | Pack title | Disposition | Judgment |
|----|------------|-------------|----------|
| **P-4** | Compare Center sidebar | **Reframe → Hold / mostly reject** | Discoverability of Diff kinds can improve without a permanent VCS-shaped panel. Prefer palette labels, conflict/recovery empty states, and shared Diff chrome. Explicit “Gitではない” is fine in Help; a dedicated Compare tree is high false-IDE risk. |
| **P-5** | Book progressive disclosure + 3-tap tutorial | **Reframe → partial Adopt-candidate** | Direction matches shipped quieting + design SoT. Continue **minimal settled Book UI**; fold advanced recheck/group into progressive reveal only if smoke shows overload. One-time quiet coach marks OK; multi-level “Power user default” settings bloat is not. |
| **P-6** | Export preflight preview + progress + Finder reveal | **Adopt-candidate (sliced)** | Preflight already exists; **progress + completion (Reveal in Finder)** are real UX if long exports. Avoid over-claiming “estimated page count” accuracy. Pair with export evidence work (July 18 **X-6**, packaging **N-2**). |
| **P-7** | Tree cap “他 N 件” indicator | **Adopt-candidate** | Low boundary risk; honesty about bounds. Do when large-folder friction is reproduced. |

### 4.3 Low-priority / later

| ID | Pack title | Disposition | Judgment |
|----|------------|-------------|----------|
| **P-8** | L Mode typography presets | **Park** | Optional under `l-mode-plan.md`; not mode-confusion fix. No theme marketplace. |
| **P-9** | Export cover/colophon templates | **Park** | Distribution polish after Book export quality is proven. |
| **P-10** | Shortcut cheat sheet + remapping | **Park / partial** | Cheat sheet may help; full remapping is a large settings surface — not next. |
| **P-11** | Vite chunk-size / lazy load | **Hygiene candidate** | Aligns with July 18 **E-16**. Measure first; no product narrative change. |

### 4.4 Shared design guidelines in the pack (Part 3)

| Guideline | Keep? |
|-----------|--------|
| Short motion (0.2–0.3s), respect `prefers-reduced-motion` | **Yes** when touching UI motion |
| Japanese copy: です/ます, reason with negatives, user as actor | **Yes** — already product tone |
| “Git” only in negative/clarifying context | **Yes** |
| Large new preference matrix for static checks / mode pill / compare center | **No** unless those features are explicitly accepted |
| Unified a11y for any *new* surface | **Yes** (keyboard, Escape, labels) — full matrix stays parked |

---

## 5. Extracted candidates for future queues

Not an execution order. Promote into `current-work.md` only as a chosen slice.

### 5.1 Near packaging / honesty (support human gate or residual)

| ID | Item | Overlap | Notes |
|----|------|---------|-------|
| Q-1 | **Local Assist availability honesty** (disabled + why; Preferences one-liner) | July 18 X-9 | No static-lint engine |
| Q-2 | **First 3 minutes story** (open folder → write → book read/export); skippable | July 18 N-5 | No Preview-as-L-Mode demo |
| Q-3 | **Export completion: progress + Reveal in Finder** | P-6 slice | Preflight already present |
| Q-4 | **Tree bound transparency** (“他 N 件” / shown count) | P-7 | When large dirs hurt |
| Q-5 | **Book empty-state one-liners** (app-private order; not OKF auto) | July 18 N-4, X-7 | Copy only |

### 5.2 v2.x product UX (after Alpha packaging)

| ID | Item | Overlap | Notes |
|----|------|---------|-------|
| Q-6 | **Book progressive depth** without re-jargoning | P-5 + quieting | Extend settled UI |
| Q-7 | **Export quality feedback loop** (preflight copy → what to fix) | July 18 X-6 | Not page-count theater |
| Q-8 | **Diff entry clarity** (palette / context menus / empty states) | P-4 reframed | No Compare Center sidebar by default |
| Q-9 | **Reader / chapter orientation** | July 18 X-2 | Real navigation > mode pills |

### 5.3 Explicit product decision required (not free polish)

| ID | Item | Why gated |
|----|------|-----------|
| Q-10 | **Static writing checks** (punctuation, length, notation pairs, heading skip) | New lint surface; apply model; prefs weight; Assist brand split |
| Q-11 | **Permanent multi-kind Compare panel** | IDE/Git silhouette risk |
| Q-12 | **Always-visible mode badge system** | Wrong mode model; L Mode chrome conflict |

### 5.4 Hygiene

| ID | Item | Overlap |
|----|------|---------|
| Q-13 | Bundle / lazy-load measurement for editor–preview split | July 18 E-16, P-11 |

---

## 6. Cross-walk

| Existing SoT | How this file relates |
|--------------|------------------------|
| `current-work.md` | Active queue unchanged. Q-items are **not** automatic next work. |
| `roadmap.md` | Packaging gate → v2.x practicalization → 縦書き later. Map Q-1–Q-5 near honesty/gate; Q-6–Q-9 to v2.x; Q-10–Q-12 only after product accept. |
| `v2-external-review-synthesis-2026-07-18.md` | Prefer packaging/engineering consensus there; use this file for Qwen UX transfer judgment. |
| `l-mode-plan.md` | Overrides Qwen L Mode visual model. |
| `assist-surface-strategy.md` | Gates Q-10 static checks and any Assist-adjacent expansion. |
| `security-boundary.md` | Still required before path / AI / multi-file rewrite work. |
| Book design SoT | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` — progressive disclosure must not break explicit scope / no background index. |

---

## 7. Avoid list (from this pack specifically)

Do **not** enter the main lane without an explicit product redefinition:

- Five-color always-on **mode pills** and switch toasts as default chrome
- Teaching L Mode via **Preview switch** demos
- **Static lint product** framed as “Assist unavailable fallback” without separate accept
- **Compare Center** that looks like a mini Git client
- Rigid **v2.1 / v2.2 / v2.3** trains driven by this pack
- Analytics-style **conversion KPIs** as acceptance criteria
- Expanding preferences for features not yet accepted
- Claiming the Qwen pack was validated on interactive UI

---

## 8. Suggested issue-sized titles (optional)

For humans cutting tickets later (not an auto-backlog):

1. Local Assist: unavailable state copy + Preferences status (no static lint)
2. First-run: skippable open→write→book loop (Help or one sheet)
3. Export: progress + Reveal in Finder after whole-book PDF/EPUB
4. Workspace tree: bound “他 N 件” honesty when capped
5. Book empty state: app-private order + not-OKF one-liners
6. (Decision) Static writing checks — accept / reject / park with criteria
7. Diff discoverability via palette and empty states — not a Compare sidebar

---

## 9. How agents should use this file

1. Read `current-work.md` first for the **active** next slice.
2. Treat this file as **triage notes**, not a second roadmap.
3. If an item touches L Mode visuals, re-read `l-mode-plan.md` and §2 here
   before designing chrome.
4. If an item adds Assist-like behavior without Diff, re-read
   `assist-surface-strategy.md` and stop for human accept.
5. Prefer overlap with the July 18 consensus (N-*, X-*, E-*) when both pools
   agree — those survived multi-review.
6. After adopting an item, update `current-work.md` / status; do not grow this
   file into an implementation log.

---

## 10. Out of scope for this synthesis

- Implementing any P-* design from the Drive pack
- Changing App Store / tag / published version claims
- Archiving or deleting the private Drive originals
- Re-scoring the product (★ ratings in the review are ignored)

When packaging for `2.0.0` closes or a Q-item is accepted into the active queue,
refresh `Last reviewed` and add a short “Adopted / declined” note if useful.
