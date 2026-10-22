import type { ExportOptions } from './options'
import { FENCE } from './transform'

/**
 * Block references and embeds resolved to their content (DESIGN.md §4.5,
 * `refs: resolve`). Pure: the platform supplies content through `RefSource`.
 *
 * A ref `((uuid))` becomes the target's first line, as Logseq shows it. An
 * embed `{{embed …}}` of a block or a page brings in the whole content, placed
 * beneath its bullet.
 *
 * Depth is fixed at two levels. Content written in the page is level one;
 * content inside level-one content is level two. Anything deeper stays as
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
const BULLET = /^\s*[-*+]\s/
// Inline embeds of a block (group 1) or a page (group 2).
const EMBED = /\{\{embed\s+(?:\(\(([^)]+)\)\)|\[\[([^\]]+)\]\])\s*\}\}/g
// Inline block refs (group 1), and any other macro. Macros are consumed whole
// so refs inside `{{query …}}` are left alone.
const REF = /\(\(([^)]+)\)\)|\{\{[^}]*\}\}/g

const firstLine = (tree: string): string => tree.split('\n')[0].replace(/^\s*[-*+]\s+/, '').trim()

const leadingSpace = (line: string): string => line.slice(0, line.length - line.trimStart().length)

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

/** Inline block refs become the target's first line; missing targets stay as written. */
const resolveInlineRefs = async (text: string, source: RefSource, depth: number): Promise<string> => {
  if (depth <= 0) return text
  return replaceAsync(text, REF, async (match) => {
    const uuid = match[1]
    if (uuid === undefined) return match[0]
    const tree = await source.blockTree(uuid.trim())
    if (tree === null) return match[0]
    return resolveInlineRefs(firstLine(tree), source, depth - 1)
  })
}

/** The content an inline embed points at; null when the target is unreadable. */
const embedTree = (match: RegExpExecArray, source: RefSource): Promise<string | null> =>
  match[1] !== undefined
    ? source.blockTree(match[1].trim())
    : source.pageTree((match[2] ?? '').trim())

interface ExpandedLine {
  text: string
  /** Content of the embeds cut out of this line, to be placed beneath its bullet. */
  embeds: string[]
}

/** One line of outline text: inline embeds are cut out, and refs in what remains are resolved. */
const expandLine = async (line: string, source: RefSource, depth: number): Promise<ExpandedLine> => {
  const embeds: string[] = []
  let cut = false
  const remaining = await replaceAsync(line, EMBED, async (match) => {
    const tree = await embedTree(match, source)
    if (tree === null) return match[0]
    cut = true
    if (tree !== '') embeds.push(tree)
    return ''
  })

  const lead = leadingSpace(line)
  const text = cut
    ? lead + remaining.slice(lead.length).replace(/(\S) {2,}/g, '$1 ').trim()
    : remaining
  return { text: await resolveInlineRefs(text, source, depth), embeds }
}

/** A line that belongs to the block above it: indented deeper, and not a bullet, fence, or whole-line embed. */
const isContinuation = (line: string, indent: string): boolean =>
  line.trim() !== '' &&
  leadingSpace(line).length > indent.length &&
  !BULLET.test(line) &&
  !FENCE.test(line) &&
  !LINE_BLOCK_EMBED.test(line) &&
  !LINE_PAGE_EMBED.test(line)

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
 * embedded content at the line's indent; inline embeds place their content
 * beneath the bullet, after the block's own continuation lines. Fenced code is
 * left untouched.
 */
export const expandRefs = async (
  text: string,
  source: RefSource,
  depth = REF_DEPTH,
): Promise<string> => {
  if (depth <= 0) return text

  const lines = text.split('\n')
  const out: string[] = []
  let inFence = false
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
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

    const indent = leadingSpace(line)
    const first = await expandLine(line, source, depth)
    out.push(first.text)
    const embeds = [...first.embeds]

    let next = index + 1
    while (next < lines.length && isContinuation(lines[next], indent)) {
      const part = await expandLine(lines[next], source, depth)
      out.push(part.text)
      embeds.push(...part.embeds)
      next++
    }
    index = next - 1

    for (const tree of embeds) {
      const body = await expandRefs(tree, source, depth - 1)
      out.push(...body.split('\n').map((bodyLine) => indent + '  ' + bodyLine))
    }
  }
  return out.join('\n')
}
