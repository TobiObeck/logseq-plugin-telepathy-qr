/**
 * Export scope (specs/export-scope.md §5.3, §5.4). Pure logic only; the
 * Logseq-facing readers that feed these functions live in platform/logseq.
 */

/** `page`: whole page. `focused`: zoomed bullet. `selection`: selected bullets. */
export type ExportScope = 'page' | 'focused' | 'selection'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ZOOM_ROUTE = new RegExp(`^#?/?page/(${UUID})/?$`, 'i')

/** The block uuid when the route is Logseq's zoom view (`/page/<uuid>`), else null. */
export const zoomedBlockUuidFromRoute = (path: string): string | null => {
  const match = ZOOM_ROUTE.exec(path)
  return match === null ? null : match[1]
}

/** A selected block plus the uuids of every block beneath it. */
export interface SelectionRoot {
  uuid: string
  descendantUuids: readonly string[]
}

/**
 * Drops roots that sit inside another selected root (their text is already in
 * that root's subtree) and duplicate roots. Input order is kept.
 */
export const topLevelRoots = <T extends SelectionRoot>(roots: readonly T[]): T[] => {
  const nested = new Set<string>()
  for (const root of roots) {
    for (const uuid of root.descendantUuids) nested.add(uuid)
  }

  const seen = new Set<string>()
  const kept: T[] = []
  for (const root of roots) {
    if (nested.has(root.uuid) || seen.has(root.uuid)) continue
    seen.add(root.uuid)
    kept.push(root)
  }
  return kept
}

/** Preview toggle label for the input source (specs/export-scope.md §3.3). */
export const scopeLabel = (scope: ExportScope, rootCount: number): string => {
  if (scope === 'page') return 'This page'
  if (scope === 'focused') return 'This bullet'
  return `Selection (${rootCount})`
}
