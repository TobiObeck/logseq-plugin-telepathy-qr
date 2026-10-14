/**
 * Reads the on-disk markdown for a page in a file based graph.
 *
 * Logseq stores file graph pages verbatim under `pages/<name>.md`, so we hand
 * the file to the QR encoder byte for byte instead of rebuilding markdown from
 * the block tree. Block uuids, `id::` properties and collapsed markers all
 * survive untouched, which is what we want when the scanned text is pasted
 * into another notes app.
 *
 * Journals live in `journals/` rather than `pages/`, and Logseq's filename
 * escaping has varied between releases, so several spellings are tried and the
 * graph's file listing is used as a backstop.
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

/**
 * Reads a URL as text. The asset scheme Logseq hands back is not fetchable
 * from every host version, so XMLHttpRequest and the plugin Request API are
 * kept as fallbacks. Failures are collected rather than thrown so the caller
 * can report what actually went wrong.
 */
const readViaUrl = async (url: string): Promise<string> => {
  const failures: string[] = []

  try {
    const response = await fetch(url)
    if (response.ok) return await response.text()
    failures.push(`fetch: HTTP ${response.status}`)
  } catch (error) {
    failures.push(`fetch: ${describe(error)}`)
  }

  try {
    return await new Promise<string>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('GET', url, true)
      request.onload = () => {
        if (request.status === 0 || request.status >= 200) {
          resolve(request.responseText)
        } else {
          reject(new Error(`HTTP ${request.status}`))
        }
      }
      request.onerror = () => reject(new Error('network error'))
      request.send()
    })
  } catch (error) {
    failures.push(`xhr: ${describe(error)}`)
  }

  throw new Error(failures.join('; '))
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const fetchText = async (relativePath: string): Promise<string> => {
  const url = await logseq.Assets.makeUrl(relativePath)
  return readViaUrl(url)
}

/**
 * Two paths refer to the same page if they match once every escaping
 * difference we know about is undone: the graph root, percent escapes, case,
 * the namespace separator and the extension.
 */
const normalise = (path: string): string => {
  const stripped = path
    .replace(/^\/?(pages|journals)\//i, '')
    .replace(/\.(md|org)$/i, '')

  const decoded = (() => {
    try {
      return decodeURIComponent(stripped)
    } catch {
      return stripped
    }
  })()

  return decoded
    .replace(/\\/g, '/')
    .replace(/__/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase()
}

/**
 * `listFilesOfCurrentGraph` is typed as always returning an array but answers
 * `null` or `[]` on some host versions, and it only matches when the extension
 * filter is passed as an array, so several call shapes are attempted.
 */
const listPageFiles = async (): Promise<string[]> => {
  const shapes: unknown[] = [['md'], 'md', undefined]

  for (const exts of shapes) {
    try {
      const files = await logseq.Assets.listFilesOfCurrentGraph(
        exts as string[] | undefined,
      )
      if (!Array.isArray(files)) continue

      const paths = files
        .map((file) => (file as { path?: unknown }).path)
        .filter(
          (path): path is string =>
            typeof path === 'string' &&
            GRAPH_ROOTS.some((root) => path.startsWith(`${root}/`)),
        )

      if (paths.length > 0) return paths
    } catch {
      // try the next call shape
    }
  }
  return []
}

/** Remembered hits, so repeated exports do not re-probe. */
const resolvedPaths = new Map<string, string>()

export const readPageMarkdown = async (pageName: string): Promise<string> => {
  const cached = resolvedPaths.get(pageName)
  if (cached !== undefined) {
    try {
      return await fetchText(cached)
    } catch {
      resolvedPaths.delete(pageName)
    }
  }

  const candidates = pathCandidates(pageName)
  const attempts: string[] = []

  for (const path of candidates) {
    try {
      const text = await fetchText(path)
      resolvedPaths.set(pageName, path)
      return text
    } catch (error) {
      attempts.push(`${path} -> ${describe(error)}`)
    }
  }

  const target = normalise(`/${pageName}`)
  const listing = await listPageFiles()
  const match = listing.find((path) => normalise(path) === target)
  if (match !== undefined) {
    resolvedPaths.set(pageName, match)
    return fetchText(match)
  }

  // Report the first couple of failures: whether the paths, the URL or the
  // scheme is at fault decides what to fix next.
  const detail = attempts.slice(0, 2).join(' | ') || 'no candidates'
  throw new Error(
    `could not read "${pageName}": tried ${candidates.length} paths, listed ${listing.length} files. ${detail}`,
  )
}