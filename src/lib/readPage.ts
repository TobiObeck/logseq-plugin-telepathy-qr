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
 * Every plausible file name for a page name. Logseq encodes namespaces as
 * `__` and percent-escapes the rest; whether it escapes with `encodeURI` or
 * `encodeURIComponent` differs between versions, and both the raw and the
 * capitalised spelling exist in the wild.
 */
const nameCandidates = (pageName: string): string[] => {
  const bases = new Set<string>([
    encodeURI(pageName).replace(/%2F/gi, '__'),
    encodeURIComponent(pageName).replace(/%2F/gi, '__'),
    pageName.replace(/\//g, '__'),
    pageName,
  ])

  const names = new Set<string>()
  for (const base of bases) {
    names.add(base)
    names.add(capitalize(base))
  }
  return [...names]
}

const pathCandidates = (pageName: string): string[] => {
  const paths: string[] = []
  for (const name of nameCandidates(pageName)) {
    for (const root of GRAPH_ROOTS) {
      paths.push(`${root}/${name}.md`)
    }
  }
  return paths
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Reads any URL as text, trying `fetch` first and falling back to
 * XMLHttpRequest, since the asset scheme is not fetchable everywhere.
 */
const readViaUrl = async (url: string): Promise<string> => {
  const failures: string[] = []

  try {
    const response = await fetch(url)
    if (response.ok) return await response.text()
    failures.push(`HTTP ${response.status}`)
  } catch (error) {
    failures.push(describe(error))
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
      request.onerror = () => reject(new Error('network error'))
      request.send()
    })
  } catch (error) {
    failures.push(describe(error))
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
  return `file:///${base}/${relative}`
}

const readFromDisk = async (pageName: string): Promise<string | undefined> => {
  const attempts: string[] = []

  for (const path of pathCandidates(pageName)) {
    try {
      return await readViaUrl(await logseq.Assets.makeUrl(path))
    } catch (assetError) {
      try {
        return await readViaUrl(await fileUrl(path))
      } catch (fileError) {
        attempts.push(`${path} -> asset: ${describe(assetError)} | file: ${describe(fileError)}`)
      }
    }
  }

  console.warn('[TelepathyQR] disk read failed:', attempts.slice(0, 3))
  return undefined
}

/**
 * Reassembles markdown from the block tree. Bullets are indented two spaces
 * per level, which every markdown reader nests correctly. TODO/DO markers and
 * collapse state are kept when Logseq exposes them.
 */
const renderBlocks = (blocks: unknown[], depth = 0): string[] => {
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
  // tree rather than reporting failure.
  return readFromBlocks(pageName)
}