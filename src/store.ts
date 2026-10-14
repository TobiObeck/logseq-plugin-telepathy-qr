import '@logseq/libs'

/**
 * The page menu item that triggers the export, registered by `main.tsx`.
 *
 * Logseq resolves it in its own "..." menu, and we need to confirm the exact
 * ordering (we expect it to land below the built-in `Export` entry).
 */
export const MENU_ITEM_LABEL = '📱 Export page as QR code'

export type Parts = string[]

/**
 * Module level state shared between the Logseq plugin model (which is created
 * outside of React) and the React tree. Deliberately tiny: we only ever need
 * "which parts to show" and "which one is current".
 */
type QrState = {
  parts: Parts
  index: number
}

let state: QrState = { parts: [], index: 0 }
const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

export const qrStore = {
  get: (): QrState => state,
  setParts: (parts: Parts) => {
    state = { parts, index: 0 }
    emit()
  },
  setIndex: (index: number) => {
    state = { ...state, index }
    emit()
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

/** Keeps the arrow keys / escape key usable while the modal is open. */
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    if (!logseq.isMainUIVisible || state.parts.length === 0) return

    if (event.key === 'Escape') {
      logseq.hideMainUI()
    } else if (event.key === 'ArrowRight') {
      qrStore.setIndex(Math.min(state.index + 1, state.parts.length - 1))
    } else if (event.key === 'ArrowLeft') {
      qrStore.setIndex(Math.max(state.index - 1, 0))
    }
  })
}