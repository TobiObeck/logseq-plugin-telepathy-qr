/** Injected by Vite `define` (see .config/vite.config.ts). */
declare const __APP_VERSION__: string
declare const __BUILD_STAMP__: string

/** Identifies the loaded build: package version, dev or production, and build time. */
export const BUILD_LABEL = `v${__APP_VERSION__} · ${import.meta.env.DEV ? 'dev' : 'build'} · ${__BUILD_STAMP__}`
