import type { Host } from '../src/core/host'
import { EXAMPLE_MD } from '../src/core/example'
import { DEFAULT_OPTIONS } from '../src/core/options'
import { toQrDataUrl } from '../src/core/qr'
import { cancelActiveGeneration } from '../src/core/runner'
import { telepathyStore, type QrTab } from '../src/core/store'

export const storyHost: Host = {
  close: () => {},
  toast: () => {},
  persistConfig: async () => {},
  loadSavedConfig: async () => ({
    options: { ...DEFAULT_OPTIONS },
    previewSource: 'example',
  }),
}

export const initializeConfigStage = (flavor: 'clean' | 'raw' = 'clean'): void => {
  cancelActiveGeneration()
  telepathyStore.send({ type: 'open', sourceText: EXAMPLE_MD })
  if (flavor === 'raw') telepathyStore.send({ type: 'setOption', patch: { flavor } })
}

const qrStoryText = [
  '# Q3 launch plan',
  '',
  'Scan each part in order to reconstruct this example project plan.',
  '',
  ...Array.from(
    { length: 42 },
    (_, index) =>
      `- Milestone ${index + 1}: Align the delivery team, verify the release checklist, and prepare stakeholder notes.`,
  ),
].join('\n')

export const initializeQrStage = async (tab: QrTab): Promise<void> => {
  cancelActiveGeneration()
  telepathyStore.send({ type: 'open', sourceText: qrStoryText })
  telepathyStore.send({ type: 'generate' })

  const { parts } = telepathyStore.getSnapshot().context
  await Promise.all(
    parts.map(async (part, index) => {
      const dataUrl = await toQrDataUrl(part)
      telepathyStore.send({ type: 'partEncoded', index, dataUrl })
    }),
  )
  telepathyStore.send({ type: 'setTab', tab })
}
