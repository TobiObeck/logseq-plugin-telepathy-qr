import { toQrDataUrl } from './qr'
import type { TelepathyStore } from './store'

/**
 * Progressive encoding (DESIGN.md §6): part 0 is encoded first because its
 * arrival is what navigates to the QR stage; the remaining parts follow in a
 * sequential background loop, yielding between parts so the UI keeps painting
 * (and the spinner inside the Next button keeps spinning).
 *
 * One runner per generation; going back, closing, or regenerating cancels the
 * previous one, so a stale loop can never write into a newer session.
 */
export class ExportRunner {
  private cancelled = false

  cancel(): void {
    this.cancelled = true
  }

  async run(store: TelepathyStore, parts: string[]): Promise<void> {
    for (let index = 0; index < parts.length; index++) {
      if (this.cancelled) return
      const dataUrl = await toQrDataUrl(parts[index])
      if (this.cancelled) return
      store.send({ type: 'partEncoded', index, dataUrl })
    }
  }
}

let activeRunner: ExportRunner | null = null

export const startGeneration = (store: TelepathyStore): void => {
  store.send({ type: 'generate' })
  const { parts } = store.getSnapshot().context
  activeRunner?.cancel()
  activeRunner = new ExportRunner()
  void activeRunner.run(store, parts)
}

export const cancelActiveGeneration = (): void => {
  activeRunner?.cancel()
  activeRunner = null
}
