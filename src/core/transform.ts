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

const FENCE = /^\s*(?:[-*+]\s+)?(```|~~~)/
const PROPERTY_LINE = /^(\s*)([A-Za-z0-9_-]+)::(?:[ \t](.*))?$/
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

export const transformMarkdown = (text: string, options: ExportOptions): string => {
  if (options.flavor === 'raw') return text

  const lines = text.split('\n')
  const out: string[] = []
  let inFence = false

  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    const property = PROPERTY_LINE.exec(line)
    if (property !== null && isInternalPropertyKey(property[2])) continue

    out.push(cleanLine(line, options))
  }

  return out.join('\n')
}
