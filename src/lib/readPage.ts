/**
 * Reads the on-disk markdown for a page in a file based graph.
 *
 * Logseq stores file graph pages verbatim under `pages/<name>.md`, so we hand
 * the file to the QR encoder byte for byte instead of rebuilding markdown from
 * the block tree. Block uuids, `id::` properties and collapsed markers all
 * survive untouched, which is exactly what we want when the scanned text is
 * pasted into another notes app.
 *
 * Journals live in `journals/` instead of `pages/`, and Logseq's exact filename
 * escaping has shifted between versions (percent-encoding vs literal spaces,
 * first-letter capitalisation), so candidates are generated and the file
 * listing is used as a fallback rather than trusting one formula.
 */

const JOURNAL_ROOTS = ['pages', 'journals'] as const

const capitalize = (text: string): string =>
  text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)

/**
 * Every plausible file name for a page name. Logseq encodes namespaces as
 * `__` and percent-escapes the rest; whether it escapes with `encodeURI` or
 * `encodeURIComponent` differs between releases, and both the raw and the
 * capitalised spelling are in use.
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

/** Path candidates in the order we would like to hit them. */
const pathCandidates = (pageName: string): string[] => {
  const names = nameCandidates(pageName)
  const paths: string[] = []
  for (const name of names) {
    for (const root of JOURNAL_ROOTS) {
      paths.push(`${root}/${name}.md`)
    }
  }
  return paths
}

const fetchText = async (relativePath: string): Promise<string> => {
  const url = await logseq.Assets.makeUrl(relativePath)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${relativePath} responded with ${response.status}`)
  }
  return response.text()
}

/**
 * Two paths refer to the same page if they match after undoing every escaping
 * difference we know about: percent escapes, case, the namespace separator and
 * the extension.
 */
const normalise = (path: string): string => {
  const stripped = path
    // Drop the graph root and any leading separator so a listed file and a
    // bare page name reduce to the same string.
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
 * `listFilesOfCurrentGraph` is typed as always returning an array, but it
 * answers `null` when the graph cannot be walked, so the result is not trusted.
 */
const listPageFiles = async (): Promise<string[]> => {
  const files: unknown = await logseq.Assets.listFilesOfCurrentGraph('md')
  if (!Array.isArray(files)) return []

  return files
    .map((file) => (file as { path?: unknown }).path)
    .filter(
      (path): path is string =>
        typeof path === 'string' &&
        JOURNAL_ROOTS.some((root) => path.startsWith(`${root}/`)),
    )
}

/** Remembered hits, so paging and repeated exports do not re-probe. */
const resolvedPaths = new Map<string, string>()

/** Returns the path that worked alongside its contents. */
const tryPaths = async (
  paths: string[],
): Promise<{ path: string; text: string } | undefined> => {
  for (const path of paths) {
    try {
      return { path, text: await fetchText(path) }
    } catch {
      // try the next spelling
    }
  }
  return undefined
}

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
  const direct = await tryPaths(candidates)
  if (direct !== undefined) {
    resolvedPaths.set(pageName, direct.path)
    return direct.text
  }

  const target = normalise(`/${pageName}`)
  const listing = await listPageFiles()
  const match = listing.find((path) => normalise(path) === target)
  if (match === undefined) {
    throw new Error(
      `Could not locate "${pageName}" in this graph (tried ${candidates.length} paths, ${listing.length} files listed).`,
    )
  }

  resolvedPaths.set(pageName, match)
  return fetchText(match)
}