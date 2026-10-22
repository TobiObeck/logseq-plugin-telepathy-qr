/**
 * Property keys Logseq itself writes into markdown files. Lines carrying them
 * are noise for a reader on another device, so Clean mode drops them.
 *
 * Kept as one named constant so the list can grow without touching the
 * transformer; the fixture suite pins every entry.
 */

export const INTERNAL_PROPERTY_KEYS: ReadonlySet<string> = new Set([
  'id',
  'collapsed',
  'background-color',
  'custom_id',
  'macro_id',
])

export const INTERNAL_PROPERTY_PREFIXES: readonly string[] = ['hl-', 'card-', 'logseq.']

export const isInternalPropertyKey = (key: string): boolean =>
  INTERNAL_PROPERTY_KEYS.has(key) ||
  INTERNAL_PROPERTY_PREFIXES.some((prefix) => key.startsWith(prefix))
