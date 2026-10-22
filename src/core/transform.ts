import { isInternalPropertyKey } from './internalKeys'
import type { ExportOptions } from './options'

/**
 * The Clean transformer: markdown text in, reader-friendly markdown out.
 *
 * Rules (DESIGN.md §4): internal property lines are dropped, user property
 * lines kept verbatim, fenced code blocks never touched, outline shape
 * preserved, and inline syntax (embeds, refs, images, wiki links, external
 * links, task markers) rewritten per option.
 */

export const FENCE = /^\s*(?:[-*+]\s+)?(```|~~~)/
const PROPERTY_LINE = /^(\s*)([A-Za-z0-9_.-]+)::(?:[ \t](.*))?$/
const TASK_LINE = /^(\s*(?:[-*+]\s+)?)(TODO|DOING|NOW|LATER|WAITING|DONE|CANCELED)(?=\s)/

const EMBED_BLOCK_REF = /\{\{embed\s+\(\(([^)]+)\)\)\s*\}\}/g
const EMBED_PAGE = /\{\{embed\s+\[\[([^\]]+)\]\]\s*\}\}/g
// Non-embed macros ({{query …}}, {{renderer …}}) are untouched in v1
// (DESIGN.md §4.5), including any wiki links or refs inside them.
const MACRO = /\{\{[^}]*\}\}/g
// eslint-disable-next-line no-control-regex
const MACRO_TOKEN = /\u0001(\d+)\u0001/g
const BLOCK_REF = /\(\(([^)]+)\)\)/g
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g
const WIKI_ALIAS = /\[([^\]]*)\]\(\[\[([^\]]+)\]\]\)/g
const WIKI_BARE = /\[\[([^\]]+)\]\]/g
const MD_EXTERNAL_LINK = /\[([^\]]*)\]\(((?:https?:\/\/|file:\/\/\/)[^)\s]+)\)/g
const BARE_EXTERNAL_URL = /(?:https?:\/\/|file:\/\/\/)[^\s)\]]+/g
// Placeholder tokens use \u0000 as a sentinel: it cannot appear in note text,
// so protected markdown links survive the bare-URL pass untouched.
// eslint-disable-next-line no-control-regex
const TOKEN = /\u0000(\d+)\u0000/g

const basename = (path: string): string => path.split(/[\\/]/).pop() ?? path

const cleanLine = (line: string, options: ExportOptions): string => {
  let out = line

  out = out.replace(EMBED_BLOCK_REF, '[embed: block reference]')
  out = out.replace(EMBED_PAGE, '[embed: $1]')

  // Protect non-embed macro spans from every rewrite below.
  const macros: string[] = []
  out = out.replace(MACRO, (match) => {
    macros.push(match)
    return `\u0001${macros.length - 1}\u0001`
  })

  out = out.replace(BLOCK_REF, '[block reference]')

  out = out.replace(IMAGE, (_match, alt: string, path: string) => {
    const name = alt.trim() !== '' ? alt.trim() : basename(path)
    if (options.images === 'remove') return ''
    if (options.images === 'marked') return `||${name}||`
    return `[image: ${name}]`
  })

  if (options.wikiLinks !== 'as-is') {
    const render = (display: string): string =>
      options.wikiLinks === 'marked' ? `||${display}||` : display
    out = out.replace(WIKI_ALIAS, (_match, alias: string, page: string) =>
      render(alias.trim() !== '' ? alias.trim() : page),
    )
    out = out.replace(WIKI_BARE, (_match, page: string) => render(page))
  }

  if (options.tasks === 'checkbox') {
    out = out.replace(TASK_LINE, (match, pre: string, marker: string) => {
      if (marker === 'CANCELED') return match
      return marker === 'DONE' ? `${pre}[x]` : `${pre}[ ]`
    })
  }

  if (options.externalLinks === 'plain') {
    out = out.replace(MD_EXTERNAL_LINK, '$2')
  } else {
    // Protect markdown links while bare URLs are rewritten, so a URL that is
    // already link text is not wrapped a second time.
    const protectedLinks: string[] = []
    out = out.replace(MD_EXTERNAL_LINK, (match) => {
      protectedLinks.push(match)
      return `\u0000${protectedLinks.length - 1}\u0000`
    })
    out = out.replace(BARE_EXTERNAL_URL, (url) => `[${url}](${url})`)
    out = out.replace(TOKEN, (_match, index: string) => protectedLinks[Number(index)])
  }

  out = out.replace(MACRO_TOKEN, (_match, index: string) => macros[Number(index)])

  return out
}

const BULLET = /^(\s*)[-*+]\s/
const NUMBERED_KEY = 'logseq.order-list-type'
const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

const indentOf = (line: string): number => line.length - line.trimStart().length

const romanFor = (ordinal: number): string => {
  let rest = ordinal
  let out = ''
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol
      rest -= value
    }
  }
  return out
}

/** Marker of the nth item in a numbered run; the style cycles 1. → a. → I. → 1. with depth. */
const numberLabel = (ordinal: number, depth: number): string => {
  const style = (depth - 1) % 3
  if (style === 0) return `${ordinal}.`
  if (style === 1) return `${String.fromCharCode(97 + ((ordinal - 1) % 26))}.`
  return `${romanFor(ordinal)}.`
}

/** `untouched`: fence lines and the code inside them. `body`: only the code inside them. */
const fencedLines = (lines: string[]): { untouched: boolean[]; body: boolean[] } => {
  const untouched: boolean[] = []
  const body: boolean[] = []
  let inFence = false
  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence
      untouched.push(true)
      body.push(false)
    } else {
      untouched.push(inFence)
      body.push(inFence)
    }
  }
  return { untouched, body }
}

/** A bullet is numbered when a `logseq.order-list-type` line belongs to its own content. */
const isNumberedBlock = (lines: string[], index: number): boolean => {
  const bulletIndent = indentOf(lines[index])
  for (let next = index + 1; next < lines.length; next++) {
    const line = lines[next]
    if (line.trim() === '' || BULLET.test(line) || indentOf(line) <= bulletIndent) return false
    const property = PROPERTY_LINE.exec(line)
    if (property !== null && property[2] === NUMBERED_KEY) return true
  }
  return false
}

interface NumberingFrame {
  indent: number
  /** Numbered ancestors, counting this block when it is numbered. */
  depth: number
  /** Numbered children so far in the current run. */
  run: number
}

/** Marker for every numbered bullet, by line index. A run restarts after a non-numbered sibling. */
const numberLabels = (lines: string[], body: boolean[]): Map<number, string> => {
  const labels = new Map<number, string>()
  const stack: NumberingFrame[] = [{ indent: -1, depth: 0, run: 0 }]
  lines.forEach((line, index) => {
    if (body[index] || !BULLET.test(line)) return
    const indent = indentOf(line)
    while (stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack[stack.length - 1]
    if (isNumberedBlock(lines, index)) {
      parent.run += 1
      const depth = parent.depth + 1
      labels.set(index, numberLabel(parent.run, depth))
      stack.push({ indent, depth, run: 0 })
    } else {
      parent.run = 0
      stack.push({ indent, depth: parent.depth, run: 0 })
    }
  })
  return labels
}

export const transformMarkdown = (text: string, options: ExportOptions): string => {
  if (options.flavor === 'raw') return text

  const lines = text.split('\n')
  const { untouched, body } = fencedLines(lines)
  const labels =
    options.numberedLists === 'numbered' ? numberLabels(lines, body) : new Map<number, string>()

  const out: string[] = []
  lines.forEach((line, index) => {
    if (untouched[index]) {
      out.push(line)
      return
    }

    const property = PROPERTY_LINE.exec(line)
    if (property !== null && isInternalPropertyKey(property[2])) return

    const cleaned = cleanLine(line, options)
    const label = labels.get(index)
    out.push(label === undefined ? cleaned : cleaned.replace(BULLET, `$1${label} `))
  })

  return out.join('\n')
}
