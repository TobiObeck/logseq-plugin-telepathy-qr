# Spec: Export Scope (focused bullet · selected bullets · bullet + children)

**Status**: iteration 1 implemented and partly trialed in real Logseq. Confirmed: dot
right-click shows the block-menu item and selects the block plus children (SQ21 accepted);
the subtree export is correct, so `getBlock` children are entities (decision 5). Still
open: zoom route shape (decision 1, now exercised by the shortcut), selection order and
dedupe with multi-select (decision 4). Iteration 2 shortcut shipped alongside.
**Parent**: DESIGN.md §11, NTH #7/#8/#9 (merged into one spec by decision)
**Decisions**: grilling session 2; logged as `(SQn)` in §11 below to avoid
clashing with DESIGN.md's `(Qn)` numbering.

---

## 1. Goal

Export *less than a whole page*. Three entry paths share one pipeline:

1. **Focused bullet** — Logseq's zoom view (click a bullet dot → only that block
   and its descendants are visible): export exactly what's on screen. (SQ3)
2. **Selected bullets** — Logseq's blue multi-block selection: export the
   selected blocks with their subtrees. (SQ4)
3. **Bullet + children** — right-click a single bullet: export that block and
   its subtree. Absorbed into #2 by a host-behavior fact: right-clicking a
   bullet in Logseq selects it *and its children* in blue, so one context-menu
   entry covers both. (SQ10, SQ20)

The export *mechanics* (options, transform, pagination, QR wizard) are
unchanged — this spec only changes **what text enters the pipeline** and how
the modal **labels** it.

## 2. Host-API research facts (basis for the design)

