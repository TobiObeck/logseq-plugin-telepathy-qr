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

const fixturesRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../test/fixtures')

/**
 * Real-world and hand-written fixtures: `input.md` in, `expected.md` out, with
 * an optional `options.json` overriding the defaults. New fixtures are picked
 * up automatically — paste a page, agree on the expected output, done.
 */
describe('fixtures', () => {
  for (const name of readdirSync(fixturesRoot)) {
    const dir = join(fixturesRoot, name)
    const input = readFileSync(join(dir, 'input.md'), 'utf8')
    const expected = readFileSync(join(dir, 'expected.md'), 'utf8')
    const optionsPath = join(dir, 'options.json')
    const options = existsSync(optionsPath)
      ? withOptions(JSON.parse(readFileSync(optionsPath, 'utf8')) as Partial<ExportOptions>)
      : DEFAULT_OPTIONS

    it(name, () => {
      expect(transformMarkdown(input, options)).toBe(expected)
    })
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
