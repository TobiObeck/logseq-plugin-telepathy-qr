import type { ExportOptions } from './options'
import type { PreviewSource } from './store'

/**
 * The tiny seam between the platform-agnostic UI and the host environment.
 * `platform/logseq` implements it; a future Obsidian or browser-extension port
 * would implement the same methods.
 */
export interface SavedConfig {
  options: ExportOptions
  previewSource: PreviewSource
}

export interface Host {
  /** Hide the plugin UI entirely. */
  close(): void
  /** Surface a transient message to the user. */
  toast(message: string, kind?: 'info' | 'success' | 'warning' | 'error'): void
  /** Persist the current export config (options + preview source) for this graph. */
  persistConfig(config: SavedConfig): Promise<void>
  /** Read previously persisted config for this graph; falls back to defaults. */
  loadSavedConfig(): Promise<SavedConfig>
}
