import { beforeEach, describe, expect, it } from 'vitest'
import type { SavedConfig } from './host'
import { DEFAULT_OPTIONS, type ExportOptions } from './options'
import { effectiveSource } from './refs'
import { telepathyStore } from './store'
import { transformMarkdown } from './transform'

const context = () => telepathyStore.getSnapshot().context

const savedCfg = (patch: { options?: Partial<ExportOptions>; previewSource?: 'example' | 'page' }): SavedConfig => ({
  options: { ...DEFAULT_OPTIONS, ...patch.options },
  previewSource: patch.previewSource ?? 'example',
})

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

  /* -------------------------------------- saved config / quick export */

  it('open with savedConfig pre-selects options and previewSource', () => {
    const saved = savedCfg({ options: { wikiLinks: 'marked', tasks: 'checkbox' }, previewSource: 'page' })
    telepathyStore.send({ type: 'open', sourceText: 'x\n', savedConfig: saved })
    expect(context().options.wikiLinks).toBe('marked')
    expect(context().options.tasks).toBe('checkbox')
    expect(context().previewSource).toBe('page')
    expect(context().stage).toBe('config')
  })

  it('open without savedConfig uses DEFAULT_OPTIONS and example preview', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n', savedConfig: undefined })
    expect(context().options).toEqual(DEFAULT_OPTIONS)
    expect(context().previewSource).toBe('example')
  })

  it('quickOpen skips config and starts generating on qr', () => {
    const cfg = savedCfg({ options: { wikiLinks: 'marked' } })
    telepathyStore.send({ type: 'quickOpen', sourceText: 'hello\nworld\n', config: cfg })
    expect(context().stage).toBe('qr')
    expect(context().options.wikiLinks).toBe('marked')
    expect(context().generating).toBe(true)
    expect(context().parts.length).toBeGreaterThanOrEqual(1)
  })

  it('quickOpen with defaults still generates', () => {
    const cfg = savedCfg({})
    telepathyStore.send({ type: 'quickOpen', sourceText: 'a\n', config: cfg })
    expect(context().stage).toBe('qr')
    expect(context().options).toEqual(DEFAULT_OPTIONS)
    expect(context().parts.length).toBeGreaterThanOrEqual(1)
    expect(context().scope).toBe('page')
  })

  it('quickOpen with a scope records it and goes straight to the QR stage', () => {
    const cfg = savedCfg({})
    telepathyStore.send({
      type: 'quickOpen',
      sourceText: 'a\n',
      config: cfg,
      scope: 'focused',
      scopeRoots: 1,
    })
    expect(context().stage).toBe('qr')
    expect(context().scope).toBe('focused')
    expect(context().generating).toBe(true)
  })

  /* ----------------------------------------------- export scope provenance */

  it('defaults the scope to the whole page with one root', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n' })
    expect(context().scope).toBe('page')
    expect(context().scopeRoots).toBe(1)
  })

  it('open records the scope and root count', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n', scope: 'selection', scopeRoots: 3 })
    expect(context().scope).toBe('selection')
    expect(context().scopeRoots).toBe(3)
  })

  it('keeps the scope through generate, back, and a fresh open', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n', scope: 'focused', scopeRoots: 1 })
    telepathyStore.send({ type: 'generate' })
    telepathyStore.send({ type: 'partEncoded', index: 0, dataUrl: 'a' })
    telepathyStore.send({ type: 'back' })
    expect(context().scope).toBe('focused')

    telepathyStore.send({ type: 'open', sourceText: 'y\n' })
    expect(context().scope).toBe('page')
  })

  it('close resets the scope to the whole page', () => {
    telepathyStore.send({ type: 'open', sourceText: 'x\n', scope: 'selection', scopeRoots: 2 })
    telepathyStore.send({ type: 'close' })
    expect(context().scope).toBe('page')
    expect(context().scopeRoots).toBe(1)
  })

  /* ---------------------------------------------- refs and empty sources */

  it('exports the resolved text under the resolve option', () => {
    telepathyStore.send({
      type: 'open',
      sourceText: 'see ((a))\n',
      expandedText: 'see alpha\n',
      savedConfig: savedCfg({ options: { refs: 'resolve' } }),
    })
    telepathyStore.send({ type: 'generate' })
    expect(context().parts.join('')).toContain('alpha')
    expect(context().parts.join('')).not.toContain('((a))')
  })

  it('exports the raw text under the strip option', () => {
    telepathyStore.send({
      type: 'open',
      sourceText: 'see ((a))\n',
      expandedText: 'see alpha\n',
      savedConfig: savedCfg({ options: { refs: 'strip' } }),
    })
    telepathyStore.send({ type: 'generate' })
    expect(context().parts.join('')).toContain('[block reference]')
  })

  it('encodes nothing for an empty source', () => {
    telepathyStore.send({ type: 'open', sourceText: '' })
    telepathyStore.send({ type: 'generate' })
    expect(context().parts).toEqual([])
    expect(context().generating).toBe(false)
  })

  it('encodes nothing when the options strip the whole source', () => {
    // Clean drops internal property lines, so this page exports as nothing.
    telepathyStore.send({ type: 'open', sourceText: 'id:: 11111111-2222-3333-4444-555555555555\n' })
    telepathyStore.send({ type: 'generate' })
    expect(context().parts).toEqual([])
    expect(context().generating).toBe(false)
  })

  /* ----------------------------------------- QR text equals the preview Output */

  it('the first QR part is the Output the Config preview shows', () => {
    const texts = {
      sourceText: '- I click ref\n  id:: 6ada5fa4-0a9a-4255-aeb7-b2f960d8c54d\n- Here is a reference: ((6ada5fa4-0a9a-4255-aeb7-b2f960d8c54d))\n',
      expandedText: '- I click ref\n  id:: 6ada5fa4-0a9a-4255-aeb7-b2f960d8c54d\n- Here is a reference: I click ref\n',
    }
    telepathyStore.send({ type: 'open', ...texts })
    telepathyStore.send({ type: 'generate' })

    const previewOutput = transformMarkdown(effectiveSource(texts, DEFAULT_OPTIONS), DEFAULT_OPTIONS)
    expect(context().parts[0]).toBe(previewOutput)
    expect(previewOutput).not.toContain('id::')
  })
})
