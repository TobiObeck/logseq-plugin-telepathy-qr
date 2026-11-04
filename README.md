# TelepathyQR

Export a Logseq page or a single bullet as a (sequence) of QR code(s). Simply scan the QR code(s) with your phone 📱📷⚡. A quick way to transfer notes from your computer to your phone. No, cloud, no special app, no cables, just pure ~~telepathic~~ visual transmission... 😵👁️⃤ 👽


Perfect for getting a whole page or parts of it quickly from one device to another without any special set up.

## See it in action

<!--
  PUBLISHING NOTE: GitHub does not render repo-tracked .mp4 files inline in a
  README. To get the inline players below, edit this file on github.com and drag
  each video from readme_assets/ into the editor — GitHub uploads it to its
  attachment CDN and inserts a https://github.com/user-attachments/assets/...
  URL. Replace each src="..." with that URL, then delete this comment.
  The files can stay in readme_assets/ as versioned source copies (~6 MB total).
-->

**Full walkthrough**: export a page via the page menu, configure, generate, scan:

<video src="https://github.com/user-attachments/assets/8ae53c19-2903-428c-b3a3-e2de07dc3ccd" controls width="640" title="TelepathyQR full demo"></video>

[▶ Watch: full demo](./readme_assets/1_telepathy_qr_demo.mp4)

**Single bullet**: right-click a bullet → *Export selected bullet(s) as QR code*:

<video src="https://github.com/user-attachments/assets/701e7598-389f-4295-8902-ae3c83411099" controls width="640" title="Bullet context-menu export"></video>

[▶ Watch: bullet context-menu export](./readme_assets/2_single_bullet_right_click_ctx_menu_export.mp4)

**Quick export** — `Ctrl+Shift+Q` (`⌘⇧Q` on macOS) skips the config stage:

<video src="https://github.com/user-attachments/assets/ee52fe8c-9c2f-4e09-a628-87056e637fab" controls width="640" title="Ctrl+Shift+Q quick export"></video>

[▶ Watch: quick export shortcut](./readme_assets/3_ctrl-shift-q_shortcut_demo.mp4)

## Usage

Four ways in, one wizard out:

| Entry point | Scope | Opens |
|-------------|-------|-------|
| Page menu (⋯) → **📱 Export page as QR code** | whole page | Config stage |
| Right-click a bullet → **📱 Export selected bullet(s) as QR code** | that bullet and its children | Config stage |
| **`Ctrl+Shift+Q`** / **`⌘⇧Q`** quick export | selection > zoomed bullet > page (first non-empty) | QR stage directly, with your saved options |
| Command palette: *TelepathyQR: Export focused bullet* / *Export selection* | forced to one scope | QR stage directly, with your saved options |

The wizard has two stages:

1. **Config stage** — choose how the page should be transformed, with a live preview:
   input on top, transformed output below, scrolling in sync (example snippet or your
   real page). Your choices are remembered per graph. Press **Generate QR Code(s)**.
2. **QR stage** — the first QR code appears immediately; the remaining parts encode in
   the background (the Next button shows a spinner until they are ready). Paginate with
   the buttons or the arrow keys; on page 1, "← Back to config" returns to the Config
   stage. The **Text** and **Rendered** tabs show exactly what the currently displayed
   QR code encodes.

`← Options` returns to the Config stage with your choices intact; `Esc`, the × button
or a click on the backdrop closes the modal.

## Export options

| Option | Choices (default bold) | Effect in Clean mode |
|--------|------------------------|----------------------|
| Flavor | Raw file \| **Clean** | Raw exports the page byte-identical; Clean applies everything below |
| Wiki links | As-is \| **Plain text** \| `\|\|marked\|\|` | `[[Page]]` → `Page`, or `‖Page‖` to flag a link that may not exist elsewhere |
| Images | **Placeholder** \| Remove \| `\|\|marked\|\|` | `![alt](p.png)` → `[image: alt]` (or the file name when alt is empty) |
| Tasks | **Logseq markers** \| Markdown checkboxes | `TODO`/`DONE`/… → `- [ ]`/`- [x]`; `CANCELED` stays a word |
| External links | **Markdown** \| Plain URL | In Markdown mode bare `https://…` URLs become explicit links; Plain mode reduces `[text](url)` to `url` |
| Refs / embeds | Strip placeholder \| **Resolve** | Resolve inlines the referenced block's content (two levels deep); Strip reduces `((uuid))` → `[block reference]`, `{{embed [[Page]]}}` → `[embed: Page]` |
| Numbered lists | Bullets \| **Numbered** | Numbered children drop Logseq's property line and become `1.`, `a.`, `I.`, … by depth |

Clean mode also drops Logseq-internal property lines (`id::`, `collapsed::`, highlight
and spaced-repetition keys), keeps your own properties verbatim, preserves the outline
shape, and never touches anything inside fenced code blocks. The full ruleset lives in
[DESIGN.md](./DESIGN.md).