- `logseq.Editor.registerHighlightContextMenuItem` is **PDF-viewer-only**
  (docstring in `@logseq/libs` source: *"Current it's only available for pdf
  viewer"*; official commands guide: "Register a **PDF** highlight context
  menu item"). It never appears for blue block selections → not used. (SQ17)
- `logseq.Editor.registerBlockContextMenuItem(label, cb)` adds an item to the
  block right-click menu ("triggered by right-clicking the block dot"); `cb`
  receives `{ uuid }`. This is the primary plumbing.
- `logseq.Editor.getSelectedBlocks(): Promise<BlockEntity[] | null>` and
  `clearSelectedBlocks()` exist; `getBlock(uuid, { includeChildren: true })`
  returns the subtree.
- **Zoom view** (legacy 0.10.x frontend): zooming calls `redirect-to-page!`
  with the block's **uuid** → route becomes `#/page/<block-uuid>`.
  `logseq.App.onRouteChanged` delivers `{path, template}` (runtime forwards
  more fields). No typed zoom API exists. (SQ19)

All of this is **trial-gated**: the dev probe (§4) verifies it against the
user's actual Logseq before iteration 1 is built, like the SVG-label trial
(DESIGN.md Q29).

## 3. User-facing behavior

### 3.1 Entry points

| Entry | Scope | Notes |
|---|---|---|
| Page menu "📱 Export page as QR code" | **always full page** | unchanged, never zoom-aware (SQ9, SQ14) |
| Block context menu "📱 Export selected bullet(s) as QR code" *(new)* | right-clicked block + children; scope `focused`, label "This bullet" (a bullet right-click replaces any blue selection, SQ15, SQ20, SQ23, SQ24) | static `(s)` label; dynamic singular/plural is NTH (SQ10) |
| Page menu "⚫ Export focused bullet as QR code" | **removed (SQ22)** — the page menu is not shown in zoom view, so the entry was unreachable where it mattered. Focused export is the shortcut's zoom branch (below) and the block context menu on the zoomed bullet. |
| `Ctrl+Shift+Q` quick export | **context-aware (iteration 2, shipped with iteration 1 per SQ22):** selection > zoom > page (SQ7, SQ8, SQ18) | scoped quick exports land directly on the QR stage with saved options; unscoped (whole page) behaves as before |

All entries keep the existing DB-graph guard toast. All scoped entries open at
the **Config stage** in iteration 1 (no direct-to-QR for new entries until the
context-aware shortcut lands in iteration 2). (SQ6, SQ7)

### 3.2 Scope resolution (context-menu callback)

```
cb({uuid}):                              # SQ23: a bullet right-click replaces any selection
  block = await getBlock(uuid, {includeChildren: true})
  sourceText = render([block])
  scope = 'focused'                      # SQ24: label "This bullet"
  if sourceText empty/degenerate → toast "TelepathyQR: nothing to export.", no modal
  else → open Config stage with {sourceText, scope, rootCount: 1}
```

The blue-selection branch (`getSelectedBlocks()` non-empty → `dedupe`) is still used by
the shortcut (§6), where no right-click happens and multi-selection can persist.


### 3.3 Modal labels (scope provenance)

The Config stage's input preview toggle second segment becomes scope-aware
(SQ6, SQ12); the `Example` half never changes:

| Scope | Toggle label |
|---|---|
| `page` | "This page" (unchanged) |
| `focused` | "This bullet" |
| `selection` | "Selection (n)" — n = number of rendered roots, not blocks |

No scope picker anywhere — the entry point fixes the scope (SQ6).

### 3.4 Selection state

The plugin **never clears the blue selection** — not on export, not on modal
close. Seeing the highlight through the semi-transparent backdrop is the
user's confirmation that the right blocks were captured; Logseq clears it
naturally on the next interaction. (SQ11, SQ16)

## 4. Iteration 0: live trial (probe)

Dev-only module `src/platform/logseq/probe.ts` (registered from `main.tsx`
behind `import.meta.env.DEV`; never ships). It provides:

- automatic `[TQ-PROBE] onRouteChanged → …` logs for every navigation;
- page-menu item **"(Dev) TQ probe: dump state"** — logs cached route,
  `parent.location.hash`, parent-DOM probes (`.ls-block.selected` count +
  blockids, `[class*=zoom|breadcrumb]` hits, first blockids under
  `#main-content-container`), `getCurrentPage()`, `checkEditing()`,
  `getSelectedBlocks()` summaries;
- block-context-menu item **"(Dev) TQ probe block"** — logs callback uuid,
  `getSelectedBlocks()`, and `getBlock(uuid, {includeChildren: true})` shape
  (children array? entities or tuples? `original` present?);
- highlight-context-menu item **"(Dev) TQ probe highlight"** — expected to
  fire only in the PDF viewer; if it fires for block selections, §2 is wrong
  for this host.

**Scenario checklist** (also in the probe file header): normal page dump ·
zoom-in dump · zoom-out dump · block-ref click dump · right-click on blue
selection · right-click on bullet dot (does it auto-select subtree?) ·
right-click on plain content · text selection right-click · PDF highlight
right-click.

**Decision points resolved by the trial:**

1. Does the zoomed route really read `/page/<uuid>` in this Logseq version?
   If yes → route-cache detection (§5.1) ships as-is. If no → fall back to
   the parent-DOM probe; if that's also unreliable, the ⚫ entry is
   re-designed (escalate to a grill round).
2. Does the block context menu (with plugin items) appear when right-clicking
   *the blue selection area*, or only on the bullet dot? Pre-approved: dot
   right-click is an acceptable shipped UX either way. (SQ21)
3. Does right-clicking a bullet dot auto-select it + children (user reports
   yes)? Determines whether the §3.2 fallback branch ever runs.
4. `getSelectedBlocks()` return order (document order?) and whether children
   of a selected parent appear as separate entries → pins the dedupe/order
   implementation (§5.3).
5. `getBlock(includeChildren)` children shape (entities vs `[id, uuid, order]`
   tuples; `original` present on children?) → pins the subtree renderer input.
6. `getCurrentPage()` while zoomed — page entity, uuid-named, or null?

**Trial results (2026-10-22, real Logseq, prod-equivalent behaviour verified by the user):**

- 1 ✅ Zoomed route is `/page/<uuid>` (`onRouteChanged` payload `path`); zoom-out returns `/page/<name>`. Route-cache detection ships as-is. The shortcut zoom branch works.
- 2 ✅ Block-menu item appears on the bullet dot only (SQ21 accepted).
- 3 ✅ Dot right-click selects the bullet and its children, which replaces any previous selection (SQ23). Note: `getSelectedBlocks()` returned `null` inside the block-menu callback, so the entry no longer reads it.
- 4 ⏳ Multi-block selection order/dedupe: not yet exercised (only reachable via the shortcut with a shift-click selection).
- 5 ✅ `getBlock(includeChildren)` children are entities (`uuid`, `content`, `children`, …); `original` is `undefined`, so the renderer falls back to `content`.
- 6 ⚪ Not needed: the zoom branch of the shortcut runs before the page branch, so `getCurrentPage()` is not consulted while zoomed.

## 5. Technical design

### 5.1 Zoom detection (`src/platform/logseq/zoom.ts`, new)

- Subscribe `logseq.App.onRouteChanged` at plugin load; cache the latest
  payload.
- `getZoomedBlockUuid(): string | null` — zoomed ⇔ cached route path matches
  `/page/<uuid-shaped>` (UUID regex; pure, unit-testable parse).
- On-demand cross-check for the window between plugin load and the first
  route event: parse `window.parent.location.hash` (try/catch — probe
  confirms access), else DOM probe per trial results.
- ⚫ entry: uuid → `getBlock(uuid, {includeChildren: true})` → render (§5.2);
  null block (deleted between zoom and click) → error toast.

### 5.2 Subtree renderer (`src/platform/logseq/readPage.ts`, extended)

Reuse the existing `renderBlocks` walk (2-space indent per level, `original`
preferred over `content`, markers kept, `collapsed:: true` kept, fences
untouched) **rebased**: a root block renders at level 0 regardless of its
depth in the page. New exports:

- `readBlockSubtree(uuid): Promise<string>` — zoom path and single-block path.
- `readSelection(uuids | blocks): Promise<string>` — multi-root path: fetch
  each root with `includeChildren`, drop roots that are descendants of other
  selected roots, render survivors in document order, join with `\n`.

### 5.3 Dedupe & order (pure logic in `src/core/`, unit-tested)

Given selected blocks (each `{uuid, id?, parentId?}` + fetched subtrees):
a root is dropped when any ancestor (walking `parent` ids within the selected
set) is also selected. Document order = the order `getSelectedBlocks()`
returns (trial-confirmed; if the host order is unreliable, sort by
`order`/position fields). Parent+two-children selection therefore renders the
parent's subtree **once** — which is exactly "the three bullets". (SQ4, SQ11)

### 5.4 Store changes (`src/core/store.ts`)

- New `ExportScope = 'page' | 'focused' | 'selection'` and `scopeRoots: number`
  in the config/session slice; `open` and (iteration 2) `quickOpen` events
  carry `{ scope, scopeRoots }` (default `'page'`, roots 1).
- `close`/`back` semantics unchanged; scope is session data, not persisted to
  localStorage (saved config = options + previewSource only, unchanged).
- ConfigStage derives the toggle label: `scope === 'page' ? 'This page' :
  scope === 'focused' ? 'This bullet' : \`Selection (${scopeRoots})\``.

### 5.5 Host interface

Unchanged — `sourceText` remains a flat markdown string; scope travels
through store events, not the Host. (Keeps `core`/`ui` free of Logseq types.)

## 6. Iterations & gates (SQ13, SQ18)

- **Iteration 0** — probe (§4). ✅ code shipped; awaiting user's log
  pastes → decisions 1–6.
- **Iteration 1** — ✅ implemented: block-context-menu entry, ⚫ page-menu entry +
  zoom detection (`zoom.ts`), subtree renderer + dedupe (`readPage.ts`,
  `core/scope.ts`), store scope + preview labels, toasts, unit tests.
- **Human manual-check gate** — user verifies all entries in real Logseq.
- **Iteration 2** — context-aware `Ctrl+Shift+Q`: resolve selection > zoom >
  page at fire time; scoped quick exports `quickOpen` straight to the QR
  stage with saved options; unscoped behaves exactly as today.

## 7. Edge cases

| Case | Behavior |
|---|---|
| ⚫ entry while not zoomed | warning toast, nothing opens |
| Zoomed block deleted before export | error toast ("could not read the block") |
| Context menu fires, `getSelectedBlocks()` null/empty | fallback: right-clicked uuid + children (§3.2) |
| Both paths yield no blocks | toast "TelepathyQR: nothing to export.", no modal |
| Scoped export transforms to empty text | existing "Export is empty — check your options" hint |
| DB graph | existing guard toast on every entry |
| Selection spanning sidebar / another page | export as selected (open item §8) |
| Collapsed descendants in scope | included; `collapsed:: true` kept by renderer (existing behavior) |
| Zoom + blue selection simultaneously | ⚫ entry: zoom (by definition). Shortcut (iter 2): selection wins (SQ8) |

## 8. Open — resolve during implementation, escalate if roadblock (SQ5, SQ21)

- **org-format blocks**: expected handling = render verbatim (no new guard);
  confirm against trial fixtures.
- **Cross-page / sidebar selections**: expected handling = export whatever is
  selected regardless of page.
- **Property lines of root blocks**: part of `original`/properties today →
  included; confirm nothing duplicates them.
- **Blue-area right-click reach**: whether plugin block-context items appear
  on the selection's context menu or only the dot menu (trial #2; dot-only is
  pre-approved as sufficient).
