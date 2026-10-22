import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import logseqDevPlugin from 'vite-plugin-logseq'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string
}

/**
 * `vite-plugin-logseq` is still CommonJS. Depending on how Vite loads this
 * config, `import` yields either the function itself or the module namespace
 * wrapping it, so both shapes are handled here.
 */
const logseq = (): Plugin => {
  const imported = logseqDevPlugin as unknown
  const factory =
    typeof imported === 'function'
      ? imported
      : (imported as { default: () => Plugin }).default
  // Spread into a fresh object: the CommonJS export is not always writable,
  // and Vite assigns `name` onto plugins that do not declare one.
  return { ...factory() }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [logseq(), react()],
  // Build identity shown in the modal (src/ui/buildInfo.ts).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_STAMP__: JSON.stringify(new Date().toLocaleString('sv-SE')),
  },
  // Makes HMR available for development
  build: {
    target: 'esnext',
  },
})