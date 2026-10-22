import '@logseq/libs'
import { zoomedBlockUuidFromRoute } from '../../core/scope'

/**
 * Zoom detection (specs/export-scope.md §5.1). The route cache is the primary
 * source. The parent window hash covers the time before the first route event,
 * since `onRouteChanged` only fires on changes.
 */
let lastRoutePath: string | undefined

export const watchRoute = (): void => {
  logseq.App.onRouteChanged(({ path }) => {
    lastRoutePath = path
  })
}

const parentHash = (): string | undefined => {
  try {
    return window.parent.location.hash
  } catch {
    // Cross-origin parent: the hash is not readable from the plugin iframe.
    return undefined
  }
}

/** The block uuid being zoomed into, or null when the page is not zoomed. */
export const getZoomedBlockUuid = (): string | null => {
  const path = lastRoutePath ?? parentHash()
  return path === undefined ? null : zoomedBlockUuidFromRoute(path)
}