- **`getSelectedBlocks()` child entries**: whether Logseq returns descendants
  as separate entries when a parent is selected (affects dedupe input only —
  the algorithm handles both).

## 9. Test plan (Vitest, no E2E — DESIGN.md §10)

- **Renderer**: subtree rebased to level 0; nested markers/collapsed/fences
  preserved; multi-root join; `original`-over-`content` preference holds.
- **Dedupe/order** (pure core fn): parent+child → parent once; disjoint roots
  in document order; single root passthrough.
- **Zoom route parse** (pure fn): uuid-shaped `/page/…` → uuid; normal page
  name → null; journal routes → null.
- **Store**: `open` with scope → provenance fields set; defaults to
  `'page'`; label mapping; `close` resets scope.
- **Boundary guard** unchanged (platform-only code in `zoom.ts`/`readPage.ts`).
- Trial outcomes become fixtures: captured `getBlock(includeChildren)` JSON
  via the existing "(Dev) Copy block tree JSON" pattern (extend if needed).

## 10. Files changed (planned)

| File | Change |
|---|---|
| `src/platform/logseq/probe.ts` | ✅ new (iteration 0, dev-only) |
| `src/platform/logseq/main.tsx` | ✅ probe wiring; ✅ block-context-menu entry; ✅ context-aware shortcut |
| `src/platform/logseq/zoom.ts` | new: route cache + `getZoomedBlockUuid` |
| `src/platform/logseq/readPage.ts` | subtree/selection readers |
| `src/core/scope.ts` | new: `ExportScope`, dedupe/order, route-uuid parse |
| `src/core/store.ts` (+ tests) | scope provenance on `open`/`quickOpen` |
| `src/ui/ConfigStage.tsx` | scope-aware preview toggle label |
| `DESIGN.md` | §11 items 7–9 → spec'd; far-future note (§12 below) |

