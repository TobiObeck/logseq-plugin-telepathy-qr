import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS } from './options'
import { transformMarkdown } from './transform'

const numbered = { ...DEFAULT_OPTIONS, numberedLists: 'numbered' as const }
const bullets = { ...DEFAULT_OPTIONS, numberedLists: 'bullets' as const }

const lines = (...rows: string[]): string => rows.join('\n') + '\n'

describe('numbered lists', () => {
  it('defaults to the numbered sub-setting', () => {
    expect(DEFAULT_OPTIONS.numberedLists).toBe('numbered')
  })

  it('renders numbered children as 1., 2., 3. and drops the property lines', () => {
    const input = lines(
      '- Three things about myself',
      '  - I like turtles',
      '    logseq.order-list-type:: number',
      '  - I liked birds',
      '    logseq.order-list-type:: number',
      '  - I like trains',
      '    logseq.order-list-type:: number',
    )
    expect(transformMarkdown(input, numbered)).toBe(
      lines(
        '- Three things about myself',
        '  1. I like turtles',
        '  2. I liked birds',
        '  3. I like trains',
      ),
    )
  })

  it('keeps bullets and drops the property lines in the bullets choice', () => {
    const input = lines(
      '- Three things about myself',
      '  - I like turtles',
      '    logseq.order-list-type:: number',
      '  - I liked birds',
      '    logseq.order-list-type:: number',
    )
    expect(transformMarkdown(input, bullets)).toBe(
      lines('- Three things about myself', '  - I like turtles', '  - I liked birds'),
    )
  })

  it('restarts a run after a non-numbered sibling', () => {
    const input = lines(
      '- Steps',
      '  - First',
      '    logseq.order-list-type:: number',
      '  - Plain note',
      '  - Second',
      '    logseq.order-list-type:: number',
      '  - Third',
      '    logseq.order-list-type:: number',
    )
    expect(transformMarkdown(input, numbered)).toBe(
      lines('- Steps', '  1. First', '  - Plain note', '  1. Second', '  2. Third'),
    )
  })

  it('cycles the marker with depth: 1., a., I., then 1. again', () => {
    const input = lines(
      '- Parent',
      '  logseq.order-list-type:: number',
      '  - One',
      '    logseq.order-list-type:: number',
      '    - Sub one',
      '      logseq.order-list-type:: number',
      '      - Deep one',
      '        logseq.order-list-type:: number',
      '      - Deep two',
      '        logseq.order-list-type:: number',
      '    - Sub two',
      '      logseq.order-list-type:: number',
    )
    expect(transformMarkdown(input, numbered)).toBe(
      lines(
        '1. Parent',
        '  a. One',
        '    I. Sub one',
        '      1. Deep one',
        '      2. Deep two',
        '    II. Sub two',
      ),
    )
  })

  it('leaves Raw untouched, property lines included', () => {
    const input = lines(
      '- Three things about myself',
      '  - I like turtles',
      '    logseq.order-list-type:: number',
    )
    expect(transformMarkdown(input, { ...numbered, flavor: 'raw' })).toBe(input)
  })

  it('drops every logseq.* property line, not only the numbered one', () => {
    const input = lines('- Some block', '  logseq.color:: red', '  user:: kept')
    expect(transformMarkdown(input, bullets)).toBe(lines('- Some block', '  user:: kept'))
  })
})
