import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readBlocksMarkdown, renderBlocks } from './readPage'

// The real module expects a plugin iframe (`self`); tests drive `logseq` directly.
vi.mock('@logseq/libs', () => ({}))

type Node = { uuid: string; original?: string; content?: string; children?: Node[]; [key: string]: unknown }

const nodes: Record<string, Node> = {}

const fixture = (node: Node): void => {
  nodes[node.uuid] = node
  for (const child of node.children ?? []) fixture(child)
}

beforeEach(() => {
  for (const key of Object.keys(nodes)) delete nodes[key]
  vi.stubGlobal('logseq', {
    Editor: {
      getBlock: vi.fn(async (uuid: string) => nodes[uuid] ?? null),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('renderBlocks', () => {
  it('indents two spaces per level', () => {
    const tree = [{ original: 'a', children: [{ original: 'b', children: [{ original: 'c' }] }] }]
    expect(renderBlocks(tree)).toEqual(['- a', '  - b', '    - c'])
  })

  it('keeps the TODO marker', () => {
    expect(renderBlocks([{ original: 'task', marker: 'TODO' }])).toEqual(['- TODO task'])
  })

  it('keeps the collapsed state', () => {
    expect(renderBlocks([{ original: 'folded', 'collapsed?': true }])).toEqual([
      '- folded\ncollapsed:: true',
    ])
  })

  it('prefers the original source over the parsed content', () => {
    expect(renderBlocks([{ original: '[[Link]]', content: 'Link' }])).toEqual(['- [[Link]]'])
  })

  it('renders children of an empty block at the same depth', () => {
    const tree = [{ original: '', children: [{ original: 'kept' }] }]
    expect(renderBlocks(tree)).toEqual(['- kept'])
  })

  it('renders a subtree at level 0 when it is passed alone', () => {
    const deep = { original: 'root', children: [{ original: 'child' }] }
    expect(renderBlocks([deep], 0)).toEqual(['- root', '  - child'])
  })
})

describe('readBlocksMarkdown', () => {
  it('renders a single block as a level-0 tree', async () => {
    fixture({
      uuid: 'zoom',
      original: 'focused',
      children: [{ uuid: 'z1', original: 'detail' }],
    })

    const result = await readBlocksMarkdown(['zoom'])
    expect(result).toEqual({ sourceText: '- focused\n  - detail\n', rootCount: 1 })
  })

  it('renders a block nested deep in the page at level 0', async () => {
    fixture({ uuid: 'deep', original: 'nested', children: [{ uuid: 'd1', original: 'under' }] })

    const result = await readBlocksMarkdown(['deep'])
    expect(result.sourceText).toBe('- nested\n  - under\n')
  })

  it('renders a parent once when its child is also selected', async () => {
    fixture({
      uuid: 'parent',
      original: 'parent',
      children: [
        { uuid: 'c1', original: 'child one' },
        { uuid: 'c2', original: 'child two' },
      ],
    })
    fixture({ uuid: 'c1', original: 'child one' })
    fixture({ uuid: 'c2', original: 'child two' })

    const result = await readBlocksMarkdown(['parent', 'c1', 'c2'])
    expect(result).toEqual({
      sourceText: '- parent\n  - child one\n  - child two\n',
      rootCount: 1,
    })
  })

  it('joins disjoint roots in the order given', async () => {
    fixture({ uuid: 'a', original: 'first' })
    fixture({ uuid: 'b', original: 'second' })

    const result = await readBlocksMarkdown(['b', 'a'])
    expect(result).toEqual({ sourceText: '- second\n- first\n', rootCount: 2 })
  })

  it('skips blocks that no longer exist', async () => {
    fixture({ uuid: 'alive', original: 'still here' })

    const result = await readBlocksMarkdown(['gone', 'alive'])
    expect(result).toEqual({ sourceText: '- still here\n', rootCount: 1 })
  })

  it('throws when none of the blocks can be read', async () => {
    await expect(readBlocksMarkdown(['gone'])).rejects.toThrow('could not read the block')
  })

  it('does not count a root that renders no text', async () => {
    fixture({ uuid: 'blank', original: '' })
    fixture({ uuid: 'real', original: 'text' })

    const result = await readBlocksMarkdown(['blank', 'real'])
    expect(result).toEqual({ sourceText: '- text\n', rootCount: 1 })
  })
})
