# Spec: Quick Export + Saved Defaults

**Status**: agreed, ready to implement  
**Parent**: DESIGN.md §11, NTH #1  
**References**: (Q1, Q15, Q22)

---

## 1. Goal

Add a keyboard shortcut for quick export that skips the Config stage entirely, using options persisted per-graph in localStorage. The existing page-menu entry remains the single visible entry point. After the user clicks **Generate QR Code(s)**, the chosen options are saved so the next Config open (or quick export) picks up where they left off.

---

## 2. User-facing behavior

### 2.1 Page-menu entry (unchanged)

The existing single entry `📱 Export page as QR code` opens the full Config → QR wizard. No second menu entry is added.

### 2.2 Quick export via keyboard shortcut

- **Default binding**: `Ctrl+Shift+Q` (`Cmd+Shift+Q` on Mac).
- Registered as a named Logseq command: `TelepathyQR: Quick Export`.
- Appears in Logseq's keybindings settings so the user can override it.
- Behavior: reads the current page, loads saved options (or `DEFAULT_OPTIONS` on first use), skips the Config stage, generates QR codes, and lands on QR page 1 immediately.

### 2.3 Saved options

- After clicking **Generate QR Code(s)** on the Config stage, the current options snapshot is persisted to localStorage, scoped to the current graph.
- The next time the Config stage opens (regular page-menu entry), the dropdowns are pre-selected with the saved values.
- Escape + reopen shows the saved state (it was never lost).

### 2.4 Reset to defaults

A small **Reset to defaults** link appears at the bottom of the Config stage (below the Generate button, right-aligned). Clicking it:
1. Restores the UI to `DEFAULT_OPTIONS`.
2. Clears the localStorage key for this graph.
3. Shows a toast: `TelepathyQR: defaults restored.`

The reset link is always visible.

### 2.5 First use

No saved options yet → quick export silently uses `DEFAULT_OPTIONS`. No warning toast.

---

## 3. Technical design

### 3.1 localStorage key

Format: `telepathy-qr:<graph-path>:options`

The graph path is obtained via `logseq.App.getCurrentGraph()` → `.path`. Example key:
`telepathy-qr:C:/Users/Krext/OneDrive/Desktop/temp/April2023/roam_backups/roam:options`

Value: JSON-encoded `ExportOptions` object.

### 3.2 Host interface

Add two methods to `Host`:

```ts
export interface Host {
  close: () => void
  toast: (message: string, kind?: 'info' | 'warning' | 'error' | 'success') => void
  persistOptions: (options: ExportOptions, graphPath: string) => void
  loadSavedOptions: (graphPath: string) => ExportOptions
}
```

The Logseq implementation:
- `persistOptions`: `localStorage.setItem(key, JSON.stringify(options))`
- `loadSavedOptions`: `JSON.parse(localStorage.getItem(key) ?? 'null') ?? DEFAULT_OPTIONS`

A no-op implementation is used for the example/preview path (returns `DEFAULT_OPTIONS`).

### 3.3 Persisting on generate

When the user clicks **Generate QR Code(s)** on the Config stage, the platform layer calls `host.persistOptions(storeSnapshot.options, graphPath)`. This happens as a side effect in the `generate` handler in `main.tsx`, not as a store event.

### 3.4 Quick export flow

The shortcut triggers `startQuickExport`:

1. Get current graph path. If unavailable, fall back to `DEFAULT_OPTIONS`.
2. `const options = host.loadSavedOptions(graphPath)`.
3. Read current page name (same guard as `startExport`).
4. Read page markdown via `readPageMarkdown(name)`.
5. Send store event `quickOpen({ sourceText, options })`.
6. Show the modal (`logseq.showMainUI()`).

### 3.5 Store changes

**Modified `open` event** — accepts an optional `savedOptions` payload. When present, the Config stage initializes with those options instead of `DEFAULT_OPTIONS`:

```ts
open: (_ctx, event: { sourceText: string | null; savedOptions?: ExportOptions }): TelepathyContext => ({
  ...initialConfig(),
  options: event.savedOptions ? { ...event.savedOptions } : { ...DEFAULT_OPTIONS },
  ...sessionHandlers.open(initialSession(), event),
  ...initialNav(),
})
```

