import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS } from './options'
import { telepathyStore } from './store'

const context = () => telepathyStore.getSnapshot().context

beforeEach(() => {
  telepathyStore.send({ type: 'close' })
})

describe('export session store', () => {
  it('starts on the config stage with code defaults', () => {
    const ctx = context()
    expect(ctx.stage).toBe('config')
    expect(ctx.options).toEqual(DEFAULT_OPTIONS)
    expect(ctx.parts).toEqual([])
  })

  it('generate builds parts but stays on config until part 0 arrives', () => {
    telepathyStore.send({ type: 'open', sourceText: 'one\ntwo\n' })
    telepathyStore.send({ type: 'generate' })
    expect(context().stage).toBe('config')
    expect(context().generating).toBe(true)
    expect(context().parts.length).toBeGreaterThanOrEqual(1)

    telepathyStore.send({ type: 'partEncoded', index: 0, dataUrl: 'data:image/png;base64,x' })
    expect(context().stage).toBe('qr')
    expect(context().generating).toBe(false)
    expect(context().encodedCount).toBe(1)
  })

  it('keeps next locked until every part is encoded', () => {
    // 2901 bytes on one line hard splits into two parts.
    telepathyStore.send({ type: 'open', sourceText: `${'x'.repeat(2901)}\n` })
    telepathyStore.send({ type: 'generate' })
    expect(context().parts.length).toBe(2)

    telepathyStore.send({ type: 'partEncoded', index: 0, dataUrl: 'a' })
    telepathyStore.send({ type: 'next' })
    expect(context().index).toBe(0) // still encoding part 2

    telepathyStore.send({ type: 'partEncoded', index: 1, dataUrl: 'b' })
    telepathyStore.send({ type: 'next' })
    expect(context().index).toBe(1)
    telepathyStore.send({ type: 'next' })
    expect(context().index).toBe(1) // clamped at the last part
  })

  it('prev on the first part returns to the config stage', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n' })
    telepathyStore.send({ type: 'generate' })
    telepathyStore.send({ type: 'partEncoded', index: 0, dataUrl: 'a' })
    expect(context().stage).toBe('qr')

    telepathyStore.send({ type: 'prev' })
    expect(context().stage).toBe('config')
    // The session survives the trip back: parts and options are kept.
    expect(context().parts.length).toBe(1)
  })

  it('back preserves options, close resets everything', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n' })
    telepathyStore.send({ type: 'setOption', patch: { wikiLinks: 'marked' } })
    telepathyStore.send({ type: 'generate' })
    telepathyStore.send({ type: 'partEncoded', index: 0, dataUrl: 'a' })
    telepathyStore.send({ type: 'back' })

    expect(context().stage).toBe('config')
    expect(context().options.wikiLinks).toBe('marked')

    telepathyStore.send({ type: 'close' })
    expect(context().options).toEqual(DEFAULT_OPTIONS)
    expect(context().parts).toEqual([])
    expect(context().stage).toBe('config')
  })

  it('open starts a fresh session from defaults', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n' })
    telepathyStore.send({ type: 'setOption', patch: { flavor: 'raw' } })
    telepathyStore.send({ type: 'open', sourceText: 'y\n' })
    expect(context().options).toEqual(DEFAULT_OPTIONS)
    expect(context().sourceText).toBe('y\n')
  })

  /* ----------------------------------------- saved options / quick export */

  it('open with savedOptions pre-selects them', () => {
    const saved: typeof DEFAULT_OPTIONS = { ...DEFAULT_OPTIONS, wikiLinks: 'marked', tasks: 'checkbox' }
    telepathyStore.send({ type: 'open', sourceText: 'x\n', savedOptions: saved })
    expect(context().options.wikiLinks).toBe('marked')
    expect(context().options.tasks).toBe('checkbox')
    expect(context().stage).toBe('config')
  })

  it('open without savedOptions uses DEFAULT_OPTIONS', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n', savedOptions: undefined })
    expect(context().options).toEqual(DEFAULT_OPTIONS)
  })

  it('quickOpen skips config and starts generating on qr', () => {
    const opts: typeof DEFAULT_OPTIONS = { ...DEFAULT_OPTIONS, wikiLinks: 'marked' }
    telepathyStore.send({ type: 'quickOpen', sourceText: 'hello\nworld\n', options: opts })
    expect(context().stage).toBe('qr')
    expect(context().options.wikiLinks).toBe('marked')
    expect(context().generating).toBe(true)
    expect(context().parts.length).toBeGreaterThanOrEqual(1)
  })

  it('quickOpen with defaults still generates', () => {
    telepathyStore.send({ type: 'quickOpen', sourceText: 'a\n', options: DEFAULT_OPTIONS })
    expect(context().stage).toBe('qr')
    expect(context().options).toEqual(DEFAULT_OPTIONS)
    expect(context().parts.length).toBeGreaterThanOrEqual(1)
  })
})
