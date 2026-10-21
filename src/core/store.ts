import { createStore } from '@xstate/store'
import { DEFAULT_OPTIONS, type ExportOptions } from './options'
import { paginate } from './paginate'
import { transformMarkdown } from './transform'

/**
 * The export session store, composed from three slices (DESIGN.md §7):
 *
 * - `config`  — what the user chose on the Config stage.
 * - `session` — the in-flight export: source text, parts, encoded images, page index.
 * - `nav`     — which wizard stage is on screen.
 *
 * Each slice owns its context keys and the pure handlers for its events; the
 * `createStore` call at the bottom is the composition root, which is also where
 * the few cross-slice rules live (part 0 arriving flips the stage to `qr`,
 * `open`/`close` reset everything).
 */

export type PreviewSource = 'example' | 'page'
export type QrTab = 'qr' | 'text' | 'rendered'
export type Stage = 'config' | 'qr'

/* ------------------------------------------------------------------ config */

export interface ConfigSlice {
  options: ExportOptions
  previewSource: PreviewSource
}

const initialConfig = (): ConfigSlice => ({
  options: { ...DEFAULT_OPTIONS },
  previewSource: 'example',
})

const configHandlers = {
  setOption: (slice: ConfigSlice, event: { patch: Partial<ExportOptions> }): ConfigSlice => ({
    ...slice,
    options: { ...slice.options, ...event.patch },
  }),
  setPreviewSource: (slice: ConfigSlice, event: { previewSource: PreviewSource }): ConfigSlice => ({
    ...slice,
    previewSource: event.previewSource,
  }),
}

/* ----------------------------------------------------------------- session */

export interface SessionSlice {
  sourceText: string | null
  parts: string[]
  qrImages: (string | null)[]
  encodedCount: number
  index: number
  tab: QrTab
  generating: boolean
}

const initialSession = (): SessionSlice => ({
  sourceText: null,
  parts: [],
  qrImages: [],
  encodedCount: 0,
  index: 0,
  tab: 'qr',
  generating: false,
})

const sessionHandlers = {
  open: (_slice: SessionSlice, event: { sourceText: string | null }): SessionSlice => ({
    ...initialSession(),
    sourceText: event.sourceText,
  }),
  generate: (slice: SessionSlice & ConfigSlice): SessionSlice => {
    const parts = paginate(transformMarkdown(slice.sourceText ?? '', slice.options))
    return {
      ...slice,
      parts,
      qrImages: parts.map(() => null),
      encodedCount: 0,
      index: 0,
      tab: 'qr',
      generating: true,
    }
  },
  partEncoded: (slice: SessionSlice, event: { index: number; dataUrl: string }): SessionSlice => {
    if (event.index >= slice.parts.length) return slice
    const qrImages = slice.qrImages.slice()
    qrImages[event.index] = event.dataUrl
    return {
      ...slice,
      qrImages,
      encodedCount: Math.max(slice.encodedCount, event.index + 1),
      generating: event.index === 0 ? false : slice.generating,
    }
  },
  prev: (slice: SessionSlice): SessionSlice => ({ ...slice, index: Math.max(0, slice.index - 1) }),
  next: (slice: SessionSlice): SessionSlice =>
    slice.parts.length === 0 || slice.encodedCount < slice.parts.length
      ? slice
      : { ...slice, index: Math.min(slice.parts.length - 1, slice.index + 1) },
  setTab: (slice: SessionSlice, event: { tab: QrTab }): SessionSlice => ({ ...slice, tab: event.tab }),
}

/* --------------------------------------------------------------------- nav */

export interface NavSlice {
  stage: Stage
}

const initialNav = (): NavSlice => ({ stage: 'config' })

/* ------------------------------------------------------- composition root */

export type TelepathyContext = ConfigSlice & SessionSlice & NavSlice

export const telepathyStore = createStore({
  context: { ...initialConfig(), ...initialSession(), ...initialNav() },
  on: {
    open: (
      _ctx,
      event: { sourceText: string | null; savedOptions?: ExportOptions },
    ): TelepathyContext => ({
      ...initialConfig(),
      options: event.savedOptions ? { ...event.savedOptions } : { ...DEFAULT_OPTIONS },
      ...sessionHandlers.open(initialSession(), event),
      ...initialNav(),
    }),
    setOption: (ctx, event: { patch: Partial<ExportOptions> }) => ({
      ...ctx,
      ...configHandlers.setOption(ctx, event),
    }),
    setPreviewSource: (ctx, event: { previewSource: PreviewSource }) => ({
      ...ctx,
      ...configHandlers.setPreviewSource(ctx, event),
    }),
    generate: (ctx) => ({ ...ctx, ...sessionHandlers.generate(ctx) }),
    quickOpen: (
      _ctx,
      event: { sourceText: string; options: ExportOptions },
    ): TelepathyContext => {
      const config: ConfigSlice = { ...initialConfig(), options: event.options }
      const session = sessionHandlers.generate({
        ...initialSession(),
        sourceText: event.sourceText,
        ...config,
      })
      return { ...config, ...session, stage: 'qr' }
    },
    partEncoded: (ctx, event: { index: number; dataUrl: string }): TelepathyContext => ({
      ...ctx,
      ...sessionHandlers.partEncoded(ctx, event),
      // Cross-slice rule: the first encoded part is what navigates to the QR stage.
      stage: event.index === 0 ? 'qr' : ctx.stage,
    }),
    back: (ctx): TelepathyContext => ({ ...ctx, stage: 'config' }),
    // Cross-slice rule: prev on the first part is another way back to Config.
    prev: (ctx): TelepathyContext =>
      ctx.index === 0 ? { ...ctx, stage: 'config' } : { ...ctx, ...sessionHandlers.prev(ctx) },
    next: (ctx) => ({ ...ctx, ...sessionHandlers.next(ctx) }),
    setTab: (ctx, event: { tab: QrTab }) => ({ ...ctx, ...sessionHandlers.setTab(ctx, event) }),
    close: (): TelepathyContext => ({ ...initialConfig(), ...initialSession(), ...initialNav() }),
  },
})

export type TelepathyStore = typeof telepathyStore
