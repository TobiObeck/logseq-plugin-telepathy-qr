import { expandRefs, type RefSource, type SourceTexts } from './refs'

/**
 * The page shown in the Config stage preview when the source toggle is on
 * `Example` (DESIGN.md §2.2, Q36). It is a small, realistic Logseq page where
 * every option has something to act on: Raw keeps the internal properties,
 * Resolve expands the refs and embeds below, and the other options rewrite the
 * markup in place.
 */
export const EXAMPLE_MD = `- Weekly sync: Q4 planning
  type:: meeting
  - Links & WIKILINKS
    - Minutes: [shared doc](https://example.com/minutes) or https://example.com/roadmap
    - Board ![team board](../assets/board.png) and ![](../assets/unnamed.png)
    - Wikilinks: [[Meeting Notes]] or [the alias]([[Some Other Page]])
  - Agenda (attendees: **Tobi**, *Anna*, ~~Sam~~ and \`coder\`)
    - TODO Review [[Export scope]] before Friday [#A]
    - DONE Book the room
    - CANCELED Demo the old printer flow
  - Blocks Demo (refs & embeds)
    - Referencing a block: ((6ad77db3-76d9-4132-bc22-27e2a1acfd99))
    - Embedding a block: {{embed ((2c9f1e0a-5b7d-4e3a-9c1f-8d2b6a4e7f10))}}
    - Embedding a page: {{embed [[Daily Template]]}}
    - My Task Query: {{query (task TODO)}}
    - Long detail
      collapsed:: true
      - hidden child
    - Snippet:
      - \`\`\`js
        const link = '[[not-a-link]]'
        \`\`\`
`

/** The targets of the refs and embeds in EXAMPLE_MD. */
const EXAMPLE_BLOCKS: Record<string, string> = {
  '6ad77db3-76d9-4132-bc22-27e2a1acfd99': '- resolved block ref content',
  '2c9f1e0a-5b7d-4e3a-9c1f-8d2b6a4e7f10': '- resolved block embed content',
}

const EXAMPLE_PAGES: Record<string, string> = {
  'Daily Template': '- resolved page embed content',
}

const exampleRefs: RefSource = {
  blockTree: async (uuid) => EXAMPLE_BLOCKS[uuid] ?? null,
  pageTree: async (name) => EXAMPLE_PAGES[name] ?? null,
}

/**
 * The example as the preview sees it. Refs go through the same expander as a
 * real page, so the Resolve choice behaves the same way here.
 */
export const EXAMPLE_TEXTS: SourceTexts = {
  sourceText: EXAMPLE_MD,
  expandedText: await expandRefs(EXAMPLE_MD, exampleRefs),
}
