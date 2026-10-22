/**
 * Export options and their v1 defaults.
 *
 * Defaults are code constants on purpose: persisted defaults arrive together
 * with the NTH "quick export" feature and its settings schema (DESIGN.md §11).
 */

export type Flavor = 'raw' | 'clean'
export type WikiLinkMode = 'as-is' | 'plain' | 'marked'
export type ImageMode = 'placeholder' | 'remove' | 'marked'
export type TaskMode = 'logseq' | 'checkbox'
export type ExternalLinkMode = 'markdown' | 'plain'
export type RefMode = 'strip' | 'resolve'

export interface ExportOptions {
  flavor: Flavor
  wikiLinks: WikiLinkMode
  images: ImageMode
  tasks: TaskMode
  externalLinks: ExternalLinkMode
  /** `resolve` expands block refs and embeds two levels deep (core/refs.ts). */
  refs: RefMode
}

export const DEFAULT_OPTIONS: ExportOptions = {
  flavor: 'clean',
  wikiLinks: 'plain',
  images: 'placeholder',
  tasks: 'logseq',
  externalLinks: 'markdown',
  refs: 'resolve',
}