## The QR encoding

Each QR code carries up to 2900 UTF-8 bytes at error-correction level L — the largest
payload a phone camera still reads comfortably off a screen. Parts split on line
boundaries, so concatenating all scanned parts reproduces the exported text exactly.

## Installation

From Logseq: **Settings → Plugins → Marketplace**, search for *TelepathyQR* (once
listed), or download the `.zip` from the latest
[release](https://github.com/TobiObeck/logseq-plugin-telepathy-qr/releases), unzip it,
and load it via **Settings → Plugins → Load unpacked plugin**.

**Note:** TelepathyQR reads pages from disk and therefore works with file-based
(Markdown) graphs only; database graphs are not supported.

## Known limitations

These are documented decisions and known gaps; see [DESIGN.md](./DESIGN.md) for the full rationale.

- **File-based (Markdown) graphs only.** Database graphs cannot be exported — the plugin reads pages from disk.
- **Clean mode does not strip scheduling metadata.** `SCHEDULED:` / `DEADLINE:` lines and `:LOGBOOK:` drawers pass through as noise. Fix planned by extending the Clean ruleset (no new option).
- **User properties kept verbatim.** `key:: value` lines are preserved as-is; rewriting them to `key: value` is a future feature.
- **Raw-mode scoped exports aren't byte-identical to the file.** Block-tree exports (bullet export, quick export of selections/focused bullets) are reassembled from Logseq's editor API. Only page-level Raw exports match the on-disk file exactly.
- **Fixed indent width.** Outline indentation is always 2 spaces per level. A configurable indent-width option is booked but not built.
- **`CANCELED` tasks have no checkbox equivalent.** In Markdown-checkboxes mode, `CANCELED` stays as a plain-text word (there is no standard markdown equivalent). Unrecognized/custom markers also pass through verbatim.
- **Block-ref / embed resolve depth is fixed at 2 levels.** No user-configurable depth yet.
- **QR error-correction level is fixed at L.** Exposing L/M/Q/H is a future feature.
- **No "reset to defaults" button.** To restore defaults, switch each option back manually.

## Development

```sh
pnpm install
pnpm dev      # vite dev server for Logseq plugin loading
pnpm build    # typecheck + production bundle into dist/
pnpm test     # vitest: transformer, paginator, store, preview, layer boundary
pnpm lint     # oxlint
pnpm storybook # local component workbench (Vite-backed, no Logseq needed)
```

Storybook includes isolated stories for the Config and QR stages in `src/ui/`.
Use `pnpm build-storybook` to verify or build the workbench.

### Fixtures: a real Logseq graph in the repo

`test/vault/` is an openable Logseq graph that doubles as the fixture suite:

- **Inputs**: `test/vault/pages/<name>.md` — one feature group per file
  (`wiki-links`, `images`, `tasks`, `external-links`, `properties`, `code-fences`,
  `queries`, `block-refs`, `block-embeds`), plus `showcase.md` with everything at once.
- **Expected outputs**: `test/expected/<name>.md` for the default options.
- **Option combinations**: `test/options/<name>.<tag>.json` paired with
  `test/expected/<name>.<tag>.md` (see `showcase.combined`, `showcase.raw`,
  `tasks.checkbox`, `external-links.plain`).
- `pnpm test` picks all of it up automatically.

Expected files live **outside** the vault so Logseq does not treat them as pages
(no duplicate-title skips, no graph clutter). You can open `test/vault` as a graph
in Logseq (with the plugin loaded from this repo) to check pages end-to-end — or to
author new fixture pages in the Logseq UI and commit the resulting markdown. The
directories Logseq generates (`logseq/`, `journals/`, `.recycle/`) are gitignored.
Editing a fixture page in Logseq may add `id::` properties; re-run `pnpm test` and
update the expected file accordingly — that round trip *is* the workflow.

In **dev builds only**, the page menu also offers "(Dev) Copy block tree JSON", which
copies the raw block tree of the current page to the clipboard for debugging the
block-tree reader. It is compiled out of release builds.

## Architecture

- `src/core/` — pure TypeScript: options, Clean transformer, paginator, QR encoder,
  session store (`@xstate/store`, slice-composed), preview pipeline (unified/remark/rehype).
  No Logseq imports, ever.
- `src/ui/` — the React modal wizard; depends only on `core`. Styling is Bulma plus
  `src/ui/styles.css`, imported through Vite into the plugin iframe document.
- `src/platform/logseq/` — everything `@logseq/libs`: page reading (disk file with
  block-tree fallback), menu registration, host glue.

The seam exists so the same core could one day power an Obsidian plugin or a browser
extension. See [DESIGN.md](./DESIGN.md) for the complete decision record.

## Roadmap (booked, not built)

- User-property rewrite (`key:: value` → `key: value`), configurable indent width
- Exposing the QR error-correction level

## License

[AGPL-3.0-only](./LICENSE) — fork it, change it, share it; network use counts as
distribution. No warranty.
