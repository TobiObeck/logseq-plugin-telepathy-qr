# TelepathyQR

A Logseq plugin that exports any page as a QR code, so it can be scanned with a
phone and pasted straight into another notes app.

## How it works

1. Open a page and pick **📱 Export page as QR code** from the page's `...` menu
   (or click the 📱 button in the toolbar).
2. TelepathyQR reads the page's markdown file from the graph directory and
   splits it into parts that each fit in a single QR code.
3. A modal shows the current code with a `i / n` counter and previous/next
   buttons. Scan each part in order and paste them into your notes app.

The text is encoded verbatim, with no extra framing or headers added, so the
concatenation of all parts equals the original file byte for byte.

Because a QR code holds at most ~2953 bytes at error correction level L, each
part is capped at 2900 UTF-8 bytes. Pages that are longer are split on line
boundaries, so a line is never cut in half.

## Requirements

- A **file based graph**. DB graphs have no markdown files on disk, so the
  plugin shows a warning and stops there.
- Logseq desktop (the plugin needs `logseq.Assets.makeUrl` and `fetch` on the
  `asset:` protocol).

## Development

```sh
pnpm install
pnpm dev
```

`pnpm dev` serves the plugin and reloads it in Logseq whenever you save. Load it
via **⋯ → Plugins → Load unpacked plugin** and point it at this directory (or
let `vite-plugin-logseq` handle it).

```sh
pnpm build   # type check and bundle into dist/
pnpm lint    # oxlint
```

## Layout

```
src/
  main.tsx              logseq.ready entry: menu items, styles, plugin model
  App.tsx               the QR modal
  store.ts              page parts shared between the plugin model and React
  lib/
    readPage.ts         locates and reads pages/<name>.md from the graph
    paginate.ts         splits markdown into QR sized parts
    qr.ts               encoding, pinned to error correction level L
references/             upstream samples kept for reference, not built
```