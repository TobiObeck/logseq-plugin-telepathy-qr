# TelepathyQR

Export a Logseq page as a sequence of QR codes and scan it with another device.
Telepathy for your notes: no cloud, no sync, just light.

## How it works

Open any page, choose **"Export page as QR code"** from the page menu (the three-dot
menu at the top right of a page). A two-stage wizard opens:

1. **Config stage** — choose how the page should be transformed, with a live preview: input
   on top, transformed output below, scrolling in sync (example snippet or your real page).
   Press **Generate QR Code(s)**.
2. **QR stage** — the first QR code appears immediately; the remaining parts encode in
   the background (the Next button shows a spinner until they are ready). Paginate with
   the buttons or the arrow keys; on page 1, "← Back to config" returns to the Config
   stage. The **Text** and **Rendered** tabs show exactly what the currently displayed QR
   code encodes.

`← Options` returns to the Config stage with your choices intact; `Esc`, the × button or
a click on the backdrop closes the modal.

## Export options

| Option | Choices (default bold) | Effect in Clean mode |
|--------|------------------------|----------------------|
| Flavor | Raw file \| **Clean** | Raw exports the page byte-identical; Clean applies everything below |
| Wiki links | As-is \| **Plain text** \| `\|\|marked\|\|` | `[[Page]]` → `Page`, or `‖Page‖` to flag a link that may not exist elsewhere |
| Images | **Placeholder** \| Remove \| `\|\|marked\|\|` | `![alt](p.png)` → `[image: alt]` (or the file name when alt is empty) |
| Tasks | **Logseq markers** \| Markdown checkboxes | `TODO`/`DONE`/… → `- [ ]`/`- [x]`; `CANCELED` stays a word |
| External links | **Markdown** \| Plain URL | In Markdown mode bare `https://…` URLs become explicit links; Plain mode reduces `[text](url)` to `url` |
| Refs / embeds | **Strip placeholder** \| Resolve *(coming soon)* | `((uuid))` → `[block reference]`, `{{embed [[Page]]}}` → `[embed: Page]` |

Clean mode also drops Logseq-internal property lines (`id::`, `collapsed::`, highlight and
spaced-repetition keys), keeps your own properties verbatim, preserves the outline shape,
and never touches anything inside fenced code blocks. The full ruleset lives in
[DESIGN.md](./DESIGN.md).

## The QR encoding

Each QR code carries up to 2900 UTF-8 bytes at error-correction level L — the largest
payload a phone camera still reads comfortably off a screen. Parts split on line
boundaries, so concatenating all scanned parts reproduces the exported text exactly.

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

- Quick export with saved defaults (skips the Config stage; introduces plugin settings)
- Resolving block refs & embeds to their content (default depth 2)
- User-property rewrite (`key:: value` → `key: value`), configurable indent width
- Exposing the QR error-correction level
