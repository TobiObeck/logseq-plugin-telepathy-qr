# TelepathyQR — Design Document

Status: **agreed in grilling session (Q1–Q40), signed off; implementation in progress.**
This document is the single source of truth for the v1 rework. Decisions are referenced as `(Qn)`.
React components subscribe to the store with `useSelector` from `@xstate/store-react`.

---

## 1. Overview & v1 scope

TelepathyQR exports a Logseq page as a sequence of QR codes scannable by another device.
v1 reworks the plugin into a production-ready, two-stage wizard modal with configurable
export flavors, preview panes, a platform-agnostic core, and a real test suite.

In v1 scope:

- Page-menu entry as the **only** entry point; the always-visible toolbar icon is **removed** (Q1).
  - Label gets the QR glyph as inline SVG/HTML in one trial; if Logseq escapes HTML in page-menu
    labels (verified live against a running Logseq), fall back to the current `📱` prefix (Q29).
- Two-stage modal wizard: **Config stage** → **QR stage** (Q34–Q38).
- Export options: flavor, wiki links, images, tasks, external links, refs/embeds strip (Q3–Q6, Q11, Q17, Q19, Q20, Q27, Q33).
- Previews: config-stage example/real-page columns; QR-stage Text/Rendered tabs (Q23, Q36, Q37, Q39, Q40).
- Vitest test suite with real-world fixtures; **no E2E** (Q8, Q21, Q26).
- Three-layer architecture with an enforced Logseq boundary (Q28).
- No `useSettingsSchema` in v1; defaults are code constants (Q15, Q22).

Explicitly **not** in v1 (see §11): quick export + saved defaults, resolving refs/embeds,
user-property rewriting, indent-width option, EC-level exposure, Obsidian/Roam ports.

---

## 2. UX flow

### 2.1 Entry

- One page-menu entry: "Export page as QR code" (+ icon trial, §1).
- On activation: guard DB graphs with a warning toast (existing behavior); read the page's raw
  source text; open the modal at the **Config stage**.

### 2.2 Config stage (wizard step 1)

Layout, top to bottom (Q35):

1. **Option rows** (§3): Flavor row, then the nested Clean sub-settings (greyed out when Raw),
   including the refs/embeds row with its greyed Resolve option.
2. **Preview source toggle**: segmented `Example | This page`, default `Example` (Q40).
3. **Two scrollable panels stacked vertically** (input on top, output below), monospace,
   with **synchronized scrolling**: scrolling either panel scrolls the other by the same
   amount. The input is the static example snippet or the real page's raw source; the
   output is the transformed text for the current options, recomputed live on every
   option change (transform is sub-millisecond string work; no debounce).
4. Bottom-right: primary button **"Generate QR Code(s)"**; shows "Generating…" while part 1
   encodes (~35 ms), then navigates to the QR stage (Q38).
5. Top-right: X close (closes the whole modal).

The static example is a hand-authored constant exercising every transform feature once:
nested bullets, `TODO`/`DONE`, `[#A]` priority, `[[Wiki Link]]`, `[label]([[Page]])`,
external md link, bare `https://` URL, `file:///` link, image with and without alt,
`((block-ref))`, `{{embed [[Page]]}}`, internal props (`id::`, `collapsed::`), a user prop
(`author::`), and a fenced code block containing `[[not-a-link]]` and `id::` (Q36).

### 2.3 QR stage (wizard step 2)

- Segmented tabs at the top of the card: `QR | Text | Rendered` (Q23, Q37).
- **QR tab**: centered card on a dark semi-transparent backdrop; QR as large as fits while the
  card stays minimal; bottom flex row `prev | k / N (centered) | next`; top-right X close
  (Q2, Q34). The nav row is visible on **all three tabs**, with spelled-out labels; on page 1
  the left button reads "← Back to config" and returns to the Config stage (post-sign-off
  adjustment; it replaces the earlier top-left "← Options" button).
- **Text tab**: exactly the string encoded in the currently displayed QR code (part `k`),
  scrollable monospace; updates in lockstep with pagination (Q39).
- **Rendered tab**: the same part string rendered through the unified pipeline (§5).
- Keyboard: `←`/`→` paginate (QR stage only; no-op while Next is disabled); `Esc` closes the
  modal from either stage; backdrop click closes (Q2, Q34). **Prev on page 1 returns to the
  Config stage**, mirroring "← Options".
- Both stages respect a max card size with internal scrolling (Q23, Q35). The card has a
  FIXED width and height across stages and tabs, so no click ever moves the modal out from
  under the mouse (post-sign-off adjustment 3).
