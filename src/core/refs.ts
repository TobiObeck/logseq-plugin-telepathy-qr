import type { ExportOptions } from './options'
import { FENCE } from './transform'

/**
 * Block references and embeds resolved to their content (DESIGN.md §4.5,
 * `refs: resolve`). Pure: the platform supplies content through `RefSource`.
 *
 * Depth is fixed at two levels. A reference written in the page is level one;
 * a reference inside level-one content is level two. Anything deeper stays as
 * written, and the Clean transform turns it into a placeholder.
 */

export const REF_DEPTH = 2

export interface RefSource {
  /** The block and its subtree as bullet markdown at level 0, or null when unreadable. */
  blockTree(uuid: string): Promise<string | null>
  /** The whole page as bullet markdown at level 0, or null when unreadable. */
  pageTree(name: string): Promise<string | null>
}

/** Both texts of an export: the raw source and the source with refs resolved. */
export interface SourceTexts {
  sourceText: string | null
  expandedText: string | null
}

/** The text an export runs on: resolved refs only in Clean mode with `resolve` chosen. */
export const effectiveSource = (texts: SourceTexts, options: ExportOptions): string => {
  if (options.flavor === 'clean' && options.refs === 'resolve' && texts.expandedText !== null) {
    return texts.expandedText
  }
  return texts.sourceText ?? ''
}

// A whole line holding only an embed, optionally behind a bullet. Its indent
// is carried onto the expanded content.
const LINE_BLOCK_EMBED = /^(\s*)(?:[-*+]\s+)?\{\{embed\s+\(\(([^)]+)\)\)\s*\}\}\s*$/
const LINE_PAGE_EMBED = /^(\s*)(?:[-*+]\s+)?\{\{embed\s+\[\[([^\]]+)\]\]\s*\}\}\s*$/
// Left to right: block embed, page embed, bare block ref, then any other macro.
// Macros are consumed whole so refs inside `{{query …}}` are left alone.
const INLINE =
  /\{\{embed\s+\(\(([^)]+)\)\)\s*\}\}|\{\{embed\s+\[\[([^\]]+)\]\]\s*\}\}|\(\(([^)]+)\)\)|\{\{[^}]*\}\}/g

const firstLine = (tree: string): string => tree.split('\n')[0].replace(/^\s*[-*+]\s+/, '').trim()

const replaceAsync = async (
  text: string,
  pattern: RegExp,
  replacer: (match: RegExpExecArray) => Promise<string>,
): Promise<string> => {
  let out = ''
  let last = 0
  for (const match of text.matchAll(pattern)) {
    out += text.slice(last, match.index) + (await replacer(match))
    last = match.index + match[0].length
  }
  return out + text.slice(last)
}

/** The tree an inline match points at; null for other macros and for missing targets. */
const inlineTarget = async (match: RegExpExecArray, source: RefSource): Promise<string | null> => {
  if (match[2] !== undefined) return source.pageTree(match[2].trim())
  const uuid = match[1] ?? match[3]
  return uuid === undefined ? null : source.blockTree(uuid.trim())
}

/**
 * Inline refs and embeds become the target's first line; missing targets stay
 * as written.
 */
const expandInline = async (text: string, source: RefSource, depth: number): Promise<string> => {
  if (depth <= 0) return text
  return replaceAsync(text, INLINE, async (match) => {
    const tree = await inlineTarget(match, source)
    if (tree === null) return match[0]
    return expandInline(firstLine(tree), source, depth - 1)
  })
}

const resolveLineEmbed = async (
  line: string,
  source: RefSource,
): Promise<{ indent: string; tree: string } | null> => {
  const block = LINE_BLOCK_EMBED.exec(line)
  const page = block === null ? LINE_PAGE_EMBED.exec(line) : null
  const match = block ?? page
  if (match === null) return null

  const tree =
    block !== null
      ? await source.blockTree(match[2].trim())
      : await source.pageTree(match[2].trim())
  return tree === null || tree === '' ? null : { indent: match[1], tree }
}

/**
 * Resolves block refs and embeds in outline text. Whole-line embeds become the
 * embedded subtree at the line's indent; inline refs become the target's first
 * line. Fenced code is left untouched.
 */
export const expandRefs = async (
  text: string,
  source: RefSource,
  depth = REF_DEPTH,
): Promise<string> => {
  if (depth <= 0) return text

  const out: string[] = []
  let inFence = false
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    const embed = await resolveLineEmbed(line, source)
    if (embed !== null) {
      const body = await expandRefs(embed.tree, source, depth - 1)
      out.push(...body.split('\n').map((bodyLine) => embed.indent + bodyLine))
      continue
    }
    out.push(await expandInline(line, source, depth))
  }
  return out.join('\n')
}
