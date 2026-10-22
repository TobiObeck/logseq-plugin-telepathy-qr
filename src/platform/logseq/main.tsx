import '@logseq/libs'
import 'bulma/css/bulma.min.css'
import '../../ui/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Host, SavedConfig } from '../../core/host'
import { DEFAULT_OPTIONS } from '../../core/options'
import { cancelActiveGeneration, startRunner } from '../../core/runner'
import type { ExportScope } from '../../core/scope'
import { telepathyStore } from '../../core/store'
import { App } from '../../ui/App'
import { BUILD_LABEL } from '../../ui/buildInfo'
import { readBlocksMarkdown, readPageMarkdown } from './readPage'
import { registerDevProbes } from './probe'
import { getZoomedBlockUuid, watchRoute } from './zoom'

/**
 * Menu label. The inline-SVG icon trial (DESIGN.md §1, Q29) failed — Logseq
 * does not render HTML in page-menu labels — so the emoji prefix is the
 * shipped form.
 */
const MENU_LABEL = '📱 Export page as QR code'
const SELECTION_MENU_LABEL = '📱 Export selected bullet(s) as QR code'

/** localStorage key prefix, suffixed with the graph path and ":options". */
const STORAGE_PREFIX = 'telepathy-qr:'

const graphPath = async (): Promise<string | undefined> => {
  const g = await logseq.App.getCurrentGraph()
  if (typeof g === 'object' && g !== null && 'path' in g) {
    const p = (g as { path?: unknown }).path
    if (typeof p === 'string') return p
  }
  return undefined
}

const persistConfig = async (config: SavedConfig): Promise<void> => {
  const gp = await graphPath()
  if (gp === undefined) return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${gp}:options`, JSON.stringify(config))
  } catch {
    // localStorage unavailable or full — silently ignore.
  }
}

const loadSavedConfig = async (): Promise<SavedConfig> => {
  const gp = await graphPath()
  try {
    if (gp !== undefined) {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${gp}:options`)
      if (raw !== null) {
        const parsed = JSON.parse(raw) as Partial<SavedConfig>
        return {
          options: { ...DEFAULT_OPTIONS, ...parsed.options },
          previewSource: parsed.previewSource ?? 'example',
        }
      }
    }
  } catch {
    // Corrupt JSON — fall back to defaults.
  }
  return { options: { ...DEFAULT_OPTIONS }, previewSource: 'example' }
}

const host: Host = {
  close: () => {
    void logseq.hideMainUI()
  },
  toast: (message, kind = 'info') => {
    void logseq.UI.showMsg(message, kind, { timeout: kind === 'error' ? 8000 : 4000 })
  },
  persistConfig,
  loadSavedConfig,
}

const currentPageName = async (): Promise<string | undefined> => {
  const page = await logseq.Editor.getCurrentPage()
  if (typeof page === 'object' && page !== null && 'name' in page) {
    const name = (page as { name?: unknown }).name
    if (typeof name === 'string') return name
  }
  return undefined
}

/**
 * Hosts older than the DB-graph API throw "Not existed method" for
 * `checkCurrentIsDbGraph`; such hosts cannot open a DB graph in the first
 * place, so a failed call means file graph.
 */
const isDbGraph = async (): Promise<boolean> => {
  try {
    return (await logseq.App.checkCurrentIsDbGraph()) === true
  } catch {
    return false
  }
}

/** Toasts and returns true when the current graph is a DB graph (not exportable). */
const refuseDbGraph = async (): Promise<boolean> => {
  if (!(await isDbGraph())) return false
  host.toast('TelepathyQR: database graphs cannot be exported.', 'warning')
  return true
}

/** Opens the Config stage on a source. The scope only labels the preview. */
const openConfigStage = async (
  sourceText: string,
  scope: ExportScope,
  scopeRoots: number,
): Promise<void> => {
  const savedConfig = await host.loadSavedConfig()
  telepathyStore.send({ type: 'open', sourceText, savedConfig, scope, scopeRoots })
  await logseq.showMainUI()
}

const startExport = async (pageName?: string): Promise<void> => {
  try {
    if (await refuseDbGraph()) return

    const name = pageName ?? (await currentPageName())
    if (name === undefined) {
      host.toast('TelepathyQR: no current page to export.', 'warning')
      return
    }

    const sourceText = await readPageMarkdown(name)
    await openConfigStage(sourceText, 'page', 1)
  } catch (error) {
    console.error('[TelepathyQR]', error)
    const reason = error instanceof Error ? error.message : String(error)
    host.toast(`TelepathyQR: could not read the page: ${reason}`, 'error')
  }
}

/** Failures of the scoped entries all read as "could not read the block"; details go to the console. */
const reportBlockFailure = (error: unknown): void => {
  console.error('[TelepathyQR]', error)
  host.toast('TelepathyQR: could not read the block.', 'error')
}

/**
 * A bullet right-click replaces any blue selection with that bullet and its
 * children, so the clicked block is the whole scope.
 */
const exportSelectedBlocks = async (uuid: string): Promise<void> => {
  try {
    if (await refuseDbGraph()) return

    const { sourceText, rootCount } = await readBlocksMarkdown([uuid])
    if (sourceText.trim() === '') {
      host.toast('TelepathyQR: nothing to export.', 'warning')
      return
    }
    await openConfigStage(sourceText, 'focused', rootCount)
  } catch (error) {
    reportBlockFailure(error)
  }
}