- Styling: Bulma plus `src/ui/styles.css`, both imported through Vite into the iframe
  document; no template-string CSS, no `provideStyle` (post-sign-off adjustment 2).

### 2.4 Session lifecycle

- "← Options" then "Generate QR Code(s)" rebuilds the session from scratch: index → 1,
  encoding restarts (Q34, Q38).
- Closing the modal discards the session; reopening starts from code defaults (Q15, Q22).
- Degenerate case: transform yields empty text → one empty part, QR of the empty string, plus a
  hint line "Export is empty — check your options".

---

## 3. Option matrix (v1)

Segmented controls. Defaults bold. Sub-settings 2–5 nest under the Clean flavor and render
greyed/disabled when Raw is selected (Q11, Q17).

| # | Option | Choices (default bold) | Notes |
|---|--------|------------------------|-------|
| 1 | Flavor | Raw file \| **Clean** | Raw = reader text byte-identical (disk file, block-tree reassembly as fallback) |
| 2 | Wiki links | As-is \| **Plain text** \| `\|\|marked\|\|` | Clean only (Q4) |
| 3 | Images | **Placeholder** \| Remove \| `\|\|marked\|\|` | Clean only (Q5, Q17) |
| 4 | Tasks | **Logseq markers** \| Markdown checkboxes | Clean only (Q17, Q19) |
| 5 | External links | **Markdown** \| Plain URL | Clean only (Q20, Q27, Q33) |
| 6 | Refs/embeds | **Strip placeholder** \| Resolve *(greyed, "coming soon")* | Clean only; Resolve lands as NTH with depth-2 default (Q6, Q17) |

---

## 4. Clean transform specification

Applied to the reader text (disk file or block-tree reassembly). Pure string → string function
in `core/`. Fenced code blocks (``` … ```) are **never** touched (Q12). No reflow, no
re-wrapping, no heading invention (Q12).

### 4.1 Property lines

A property line matches `key:: value` on its own line (any indentation).

- **Internal keys are dropped**: `id`, `collapsed`, `background-color`, `custom_id`, `macro_id`,
  `hl-*` (highlights), `card-*` (spaced repetition). Held as one named, tested constant; the list
  may grow later (Q12).
- **User property lines are kept verbatim** in v1; the `key:: → key:` rewrite is a future feature
  (Q18).

### 4.2 Outline & tasks

- Outline shape preserved: `- ` bullets, 2-space indentation per level (indent-width option is
  future) (Q12).
- Task markers kept verbatim by default. In **Markdown checkboxes** mode (Q19):
  - `TODO`, `DOING`, `NOW`, `LATER`, `WAITING` → `- [ ] `
  - `DONE` → `- [x] `
  - `CANCELED` → marker word kept as plain text (no checkbox equivalent)
  - unrecognized/custom markers → verbatim

### 4.3 Wiki links (Clean only)

Forms: `[[Page]]` and `[alias]([[Page]])`. Display text = alias when present, else page name.

- **Plain text** (default): `[[Page]]` → `Page`; `[alias]([[Page]])` → `alias`.
- **As-is**: untouched.
- **Marked**: `[[Page]]` → `||Page||`; `[alias]([[Page]])` → `||alias||` — signals "a wiki link
  existed here that may not resolve in the target vault" (Q4).

### 4.4 Images (Clean only)

Form: `![alt](path)`.

- **Placeholder** (default): `[image: alt]`, or `[image: <basename>]` when alt is empty (Q13).
- **Remove**: the image token is deleted entirely (Q5).
- **Marked**: `||alt||` / `||<basename>||` (Q17).

### 4.5 Block references & embeds (Clean only, v1 = strip)

- `((uuid))` → `[block reference]`
- `{{embed ((uuid))}}` → `[embed: block reference]`
- `{{embed [[Page]]}}` → `[embed: Page]` (Q13)
- Resolve-to-content is the NTH feature (default depth 2 when it lands) (Q6, Q17).
- Other macros (`{{renderer …}}` etc.) are untouched in v1 (not decided → not transformed).

### 4.6 External links (Clean only)

Scope: URLs with scheme `http`, `https`, `file` (`file:///…`), in two forms: markdown links
`[text](url)` and bare URLs. Everything else (mailto:, relative paths, internal
`[text](page name)`) is untouched in v1 (Q33).

- **Markdown** (default): markdown links untouched; a bare URL becomes explicit:
  `https://example.com/docs` → `[https://example.com/docs](https://example.com/docs)`.
- **Plain URL**: `[the docs](https://example.com/docs)` → `https://example.com/docs` (display
  text dropped); bare URLs untouched (Q27, Q33).