**New `quickOpen` event** — sets options, generates, lands on QR stage:

```ts
quickOpen: (_ctx, event: { sourceText: string; options: ExportOptions }): TelepathyContext => {
  const config: ConfigSlice = { ...initialConfig(), options: event.options }
  const session = sessionHandlers.generate({
    ...initialSession(),
    sourceText: event.sourceText,
    ...config,
  })
  return { ...config, ...session, stage: 'qr' }
}
```

**New `resetOptions` event** — restores code defaults:

```ts
resetOptions: (ctx): TelepathyContext => ({
  ...ctx,
  options: { ...DEFAULT_OPTIONS },
})
```

### 3.6 Shortcut registration

In `main.tsx` `main()`:

```ts
logseq.App.registerCommandShortcut(
  { key: 'ctrl+shift+q', label: 'TelepathyQR: Quick Export', mac: 'cmd+shift+q' },
  () => void startQuickExport(),
)
```

---

## 4. UI changes

### 4.1 Config stage

- Option dropdowns initialize with `store.options` (may be saved values).
- **Reset link**: small right-aligned text link below the Generate button. Fires `resetOptions` + `host.persistOptions(DEFAULT_OPTIONS, graphPath)` + toast.

### 4.2 QR stage

No changes — the quick path lands here directly with all parts already encoding.

---

## 5. Edge cases

| Case | Behavior |
|---|---|
| First use (no saved options) | Quick export uses `DEFAULT_OPTIONS` silently. |
| localStorage unavailable | Falls back to `DEFAULT_OPTIONS`; `persistOptions` is a no-op. |
| Graph path unavailable | Falls back to `DEFAULT_OPTIONS`. |
| User resets, then quick exports | Uses defaults until they visit Config and Generate again. |
| Plugin reloaded (Logseq restart) | localStorage persists across restarts; saved options survive. |
| DB graph | Both entry and shortcut reject with the existing warning toast. |
| No current page | Both entry and shortcut reject with the existing warning toast. |

---

## 6. Test plan

### 6.1 Unit / integration tests (Vitest)

| Test | What it verifies |
|---|---|
| `loadSavedOptions returns defaults when key missing` | No localStorage → `DEFAULT_OPTIONS` |
| `loadSavedOptions merges partial saved values` | Missing keys fall back to defaults |
| `loadSavedOptions for wrong graph returns defaults` | Different graph path → `DEFAULT_OPTIONS` |
| `quickOpen event sets stage to qr immediately` | No config stage shown |
| `quickOpen uses provided options, not defaults` | Saved options flow through to transform |
| `resetOptions event restores DEFAULT_OPTIONS` | Store options reset |
| `open with savedOptions pre-selects them` | Config stage initialized with saved values |
| `open without savedOptions uses DEFAULT_OPTIONS` | Backward-compatible |

### 6.2 Vault fixture

No new vault fixtures needed — the transformer is unchanged. The `showcase` page can be used for quick-export manual verification.

---

## 7. Files to change

| File | Change |
|---|---|
| `src/core/options.ts` | No change (defaults remain code constants). |
| `src/core/store.ts` | Modify `open` to accept `savedOptions?`; add `quickOpen`, `resetOptions` events. |
| `src/core/host.ts` | Add `persistOptions` and `loadSavedOptions` to `Host` interface. |
| `src/platform/logseq/main.tsx` | Register shortcut command, implement host methods, add `startQuickExport`, persist on generate. |
| `src/ui/ConfigStage.tsx` | Add Reset to defaults link, wire to `resetOptions` + `host.persistOptions`. |
| `src/core/store.test.ts` | Tests for `quickOpen`, `resetOptions`, `open` with/without saved options, options loading. |
| `DESIGN.md` | Update §1 (moved from NTH to in-scope), update §11 (mark #1 as built), update §7 (Host interface). |

---

## 8. Deferred to next grill session

| Feature | Notes |
|---|---|
| Focused bullet export | Export only the currently focused/visible bullet. Changes data source. |
| Context menu: select bullets | Right-click on blue highlight area to select multiple bullets, export only those. |
| Context menu: bullet + children | Right-click on a bullet to export that bullet and its entire subtree. |

These change *what* is exported (the data source), not *how* it's exported. They are orthogonal to this feature.
