/**
 * The tiny seam between the platform-agnostic UI and the host environment.
 * `platform/logseq` implements it; a future Obsidian or browser-extension port
 * would implement the same methods.
 */
export interface Host {
  /** Hide the plugin UI entirely. */
  close(): void
  /** Surface a transient message to the user. */
  toast(message: string, kind?: 'info' | 'success' | 'warning' | 'error'): void
  /** Persist the current export options for this graph. */
  persistOptions(options: import('./options').ExportOptions): Promise<void>
  /** Read previously persisted options for this graph; falls back to defaults. */
  loadSavedOptions(): Promise<import('./options').ExportOptions>
}
