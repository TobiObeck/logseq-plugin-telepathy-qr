import { describe, expect, it } from 'vitest'
import { EXAMPLE_TEXTS } from './example'
import { DEFAULT_OPTIONS, type ExportOptions } from './options'
import { effectiveSource } from './refs'
import { transformMarkdown } from './transform'

const output = (options: ExportOptions): string =>
  transformMarkdown(effectiveSource(EXAMPLE_TEXTS, options), options)

describe('example page', () => {
  it('resolves its refs and embeds through the same expander as a real page', () => {
    expect(EXAMPLE_TEXTS.expandedText).toContain('Referencing a block: resolved block ref content')
    expect(EXAMPLE_TEXTS.expandedText).toContain('Embedding a block: resolved block embed content')
    expect(EXAMPLE_TEXTS.expandedText).not.toContain('((6ad77db3')
  })

  it('leaves an inline page embed as a placeholder, since only whole-line page embeds expand', () => {
    expect(EXAMPLE_TEXTS.expandedText).toContain('Embedding a page: {{embed [[Daily Template]]}}')
    expect(output(DEFAULT_OPTIONS)).toContain('Embedding a page: [embed: Daily Template]')
  })

  it('keeps its raw source as Input, whatever the refs option', () => {
    expect(EXAMPLE_TEXTS.sourceText).toContain('((6ad77db3-76d9-4132-bc22-27e2a1acfd99))')
    expect(EXAMPLE_TEXTS.sourceText).toContain('{{embed [[Daily Template]]}}')
  })

  it('is fully processed under non-default options', () => {
    const chosen = { ...DEFAULT_OPTIONS, tasks: 'checkbox' as const, wikiLinks: 'marked' as const }
    const text = output(chosen)

    expect(text).toContain('  type:: meeting\n')
    expect(text).toContain('    - [ ] Review ||Export scope|| before Friday [#A]\n')
    expect(text).not.toContain('id::')
    expect(text).not.toContain('collapsed::')
  })

  const changes: [string, Partial<ExportOptions>][] = [
    ['Raw', { flavor: 'raw' }],
    ['Wiki links as-is', { wikiLinks: 'as-is' }],
    ['Wiki links marked', { wikiLinks: 'marked' }],
    ['Images removed', { images: 'remove' }],
    ['Images marked', { images: 'marked' }],
    ['Markdown checkboxes', { tasks: 'checkbox' }],
    ['Plain URLs', { externalLinks: 'plain' }],
    ['Refs stripped', { refs: 'strip' }],
  ]

  for (const [label, patch] of changes) {
    it(`changing "${label}" visibly changes the output`, () => {
      expect(output({ ...DEFAULT_OPTIONS, ...patch })).not.toBe(output(DEFAULT_OPTIONS))
    })
  }
})