## 11. Decision log (grilling session 2)

| SQ | Decision |
|---|---|
| 1 | localStorage settings already solved (NTH #1); far-future: custom `\|\|marked\|\|` prefix/suffix inputs → DESIGN.md §11 tail |
| 2 | One combined spec for the three selection features |
| 3 | "Focused bullet" = Logseq zoom view (bullet-dot click); menu + shortcut export the zoomed subtree |
| 4 | Selection export = selected blocks with subtrees, as highlighted |
| 5 | Rendering edge cases deferred to implementation (§8) |
| 6 | Entry point fixes scope; modal only labels it; no scope picker |
| 7 | Quick export becomes context-aware in a **later iteration** after manual checking |
| 8 | Precedence: selection > zoom > page (shortcut; ⚫ entry is zoom by definition) |
| 9 | Second page-menu entry "⚫ Export focused bullet as QR code"; 📱 entry stays always-full-page |
| 10 | One context-menu entry suffices — right-clicking a bullet selects it + children in blue; dynamic singular/plural label = NTH |
| 11 | Don't clear selection during export; empty/degenerate → toast feedback |
| 12 | Preview toggle labels: "This page" / "This bullet" / "Selection (n)" |
| 13/18 | Phasing: iteration 1 = entries + renderer + labels; gate; iteration 2 = context-aware shortcut |
| 14 | ⚫ entry: zoomed → Config stage scoped; not zoomed → toast; exact label text confirmed |
| 15 | Selection entry label: "📱 Export selected bullet(s) as QR code" |
| 16 | Never clear the selection (not even on modal close) |
| 17 | Block-context-menu plumbing pre-approved — became primary (highlight menu is PDF-only) |
| 19 | Zoom detection: route cache + on-demand probe, trial-gated; user runs probe and pastes logs |
| 20 | Scope resolution: `getSelectedBlocks()` non-empty → selection; else `getBlock(uuid, includeChildren)` |
| 21 | Menu reach: try in real Logseq; dot right-click acceptable if blue-area menu lacks plugin items |
| 22 | Trial result: block-menu item is dot-only (blue-area right-click lacks it; accepted per SQ21). Page-menu ⚫ entry removed — unreachable in zoom view. Focused export moved to the Ctrl+Shift+Q zoom branch, which ships now (iteration 2 pulled forward at the user's request). |
| 23 | Trial result: a bullet right-click replaces the blue selection with that bullet + children. The block-menu entry therefore always exports the clicked block; the blue-selection branch is dropped. Multi-selection export is reachable only via the shortcut. |
| 24 | User decision: the block-menu export uses the `focused` scope, so its preview label reads "This bullet" (not "Selection (1)"). |
| 25 | Trial result: `getBlock` children carry `content` but no `original`; the renderer falls back to `content`. |
| 26 | Not possible via the official API: right-click on blue selected text (block menu is dot-only; highlight menu is PDF-only). Covered by `Ctrl+Shift+Q` and the palette command "Export selection". |
| 27 | Not possible in zoom view: plugin page-menu items are not shown there. Covered by `Ctrl+Shift+Q` and the palette command "Export focused bullet" (`registerCommandPalette`, works in zoom view). |
| 28 | Open: Clean already drops internal keys (`id`, `collapsed`, `background-color`, `custom_id`, `macro_id`, `hl-*`, `card-*`). Collapse markers matter only in Raw; whether raw scoped exports can carry them depends on the collapse probe (probe item 10). |
| 29 | Decision A: no new option for Logseq-only markers. Clean removes them, Raw keeps everything. Known flaw (C): Clean still passes `SCHEDULED:` / `DEADLINE:` lines and `:LOGBOOK:` drawers through; fix by extending the Clean ruleset, not by adding an option. Documented in DESIGN.md §4.1a. |
| 30 | Refs and embeds resolve two levels deep, hard-coded (`REF_DEPTH = 2`). `refs: resolve` is enabled and is the default; saved configs keep their saved `refs` value. Interpretation: "block embed & page refs" = `{{embed ((uuid))}}`, `{{embed [[Page]]}}`, and bare `((uuid))`. Plain `[[page]]` links remain governed by the wiki-links option. |
| 31 | Empty exports never reach the QR stage. The entry points toast "nothing to export" for an empty source. The Config stage disables Generate with "Export is empty — check your options" when the chosen options produce nothing. The store encodes no parts for empty output. |

## 12. NTH & far-future bookings from this session

- **NTH — dynamic singular/plural** context-menu label ("Export selected
  bullet / bullets as QR code") if the legacy API ever supports per-invocation
  labels. (SQ10)
- **Far future — custom marker replacements**: generalize the `||marked||`
  mode into user-configurable *replace prefix* / *replace suffix* input fields
  (opinionated settings), persisted like other options. (SQ1; also book in
  DESIGN.md §11)
