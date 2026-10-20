import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, type ExportOptions } from './options'
import { transformMarkdown } from './transform'

const withOptions = (patch: Partial<ExportOptions>): ExportOptions => ({
  ...DEFAULT_OPTIONS,
  ...patch,
})

const vaultRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../test/vault')
const pagesDir = join(vaultRoot, 'pages')
const expectedDir = join(vaultRoot, 'expected')
const optionsDir = join(vaultRoot, 'options')

/**
 * Fixtures live in a real, openable Logseq graph under `test/vault`:
 * `pages/` holds the inputs (browsable and editable in actual Logseq with the
 * plugin loaded), `expected/` the agreed outputs. A page's file name without
 * `.md` is its stem; `expected/<stem>.md` is tested with default options, and
 * every `options/<stem>.<tag>.json` pairs with `expected/<stem>.<tag>.md` for
 * a non-default option combination.
 */
describe('vault fixtures', () => {
  for (const page of readdirSync(pagesDir)) {
    if (!page.endsWith('.md')) continue
    const stem = page.slice(0, -'.md'.length)
    const input = readFileSync(join(pagesDir, page), 'utf8')

    const defaultExpected = join(expectedDir, page)
    if (existsSync(defaultExpected)) {
      it(`${page} with default options`, () => {
        expect(transformMarkdown(input, DEFAULT_OPTIONS)).toBe(readFileSync(defaultExpected, 'utf8'))
      })
    }

    for (const optionsFile of readdirSync(optionsDir)) {
      if (!optionsFile.startsWith(`${stem}.`) || !optionsFile.endsWith('.json')) continue
      const tag = optionsFile.slice(stem.length + 1, -'.json'.length)
      const options = withOptions(
        JSON.parse(readFileSync(join(optionsDir, optionsFile), 'utf8')) as Partial<ExportOptions>,
      )
      it(`${page} with options tag ${tag}`, () => {
        expect(transformMarkdown(input, options)).toBe(
          readFileSync(join(expectedDir, `${stem}.${tag}.md`), 'utf8'),
        )
      })
    }
  }
})

describe('clean transform', () => {
  it('drops internal property lines and keeps user properties verbatim', () => {
    const input = '- a\nid:: x\ncollapsed:: true\nhl-color:: yellow\ncard-last-interval:: 3\nauthor:: me\n'
    expect(transformMarkdown(input, DEFAULT_OPTIONS)).toBe('- a\nauthor:: me\n')
  })

  it('never touches fenced code blocks', () => {
    const input = '```\n[[x]] id:: y ((z))\n```\n'
    expect(transformMarkdown(input, DEFAULT_OPTIONS)).toBe(input)
  })

  it('rewrites wiki links per mode', () => {
    const input = '[[A]] and [lbl]([[B]])\n'
    expect(transformMarkdown(input, withOptions({ wikiLinks: 'plain' }))).toBe('A and lbl\n')
    expect(transformMarkdown(input, withOptions({ wikiLinks: 'marked' }))).toBe('||A|| and ||lbl||\n')
    expect(transformMarkdown(input, withOptions({ wikiLinks: 'as-is' }))).toBe(input)
  })

  it('rewrites images per mode', () => {
    const input = 'a ![alt](p/q.png) and ![](p/r.png) b\n'
    expect(transformMarkdown(input, withOptions({ images: 'placeholder' }))).toBe(
      'a [image: alt] and [image: r.png] b\n',
    )
    expect(transformMarkdown(input, withOptions({ images: 'marked' }))).toBe('a ||alt|| and ||r.png|| b\n')
    // Removal deletes the token only; surrounding spacing is not reflowed.
    expect(transformMarkdown(input, withOptions({ images: 'remove' }))).toBe('a  and  b\n')
  })

  it('strips block refs and embeds with placeholders', () => {
    const input = '- ((11111111-2222-3333-4444-555555555555)) {{embed [[P]]}} {{embed ((u))}}\n'
    expect(transformMarkdown(input, DEFAULT_OPTIONS)).toBe(
      '- [block reference] [embed: P] [embed: block reference]\n',
    )
  })

  it('converts task markers only in checkbox mode, CANCELED stays a word', () => {
    const input = '- TODO x\n- DONE y\n- CANCELED z\n- NOW w\n'
    expect(transformMarkdown(input, withOptions({ tasks: 'logseq' }))).toBe(input)
    expect(transformMarkdown(input, withOptions({ tasks: 'checkbox' }))).toBe(
      '- [ ] x\n- [x] y\n- CANCELED z\n- [ ] w\n',
    )
  })

  it('handles external links per mode, including file URLs and bare URLs', () => {
    const input = '[the docs](https://example.com/docs) bare https://example.com and file:///C:/a.md\n'
    expect(transformMarkdown(input, withOptions({ externalLinks: 'markdown' }))).toBe(
      '[the docs](https://example.com/docs) bare [https://example.com](https://example.com) and [file:///C:/a.md](file:///C:/a.md)\n',
    )
    expect(transformMarkdown(input, withOptions({ externalLinks: 'plain' }))).toBe(
      'https://example.com/docs bare https://example.com and file:///C:/a.md\n',
    )
  })

  it('leaves non-external markdown links alone', () => {
    const input = '[some page](relative page) and [mail](mailto:a@b.c)\n'
    expect(transformMarkdown(input, DEFAULT_OPTIONS)).toBe(input)
  })

  it('returns raw flavor untouched', () => {
    const input = '- [[x]]\nid:: y\n'
    expect(transformMarkdown(input, withOptions({ flavor: 'raw' }))).toBe(input)
  })
})
