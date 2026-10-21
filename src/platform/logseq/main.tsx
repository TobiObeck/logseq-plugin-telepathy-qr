import '@logseq/libs'
import 'bulma/css/bulma.min.css'
import '../../ui/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Host } from '../../core/host'
import type { ExportOptions } from '../../core/options'
import { DEFAULT_OPTIONS } from '../../core/options'
import { cancelActiveGeneration } from '../../core/runner'
import { telepathyStore } from '../../core/store'
import { App } from '../../ui/App'
import { readPageMarkdown } from './readPage'

/**
 * Menu label. The inline-SVG icon trial (DESIGN.md §1, Q29) failed — Logseq
 * does not render HTML in page-menu labels — so the emoji prefix is the
 * shipped form.
 */
const MENU_LABEL = '📱 Export page as QR code'

/** localStorage key prefix, suffixed with the graph path and ":options". */
const STORAGE_PREFIX = 'telepathy-qr:'

const graphPath = (): string | undefined => {
  const g = logseq.App.getCurrentGraph()
  if (typeof g === 'object' && g !== null && 'path' in g) {
    const p = (g as { path?: unknown }).path
    if (typeof p === 'string') return p
  }
  return undefined
}

const persistOptions = (options: ExportOptions): void => {
  const gp = graphPath()
  if (gp === undefined) return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${gp}:options`, JSON.stringify(options))
  } catch {
    // localStorage unavailable or full — silently ignore.
  }
}

const loadSavedOptions = (): ExportOptions => {
  const gp = graphPath()
  try {
    if (gp !== undefined) {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${gp}:options`)
      if (raw !== null) {
        const parsed = JSON.parse(raw) as Partial<ExportOptions>
        return { ...DEFAULT_OPTIONS, ...parsed }
      }
    }
  } catch {
    // Corrupt JSON — fall back to defaults.
  }
  return { ...DEFAULT_OPTIONS }
}

const host: Host = {
  close: () => {
    void logseq.hideMainUI()
  },
  toast: (message, kind = 'info') => {
    void logseq.UI.showMsg(message, kind, { timeout: kind === 'error' ? 8000 : 4000 })
  },
  persistOptions,
  loadSavedOptions,
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

const startExport = async (pageName?: string): Promise<void> => {
  try {
    if (await isDbGraph()) {
      host.toast('TelepathyQR: database graphs cannot be exported.', 'warning')
      return
    }

    const name = pageName ?? (await currentPageName())
    if (name === undefined) {
      host.toast('TelepathyQR: no current page to export.', 'warning')
      return
    }

    const gp = graphPath()
    const savedOptions = gp !== undefined ? host.loadSavedOptions() : undefined
    const sourceText = await readPageMarkdown(name)
    telepathyStore.send({ type: 'open', sourceText, savedOptions })
    await logseq.showMainUI()
  } catch (error) {
    console.error('[TelepathyQR]', error)
    const reason = error instanceof Error ? error.message : String(error)
    host.toast(`TelepathyQR: could not read the page: ${reason}`, 'error')
  }
}

const startQuickExport = async (): Promise<void> => {
  try {
    if (await isDbGraph()) {
      host.toast('TelepathyQR: database graphs cannot be exported.', 'warning')
      return
    }

    const name = await currentPageName()
    if (name === undefined) {
      host.toast('TelepathyQR: no current page to export.', 'warning')
      return
    }

    const gp = graphPath()
    const options = gp !== undefined ? host.loadSavedOptions() : DEFAULT_OPTIONS
    const sourceText = await readPageMarkdown(name)
    telepathyStore.send({ type: 'quickOpen', sourceText, options })
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
  await navigator.clipboard.writeText(JSON.stringify(tree, null, 2))
  host.toast('TelepathyQR: block tree JSON copied to clipboard.', 'success')
}

const main = (): void => {
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

  logseq.App.registerCommandShortcut(
    { binding: 'ctrl+shift+q', mac: 'cmd+shift+q' },
    () => void startQuickExport(),
    { label: 'TelepathyQR: Quick Export' },
  )

  if (import.meta.env.DEV) {
    logseq.App.registerPageMenuItem('(Dev) Copy block tree JSON', () => {
      void copyBlockTree()
    })
  }

  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <App host={host} />
    </StrictMode>,
  )
}

logseq.ready(main).catch(console.error)
