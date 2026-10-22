import '@logseq/libs'
import type { RefSource } from '../../core/refs'
import { topLevelRoots, type SelectionRoot } from '../../core/scope'

/**
 * Reads a page's markdown for export.
 *
 * Two strategies, in order:
 *
 * 1. The raw file from the graph directory. This is preferred because it is
 *    the page exactly as Logseq stores it, artifacts and all. It needs a
 *    reachable URL, which is not always available: `logseq.Assets.makeUrl`
 *    hands back an asset scheme that some host versions refuse to fetch, so a
 *    plain `file://` URL built from the graph path is tried as well.
 *
 * 2. The block tree, reassembled into markdown. This always works because it
 *    only uses the everyday editor API. It is not byte identical to the file:
 *    raw content markers survive, but page level properties and the original
 *    ordering of some metadata may not come through unchanged.
 */

const GRAPH_ROOTS = ['pages', 'journals'] as const

const capitalize = (text: string): string =>
  text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)

/**
 * Every plausible file name for a page name; Logseq encodes namespaces as
 * `__`. Percent-encoded variants are deliberately absent: `makeUrl` and
 * `fileUrl` both encode on their own, so pre-encoded candidates end up double
 * encoded and can never match a file on disk.
 */
const nameCandidates = (pageName: string): string[] => {
  const bases = new Set<string>([pageName.replace(/\//g, '__'), pageName])

  const names = new Set<string>()
  for (const base of bases) {
    names.add(base)
    names.add(capitalize(base))
  }
  return [...names]
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Reads any URL as text, trying `fetch` first and falling back to
 * XMLHttpRequest, since the asset scheme is not fetchable everywhere.
 *
 * Failures are tagged: `network:` means the scheme or origin was refused
 * (the route itself is unusable), a bare `HTTP n` means the route worked but
 * the candidate path does not exist.
 */
const readViaUrl = async (url: string): Promise<string> => {
  const failures: string[] = []

  try {
    const response = await fetch(url)
    if (response.ok) return await response.text()
    failures.push(`HTTP ${response.status}`)
  } catch (error) {
    failures.push(`network: ${describe(error)}`)
  }

  try {
    return await new Promise<string>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('GET', url, true)
      request.onload = () => {
        if (request.status === 0 || request.status < 400) {
          resolve(request.responseText)
        } else {
          reject(new Error(`HTTP ${request.status}`))
        }
      }
      request.onerror = () => reject(new Error('network: network error'))
      request.send()
    })
  } catch (error) {
    failures.push(`network: ${describe(error)}`)
  }

  throw new Error(failures.join('; '))
}

/** `file://` URL for a graph relative path, used when makeUrl is unusable. */
const fileUrl = async (relativePath: string): Promise<string> => {
  const graph = await logseq.App.getCurrentGraph()
  const root = typeof graph?.path === 'string' ? graph.path : undefined
  if (root === undefined) {
    throw new Error('no graph path')
  }

  const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const relative = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return encodeURI(`file:///${base}/${relative}`)
}

/**
 * Route viability, probed once per plugin session. Many Logseq desktops
 * refuse both `assets://` and `file://` from the plugin iframe; without this
 * gate every export would fire dozens of doomed network requests (and fill
 * the console with them) before falling back to the block tree.
 */
let assetSchemeUsable = true
let fileSchemeUsable = true

const isRouteFailure = (message: string): boolean =>
  message.split('; ').every((part) => part.startsWith('network:'))

const readFromDisk = async (pageName: string): Promise<string | undefined> => {
  if (!assetSchemeUsable && !fileSchemeUsable) return undefined

  const paths: string[] = []
  for (const name of nameCandidates(pageName)) {
    for (const root of GRAPH_ROOTS) {
      paths.push(`${root}/${name}.md`)
    }
  }

  const attempts: string[] = []

  for (const path of paths) {
    if (!assetSchemeUsable && !fileSchemeUsable) break

    if (assetSchemeUsable) {
      try {
        return await readViaUrl(await logseq.Assets.makeUrl(path))
      } catch (error) {
        const message = describe(error)
        if (isRouteFailure(message)) assetSchemeUsable = false
        else attempts.push(`${path} -> asset: ${message}`)
      }
    }

    if (fileSchemeUsable) {
      try {
        return await readViaUrl(await fileUrl(path))
      } catch (error) {
        const message = describe(error)
        if (isRouteFailure(message)) fileSchemeUsable = false
        else attempts.push(`${path} -> file: ${message}`)
      }
    }
  }

  if (attempts.length === 0) {
    console.warn(
      '[TelepathyQR] disk read unavailable in this environment (asset/file URLs refused); using the block tree reader.',
    )
  } else {
    console.warn('[TelepathyQR] disk read failed:', attempts.slice(0, 3))
  }
  return undefined
}

/**
 * Reassembles markdown from the block tree. Bullets are indented two spaces
 * per level, which every markdown reader nests correctly. TODO/DO markers and
 * collapse state are kept when Logseq exposes them.
 */
export const renderBlocks = (blocks: unknown[], depth = 0): string[] => {
  const lines: string[] = []
  const indent = '  '.repeat(depth)

  for (const block of blocks) {
    if (typeof block !== 'object' || block === null) continue

    const entity = block as Record<string, unknown>
    // `original` is the unparsed source line and keeps markdown syntax such as
    // [[links]] and ((refs)) intact; `content` is Logseq's parsed form.
    const raw = entity['original'] ?? entity['content']
    const body = typeof raw === 'string' ? raw.trim() : ''

    const marker =
      typeof entity['marker'] === 'string' ? entity['marker'] + ' ' : ''
    const collapsed = entity['collapsed?'] === true ? '\ncollapsed:: true' : ''

    if (body !== '' || collapsed !== '') {
      lines.push(`${indent}- ${marker}${body}${collapsed}`)
    }

    const children = entity['children']
    if (Array.isArray(children)) {
      lines.push(...renderBlocks(children, body === '' && collapsed === '' ? depth : depth + 1))
    }
  }

  return lines
}

const readFromBlocks = async (pageName: string): Promise<string> => {
  const blocks = await logseq.Editor.getPageBlocksTree(pageName)
  if (!Array.isArray(blocks)) {
    throw new Error('the editor returned no block tree')
  }

  const lines = renderBlocks(blocks)
  return lines.length > 0 ? lines.join('\n') + '\n' : ''
}

export const readPageMarkdown = async (pageName: string): Promise<string> => {
  const fromDisk = await readFromDisk(pageName)
  if (fromDisk !== undefined) return fromDisk

  // The disk route is a bonus, not a requirement, so fall through to the block
  // tree rather than reporting failure — but if that fails too, say why.
  try {
    return await readFromBlocks(pageName)
  } catch (error) {
    throw new Error(`no readable file on disk and the block tree failed: ${describe(error)}`)
  }
}

const childEntities = (block: unknown): Record<string, unknown>[] => {
  if (typeof block !== 'object' || block === null) return []
  const children = (block as Record<string, unknown>)['children']
  if (!Array.isArray(children)) return []
  return children.filter(
    (child): child is Record<string, unknown> => typeof child === 'object' && child !== null,
  )
}

const uuidsBelow = (block: unknown): string[] =>
  childEntities(block).flatMap((child) => {
    const uuid = child['uuid']
    return [...(typeof uuid === 'string' ? [uuid] : []), ...uuidsBelow(child)]
  })

interface BlockRoot extends SelectionRoot {
  lines: string[]
}

/** Fetches one block with its subtree; null when the block no longer exists. */
const fetchRoot = async (uuid: string): Promise<BlockRoot | null> => {
  const block = await logseq.Editor.getBlock(uuid, { includeChildren: true })
  if (typeof block !== 'object' || block === null) return null
  return {
    uuid,
    descendantUuids: uuidsBelow(block),
    // Rendered as its own tree at depth 0, so the root sits at level 0 wherever it lives.
    lines: renderBlocks([block]),
  }
}

export interface BlocksMarkdown {
  sourceText: string
  /** Roots that produced text, after roots nested in another root were dropped. */
  rootCount: number
}

/**
 * Markdown for the given blocks and their subtrees, in the order given. A
 * block nested inside another given block is rendered once, inside that block.
 */
export const readBlocksMarkdown = async (uuids: string[]): Promise<BlocksMarkdown> => {
  const fetched = await Promise.all(uuids.map(fetchRoot))
  const readable = fetched.filter((root): root is BlockRoot => root !== null)
  if (readable.length === 0) {
    throw new Error('could not read the block')
  }

  const roots = topLevelRoots(readable).filter((root) => root.lines.length > 0)
  const lines = roots.flatMap((root) => root.lines)
  return {
    sourceText: lines.length > 0 ? lines.join('\n') + '\n' : '',
    rootCount: roots.length,
  }
}

/** Content for block refs and embeds, read through the editor API. Unreadable targets count as missing. */
export const logseqRefSource: RefSource = {
  blockTree: async (uuid) => {
    try {
      const block = await logseq.Editor.getBlock(uuid, { includeChildren: true })
      if (typeof block !== 'object' || block === null) return null
      return renderBlocks([block]).join('\n')
    } catch {
      return null
    }
  },
  pageTree: async (name) => {
    try {
      const blocks = await logseq.Editor.getPageBlocksTree(name)
      return Array.isArray(blocks) ? renderBlocks(blocks).join('\n') : null
    } catch {
      return null
    }
  },
}

