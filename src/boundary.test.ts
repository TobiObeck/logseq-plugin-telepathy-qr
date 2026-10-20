import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The architecture boundary (DESIGN.md §8): `core` and `ui` must stay free of
 * Logseq imports so a future Obsidian plugin or browser extension can reuse
 * them. If oxlint grows a restricted-imports rule with per-glob overrides,
 * this test can be replaced by config; until then it is the enforcement.
 */
const srcRoot = fileURLToPath(new URL('.', import.meta.url))

const collectSourceFiles = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...collectSourceFiles(path))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path)
  }
  return out
}

describe('layer boundary', () => {
  for (const layer of ['core', 'ui'] as const) {
    it(`${layer} never imports @logseq/libs`, () => {
      for (const file of collectSourceFiles(join(srcRoot, layer))) {
        expect(readFileSync(file, 'utf8'), file).not.toMatch(/@logseq\/libs/)
      }
    })
  }
})