interface QuickSource {
  sourceText: string
  scope: ExportScope
  scopeRoots: number
}

/** Reads the blocks for a scoped quick export; null (after a toast) when nothing is readable. */
const readScopedQuickSource = async (
  uuids: string[],
  scope: 'selection' | 'focused',
): Promise<QuickSource | null> => {
  try {
    const { sourceText, rootCount } = await readBlocksMarkdown(uuids)
    if (sourceText.trim() === '') {
      host.toast('TelepathyQR: nothing to export.', 'warning')
      return null
    }
    return { sourceText, scope, scopeRoots: rootCount }
  } catch (error) {
    reportBlockFailure(error)
    return null
  }
}

/**
 * `auto` is the shortcut's selection > zoom > page order. The palette commands
 * force one scope and toast when that scope is empty.
 */
type QuickMode = 'auto' | 'focused' | 'selection'

/**
 * Quick export (specs/export-scope.md §6, SQ8). Scoped exports go straight to
 * the QR stage with the saved options.
 */
const startQuickExport = async (mode: QuickMode = 'auto'): Promise<void> => {
  try {
    if (await refuseDbGraph()) return

    const selected = (await logseq.Editor.getSelectedBlocks()) ?? []
    const zoomed = getZoomedBlockUuid()

    let source: QuickSource | null
    if (mode === 'selection' || (mode === 'auto' && selected.length > 0)) {
      if (selected.length === 0) {
        host.toast('TelepathyQR: no blocks selected.', 'warning')
        return
      }
      source = await readScopedQuickSource(
        selected.map((block) => block.uuid),
        'selection',
      )
    } else if (mode === 'focused' || (mode === 'auto' && zoomed !== null)) {
      if (zoomed === null) {
        host.toast('TelepathyQR: no focused bullet — zoom into a bullet first.', 'warning')
        return
      }
      source = await readScopedQuickSource([zoomed], 'focused')
    } else {
      const name = await currentPageName()
      if (name === undefined) {
        host.toast('TelepathyQR: no current page to export.', 'warning')
        return
      }
      source = { sourceText: await readPageMarkdown(name), scope: 'page', scopeRoots: 1 }
    }
    if (source === null) return

    const config = await host.loadSavedConfig()
    telepathyStore.send({
      type: 'quickOpen',
      sourceText: source.sourceText,
      config,
      scope: source.scope,
      scopeRoots: source.scopeRoots,
    })
    startRunner(telepathyStore)
    await logseq.showMainUI()
  } catch (error) {
    console.error('[TelepathyQR]', error)
    const reason = error instanceof Error ? error.message : String(error)
    host.toast(`TelepathyQR: could not read the page: ${reason}`, 'error')
  }
}

/**
 * Dev-build-only fixture tooling (DESIGN.md §10, Q26): copies the raw block
 * tree of the current page as JSON to the clipboard, so real-world fixtures
 * for the block-tree reader can be captured. `import.meta.env.DEV` is false in
 * release builds, so this entry never ships.
 */
const copyBlockTree = async (): Promise<void> => {
  const name = await currentPageName()
  if (name === undefined) return
  const tree = await logseq.Editor.getPageBlocksTree(name)
  const json = JSON.stringify(tree, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    host.toast('TelepathyQR: block tree JSON copied to clipboard.', 'success')
  } catch {
    // Clipboard writes need document focus, which a host menu click does not
    // give the plugin frame. The JSON goes to the console instead.
    console.log('[TelepathyQR] block tree JSON:\n' + json)
    host.toast('TelepathyQR: clipboard refused; block tree JSON logged to the console.', 'warning')
  }
}

const main = (): void => {
  console.info('[TelepathyQR]', BUILD_LABEL)
  logseq.provideModel({
    hide: () => {
      cancelActiveGeneration()
      telepathyStore.send({ type: 'close' })
      void logseq.hideMainUI()
    },
  })
  // The modal lives inside the plugin iframe; Bulma and styles.css are
  // imported above and therefore bundled into the iframe document by Vite.
  // The iframe itself is stretched over the whole viewport so the backdrop
  // can cover the screen.
  logseq.setMainUIInlineStyle({
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    zIndex: 11,
  })

  logseq.App.registerPageMenuItem(MENU_LABEL, (payload: { page: string }) => {
    void startExport(payload.page)
  })

  logseq.Editor.registerBlockContextMenuItem(SELECTION_MENU_LABEL, ({ uuid }) =>
    exportSelectedBlocks(uuid),
  )

  watchRoute()

  logseq.App.registerCommandShortcut(
    { binding: 'ctrl+shift+q', mac: 'cmd+shift+q' },
    () => void startQuickExport(),
    { label: 'TelepathyQR: Quick Export' },
  )

  logseq.App.registerCommandPalette(
    { key: 'telepathy-qr-focused', label: 'TelepathyQR: Export focused bullet' },
    () => void startQuickExport('focused'),
  )

  logseq.App.registerCommandPalette(
    { key: 'telepathy-qr-selection', label: 'TelepathyQR: Export selection' },
    () => void startQuickExport('selection'),
  )

  if (import.meta.env.DEV) {
    logseq.App.registerPageMenuItem('(Dev) Copy block tree JSON', () => {
      void copyBlockTree()
    })
    // Export-scope trial instrumentation (specs/export-scope.md §4).
    registerDevProbes()
  }

  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <App host={host} />
    </StrictMode>,
  )
}

logseq.ready(main).catch(console.error)
