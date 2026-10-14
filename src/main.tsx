import '@logseq/libs'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { paginate } from './lib/paginate.ts'
import { readPageMarkdown } from './lib/readPage.ts'
import { MENU_ITEM_LABEL, qrStore } from './store.ts'

const isDbGraph = async (): Promise<boolean> => {
  try {
    return (await logseq.App.checkCurrentIsDbGraph()) === true
  } catch {
    // Hosts without the API cannot open a DB graph, so assume a file graph.
    return false
  }
}

/**
 * `getCurrentPage` is typed as a page *or* a block, and only pages carry a
 * `name`, so the union has to be narrowed before it is useful.
 */
const currentPageName = async (): Promise<string | undefined> => {
  const page = await logseq.Editor.getCurrentPage()
  if (page === null) return undefined

  const name: unknown = (page as { name?: unknown }).name
  return typeof name === 'string' ? name : undefined
}

/**
 * Reads the current page, splits it into QR-sized parts and opens the modal.
 * The page name is passed explicitly by the page menu item, because the route
 * can already have changed by the time an async read resolves.
 */
const exportPage = async (pageName?: string): Promise<void> => {
  try {
    if (await isDbGraph()) {
      logseq.UI.showMsg(
        'TelepathyQR only supports file based graphs.',
        'warning',
      )
      return
    }

    const name = pageName ?? (await currentPageName())
    if (name === undefined) {
      logseq.UI.showMsg('No page to export.', 'warning')
      return
    }

    const markdown = await readPageMarkdown(name)
    qrStore.setParts(paginate(markdown))
    logseq.showMainUI()
  } catch (error) {
    logseq.UI.showMsg(
      `TelepathyQR could not read this page: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'error',
      { timeout: 8000 },
    )
  }
}

function main() {
  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  logseq.provideModel({
    // Wired to the toolbar button via `data-on-click`. The click event is
    // passed in as the first argument, hence the empty signature.
    show: () => {
      void exportPage()
    },
    hide: () => {
      logseq.hideMainUI()
    },
  })

  logseq.setMainUIInlineStyle({
    zIndex: 11,
  })

  logseq.provideStyle(`
    .telepathy-qr-backdrop {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: var(--ls-primary-background-color, #fff);
    }

    .telepathy-qr-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 20px;
      font-family: var(--ls-font-family, sans-serif);
      color: var(--ls-primary-text-color, #222);
    }

    /*
     * A QR code must read dark on light. The generated PNG is transparent, so
     * the white plate behind it is what keeps the modules visible in dark mode.
     */
    .telepathy-qr-plate {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #ffffff;
      border-radius: 8px;
      line-height: 0;
    }

    .telepathy-qr-plate img {
      display: block;
      width: 320px;
      height: 320px;
    }

    .telepathy-qr-counter {
      font-size: 15px;
      font-variant-numeric: tabular-nums;
      color: var(--ls-secondary-text-color, #666);
    }

    .telepathy-qr-controls {
      display: flex;
      gap: 8px;
    }

    .telepathy-qr-controls button {
      min-width: 88px;
      padding: 6px 14px;
      font-size: 14px;
      font-family: inherit;
      color: var(--ls-primary-text-color, #222);
      background: var(--ls-secondary-background-color, #f0f0f0);
      border: 1px solid var(--ls-border-color, #ccc);
      border-radius: 6px;
      cursor: pointer;
    }

    .telepathy-qr-controls button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .telepathy-qr-error {
      padding: 20px;
      font-family: var(--ls-font-family, sans-serif);
      color: var(--ls-primary-text-color, #222);
    }
  `)

  logseq.App.registerPageMenuItem(MENU_ITEM_LABEL, ({ page }) => {
    void exportPage(page)
  })

  logseq.App.registerUIItem('toolbar', {
    key: 'telepathy-qr-export',
    template: `
      <a class="button" title="TelepathyQR" data-on-click="show">
        <span>📱</span>
      </a>
    `,
  })
}

logseq.ready(main).catch(console.error)