/**
 * The tiny seam between the platform-agnostic UI and the host environment.
 * `platform/logseq` implements it; a future Obsidian or browser-extension port
 * would implement the same two methods.
 */
export interface Host {
  /** Hide the plugin UI entirely. */
  close(): void
  /** Surface a transient message to the user. */
  toast(message: string, kind?: 'info' | 'success' | 'warning' | 'error'): void
}