---

## 5. Rendered preview pipeline

`unified().use(remarkParse).use(remarkGfm).use(remarkBreaks).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify)`
(Q24, Q30)

- No `rehypeRaw`: raw HTML in notes never reaches the DOM; sanitize stays trivial. Output is an
  HTML string injected via `dangerouslySetInnerHTML` — safe by construction.
- `remarkBreaks` renders single newlines as `<br>`, matching the outline feel.
- Deliberately dropped vs. the user's production pipeline: URL-rewrite, figure-caption, slug, and
  highlight plugins (preview doesn't need them).

---

## 6. Pagination & encoding flow

Constants (frozen for v1, Q9): part byte budget **2900 UTF-8 bytes**, error-correction level
**L**, render width **512px**. Measured: ~32–37 ms per worst-case part encode; 20 parts ≈ 650 ms.

Flow on "Generate QR Code(s)" (Q38):

1. Transform + paginate **synchronously** → `parts: string[]` (`N` known immediately;
   concatenation of parts equals the transformed text byte-for-byte).
2. Encode **part 1** (~35 ms; button shows "Generating…"), then navigate to QR stage page 1.
3. Encode parts 2…N in a **background sequential loop**, yielding between parts so the UI paints.
   While the loop runs, **Next is disabled and shows a small spinner inside**; when the last part
   finishes, the spinner is removed and Next activates.
4. A per-session cancel flag stops the loop on close / back / re-confirm.

Deleted by this design (Q25, Q32, Q38): live regeneration on option change, index clamping,
generation counters for stale encodes, the QR data-URL cache, lazy per-page encoding, and the
placeholder-while-encoding image. Paging within a finished session is a synchronous `<img src>`
swap. Options are immutable during a QR session by construction (wizard).

---

## 7. State management

`createStore` from `@xstate/store` (Q31). Context:

```ts
{
  stage: 'config' | 'qr',
  options: ExportOptions,            // §3
  previewSource: 'example' | 'page', // Q40
  sourceText: string | null,         // real page raw text, read at export start
  parts: string[],                   // §6 step 1
  qrImages: (string | null)[],       // data URLs, filled progressively
  encodedCount: number,              // drives the Next-disabled rule
  index: number,                     // 0-based QR page
  tab: 'qr' | 'text' | 'rendered',
  error: string | null,
}
```

Events: `open`, `setOption`, `setPreviewSource`, `confirm`, `back`, `prev`, `next`, `setTab`,
`close`. Invariants (unit-tested): `index < parts.length`; `next` is a no-op while
`encodedCount < parts.length`; `confirm` resets parts/images/index; `back` preserves options and
preview source; `close` resets to code defaults.

**Slice composition (Zustand-style slices).** The context above is not one blob: it is composed
from three slices, each owned by its own module together with the events that touch only it:

- `config` slice — `options`, `previewSource` (events: `setOption`, `setPreviewSource`).
- `session` slice — `sourceText`, `parts`, `qrImages`, `encodedCount`, `index`, `tab`,
  `generating`, `error` (events: `open`, `generate`, `partEncoded`, `prev`, `next`, `setTab`).
- `nav` slice — `stage` (events: stage transitions triggered by `generate`/`partEncoded`/`back`).

The slices are merged into a single `createStore` instance at a small composition root; the few
cross-slice rules (`partEncoded(0)` flips `stage` to `qr`; `close` resets every slice to code
defaults) live in that composition root and are covered by the store tests.

---

## 8. Architecture layers

Platform-agnostic so a future Obsidian plugin or Roam extension can reuse the guts; **no
Obsidian/Roam code is written now** — only the seam (Q28).

- `src/core/` — pure TypeScript, **zero `@logseq/libs` imports**: option types + defaults, Clean
  transformer, paginator, QR encoder wrapper, export-session store (§7), example snippet
  constant, internal-keys constant.
- `src/ui/` — React modal, wizard stages, tabs, option rows, preview columns; depends only on
  `core` plus a tiny `Host` interface (show/hide, toasts).
- `src/platform/logseq/` — everything `@logseq/libs`: page reading (disk-first with filename
  candidates, block-tree reassembly fallback — existing strategies kept), page-menu
  registration, Host implementation, and the dev-gated capture entry (§10).

Boundary enforcement: oxlint config (overrides + restricted imports for `src/core/**` and
`src/ui/**`); if oxlint cannot express it, a small Vitest import-scan guard test instead (Q28).

---

## 9. Reader strategies (kept from current code)

1. Raw file from the graph directory (`pages/`/`journals/`, filename-candidate spellings, asset
   URL then `file:///` fallback).
2. Fallback: `getPageBlocksTree` reassembly (`original` preferred over `content`, markers,
   `collapsed:: true`, 2-space indentation).

Raw flavor returns this text untouched; Clean flavor transforms it (§4). The Config stage's
"This page" left column shows the same text.

---

## 10. Test plan

Vitest, pure-function and store tests; **no E2E** (Q8).

- **Real fixtures** (user-pasted, Q14/Q21/Q26):
  `test/fixtures/<slug>/input.md`, optional `options.json` (overrides), `expected.md`.
  Optional `page-data.edn` / `page-ast.edn` beside them as human reference only (Logseq dev-mode
  dumps; never parsed by tests).
- **Synthetic edge cases**: multibyte text at budget boundaries, single over-budget line
  hard-split, empty input, fenced code containing `[[…]]`/`id::`, `CANCELED` markers, bare vs
  markdown external links incl. `file:///`, alias forms, every placeholder form.
- **paginate**: byte budget in UTF-8, line awareness, hard split, `['']` for empty input.
- **Store transitions** (§7 invariants), including the Next-disabled rule and wizard navigation.
- **Pipeline smoke**: Rendered preview renders without throwing and never emits raw HTML.
- **Boundary guard** (fallback for oxlint, §8).
- **Dev-gated capture tool** (b′): "(Dev) Copy block tree JSON" page-menu entry compiled only
  when `import.meta.env.DEV` — absent from release builds — to capture real block trees for
  fallback-reader tests (Q26). Its extension for cross-page ref fixtures is booked under the
  NTH resolve feature (Q21 note).

---

## 11. NTH & future features (booked, not built)

1. **NTH — Quick export + saved defaults**: second page-menu entry skipping the Config stage;
   introduces `useSettingsSchema`. (Q1, Q15, Q22)
2. **NTH — Resolve block refs & embeds**: enables the greyed option; default resolve depth 2;
   extends the dev capture tool for cross-page ref fixtures. (Q6, Q17, Q21)
3. **Future — user-property rewrite** `key:: value` → `key: value`. (Q18)
4. **Future — indent-width option** (1/2/3/4 spaces per level). (Q12)
5. **Future (low priority) — expose EC level** (L/M/Q/H). (Q9)
6. **Out of scope, seam only — Obsidian plugin / Roam browser extension** reusing `core` + `ui`.
   (Q28)

---

## 12. Decision log (condensed)

| Q | Decision |
|---|----------|
| 1 | Toolbar icon removed; single page-menu entry in v1; quick export = NTH |
| 2 | Centered modal, dark backdrop, close via X/backdrop/Esc, bottom `prev \| counter \| next`, arrows paginate |
| 3 | Two flavors Raw/Clean, Clean default |
| 4 | Wiki links: as-is / plain (def) / `\|\|marked\|\|` |
| 5 | Images: placeholder (def) / remove (+ marked, Q17) |
| 6 | Refs v1 = strip with placeholders; resolve = NTH |
| 8 | Vitest, pure tests, no E2E |
| 9 | QR params frozen: 2900 B / L / 512 px |
| 10 | Collapsible options replaced by Config stage (Q34ff) |
| 12 | Clean ruleset: internal props dropped, fences untouched, outline kept |
| 13 | Placeholder texts: `[image: …]`, `[block reference]`, `[embed: …]` |
| 14/21/26 | Fixtures = pasted markdown (+ dev-gated block-tree capture); no EDN parser |
| 15/22 | No settings schema in v1 |
| 18 | User properties verbatim in v1 |
| 19 | Task conversion mapping incl. CANCELED kept as word |
| 20/27/33 | External links: Markdown (def) / Plain URL; scope http, https, file; bare→`[url](url)` in Markdown mode |
| 23/37/39 | Tabs QR/Text/Rendered; Text/Rendered show current part's exact payload |
| 24/30 | unified pipeline (remark-parse, gfm, breaks, rehype, sanitize, stringify) |
| 25/32 | Live-regen + clamp design **superseded** by the wizard (Q34–Q38) |
| 28 | core/ui/platform layers, oxlint boundary |
| 29 | SVG-in-label trial, live verification, emoji fallback |
| 31 | `@xstate/store` createStore |
| 34 | Wizard nav: back button, Esc/backdrop close both stages, arrows QR-stage only |
| 35 | Config layout: options, toggle, two columns, confirm bottom-right |
| 36/40 | Static example constant + `Example \| This page` toggle, Example default |
| 38 | Progressive encoding: part 1 then background loop; Next disabled + spinner until done |
