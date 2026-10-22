import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS } from './options'
import { effectiveSource, expandRefs, type RefSource } from './refs'

const sourceOf = (blocks: Record<string, string>, pages: Record<string, string> = {}): RefSource => ({
  blockTree: async (uuid) => blocks[uuid] ?? null,
  pageTree: async (name) => pages[name] ?? null,
})

describe('expandRefs', () => {
  it('replaces an inline ref with the target block text', async () => {
    const source = sourceOf({ a: '- alpha\n  - kid' })
    expect(await expandRefs('see ((a)) now', source)).toBe('see alpha now')
  })

  it('expands a whole-line block embed to its subtree at the line indent', async () => {
    const source = sourceOf({ a: '- alpha\n  - kid' })
    const page = '- Intro\n  - {{embed ((a))}}'
    expect(await expandRefs(page, source)).toBe('- Intro\n  - alpha\n    - kid')
  })

  it('expands a whole-line page embed to the page tree', async () => {
    const source = sourceOf({}, { Home: '- one\n- two' })
    expect(await expandRefs('- {{embed [[Home]]}}', source)).toBe('- one\n- two')
  })

  it('resolves two levels and leaves the third as written', async () => {
    const source = sourceOf({
      a: '- A\n  - {{embed ((b))}}',
      b: '- B\n  - {{embed ((c))}}',
      c: '- C',
    })
    expect(await expandRefs('{{embed ((a))}}', source)).toBe('- A\n  - B\n    - {{embed ((c))}}')
  })

  it('stops inline refs at the second level', async () => {
    const source = sourceOf({ a: 'A ((b))', b: 'B ((c))', c: 'C' })
    expect(await expandRefs('x ((a))', source)).toBe('x A B ((c))')
  })

  it("places an inline page embed's content beneath its bullet", async () => {
    const source = sourceOf({}, { 'Short content': '- one\n- two' })
    expect(await expandRefs('Here: {{embed [[Short content]] }} inline', source)).toBe(
      'Here: inline\n  - one\n  - two',
    )
  })

  it('places an inline block embed beneath its bullet', async () => {
    const source = sourceOf({ a: '- alpha' })
    expect(await expandRefs('- Embedding a block: {{embed ((a))}}', source)).toBe(
      '- Embedding a block:\n  - alpha',
    )
  })

  it('places embedded content after the bullet\'s own continuation lines', async () => {
    const source = sourceOf({}, { P: '- x' })
    expect(await expandRefs('- Here {{embed [[P]]}} or text\n  half line', source)).toBe(
      '- Here or text\n  half line\n  - x',
    )
  })

  it('expands several embeds on one line', async () => {
    const source = sourceOf({ a: '- alpha' }, { Home: '- one' })
    expect(await expandRefs('{{embed [[Home]]}} and {{embed ((a))}}', source)).toBe(
      'and\n  - one\n  - alpha',
    )
  })

  it('expands inline page embeds inside an embedded page at the second level only', async () => {
    const source = sourceOf({}, { A: '- x {{embed [[B]] }}', B: '- inner' })
    expect(await expandRefs('{{embed [[A]]}}', source)).toBe('- x\n  - inner')
  })

  it('keeps an inline page embed to a missing page as written', async () => {
    const source = sourceOf({})
    expect(await expandRefs('before {{embed [[Nowhere]]}} after', source)).toBe(
      'before {{embed [[Nowhere]]}} after',
    )
  })

  it('leaves fenced code untouched', async () => {
    const source = sourceOf({ a: 'alpha' })
    const page = '```\n((a))\n{{embed ((a))}}\n```'
    expect(await expandRefs(page, source)).toBe(page)
  })

  it('leaves non-embed macros untouched', async () => {
    const source = sourceOf({ a: 'alpha' })
    expect(await expandRefs('{{query ((a))}}', source)).toBe('{{query ((a))}}')
  })

  it('keeps refs to missing blocks and pages as written', async () => {
    const source = sourceOf({})
    const page = 'x ((gone))\n{{embed ((gone))}}\n{{embed [[Nowhere]]}}'
    expect(await expandRefs(page, source)).toBe(page)
  })

  it('terminates on a block that embeds itself', async () => {
    const source = sourceOf({ a: '- self {{embed ((a))}}' })
    const result = await expandRefs('{{embed ((a))}}', source)
    expect(result).toContain('self')
  })
})

describe('effectiveSource', () => {
  const texts = { sourceText: 'raw ((a))', expandedText: 'raw alpha' }

  it('uses the resolved text in Clean mode with resolve', () => {
    expect(effectiveSource(texts, { ...DEFAULT_OPTIONS, refs: 'resolve' })).toBe('raw alpha')
  })

  it('uses the raw text with strip', () => {
    expect(effectiveSource(texts, { ...DEFAULT_OPTIONS, refs: 'strip' })).toBe('raw ((a))')
  })

  it('uses the raw text in Raw mode, whatever the refs option', () => {
    expect(
      effectiveSource(texts, { ...DEFAULT_OPTIONS, flavor: 'raw', refs: 'resolve' }),
    ).toBe('raw ((a))')
  })

  it('falls back to the empty string when there is no source', () => {
    expect(effectiveSource({ sourceText: null, expandedText: null }, DEFAULT_OPTIONS)).toBe('')
  })
})
