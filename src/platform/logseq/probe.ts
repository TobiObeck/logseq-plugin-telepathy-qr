import '@logseq/libs'

/**
 * Dev-build-only instrumentation for the export-scope trial
 * (specs/export-scope.md §4). Registered from main.tsx behind
 * `import.meta.env.DEV`, so none of this ships.
 *
 * Everything logs with the `[TQ-PROBE]` prefix to the DevTools console;
 * copy the whole log block back into the design session after each
 * scenario. Scenario checklist:
 *
 *  1. Normal page → page menu → "(Dev) TQ probe: dump state".
 *  2. Click a bullet dot (zoom in) → dump state again.
 *  3. Zoom back out → dump state again.
 *  4. Click a block reference ((uuid)) → dump state (does the route also
 *     become /page/<uuid>? Distinguishes zoom from ref navigation).
 *  5. Select several blocks (shift-click / drag, blue highlight) →
 *     right-click ON THE BLUE area → does "(Dev) TQ probe block" appear?
 *     Click it → note where the item showed up and copy the log.
 *  6. Right-click directly on a bullet DOT → does the item appear? Do the
 *     bullet and its children turn blue? Click it → copy the log.
 *  7. Right-click on block content (not the dot, nothing selected) →
 *     does the item appear?
 *  8. Select plain text inside a block → right-click → does
 *     "(Dev) TQ probe highlight" appear? (Expected: no — PDF only.)
 *  9. Optional: open a PDF, select a highlight → right-click → does the
 *     highlight item appear there?
 *
 * `onRouteChanged` payloads are logged automatically the whole time —
 * just perform the navigation steps with the DevTools console open.
 */

const P = '[TQ-PROBE]'

type AnyBlock = Record<string, unknown>

/** Latest route seen via onRouteChanged (payload kept raw — the runtime
 *  forwards more fields than the {path, template} type declares). */
const lastRoute: { raw?: unknown } = {}

const summarize = (b: unknown): Record<string, unknown> | null => {
  if (typeof b !== 'object' || b === null) return null
  const block = b as AnyBlock
  const parent = block['parent'] as { id?: unknown } | undefined
  return {
    uuid: block['uuid'],
    id: block['id'],
    format: block['format'],
    original: typeof block['original'] === 'string' ? String(block['original']).slice(0, 80) : undefined,
    content: typeof block['content'] === 'string' ? String(block['content']).slice(0, 80) : undefined,
    parentId: parent?.id,
    order: block['order'],
    childrenField: block['children'] === undefined ? 'absent' : Array.isArray(block['children']) ? `array(${block['children'].length})` : typeof block['children'],
  }
}

const dumpSelectedBlocks = async (): Promise<void> => {
  let selected: unknown
  try {
    selected = await logseq.Editor.getSelectedBlocks()
  } catch (error) {
    console.log(P, 'getSelectedBlocks threw:', error)
    return
  }
  if (!Array.isArray(selected)) {
    console.log(P, 'getSelectedBlocks →', selected)
    return
  }
  console.log(P, `getSelectedBlocks → ${selected.length} block(s), in returned order:`)
  for (const block of selected) console.log(P, '  selected:', summarize(block))
}

const dumpParentDom = (): void => {
  try {
    const parent = window.parent
    console.log(P, 'parent.location.hash →', parent.location.hash)
    const doc = parent.document
    const selectedEls = doc.querySelectorAll('.ls-block.selected')
    console.log(
      P,
      `DOM .ls-block.selected → ${selectedEls.length}`,
      Array.from(selectedEls)
        .slice(0, 10)
        .map((el) => el.getAttribute('blockid')),
    )
    const anySelected = doc.querySelectorAll('.selected')
    console.log(P, `DOM .selected (any) → ${anySelected.length}`)
    const zoomish = doc.querySelectorAll('[class*="zoom"], [class*="breadcrumb"]')
    console.log(
      P,
      `DOM [class*=zoom|breadcrumb] → ${zoomish.length}`,
      Array.from(zoomish)
        .slice(0, 10)
        .map((el) => el.getAttribute('class')),
    )
    const main = doc.querySelector('#main-content-container')
    const blockEls = main?.querySelectorAll('.ls-block[blockid]') ?? []
    console.log(
      P,
      `DOM first 5 blockids under #main-content-container (of ${blockEls.length}) →`,
      Array.from(blockEls)
        .slice(0, 5)
        .map((el) => el.getAttribute('blockid')),
    )
  } catch (error) {
    console.log(P, 'parent DOM probe threw (cross-origin?):', error)
  }
}

const dumpState = async (): Promise<void> => {
  console.log(P, '===== STATE DUMP =====')
  console.log(P, 'last onRouteChanged payload →', JSON.stringify(lastRoute.raw))
  dumpParentDom()
  try {
    const page = await logseq.Editor.getCurrentPage()
    console.log(P, 'getCurrentPage →', summarize(page))
  } catch (error) {
    console.log(P, 'getCurrentPage threw:', error)
  }
  try {
    const editing = await logseq.Editor.checkEditing()
    console.log(P, 'checkEditing →', editing)
  } catch (error) {
    console.log(P, 'checkEditing threw:', error)
  }
  await dumpSelectedBlocks()
  console.log(P, '===== END DUMP =====')
}

export const registerDevProbes = (): void => {
  logseq.App.onRouteChanged((payload) => {
    lastRoute.raw = payload
    console.log(P, 'onRouteChanged →', JSON.stringify(payload))
  })

  logseq.App.registerPageMenuItem('(Dev) TQ probe: dump state', () => {
    void dumpState()
  })

  logseq.Editor.registerBlockContextMenuItem('(Dev) TQ probe block', async (e) => {
    console.log(P, '===== BLOCK CONTEXT MENU FIRED =====')
    console.log(P, 'callback uuid →', e.uuid)
    await dumpSelectedBlocks()
    try {
      const block = await logseq.Editor.getBlock(e.uuid, { includeChildren: true })
      console.log(P, 'getBlock(includeChildren) →', summarize(block))
      const children = (block as AnyBlock | null)?.['children']
      if (Array.isArray(children)) {
        console.log(P, `  ${children.length} child(ren); first child raw shape:`)
        console.log(P, '  child[0] →', summarize(children[0]))
        console.log(P, '  child[0] keys →', typeof children[0] === 'object' && children[0] !== null ? Object.keys(children[0] as object) : typeof children[0])
      }
    } catch (error) {
      console.log(P, 'getBlock threw:', error)
    }
    console.log(P, '===== END BLOCK CONTEXT MENU =====')
  })

  logseq.Editor.registerHighlightContextMenuItem(
    '(Dev) TQ probe highlight',
    (e) => {
      // Research says this placement is PDF-viewer-only; if it ever fires
      // for a block selection, that assumption is wrong for this host.
      console.log(P, 'highlight-context-menu fired (expected PDF-only!) payload →', JSON.stringify(e))
    },
    { clearSelection: false },
  )

  console.log(P, 'probes registered — scenario checklist in src/platform/logseq/probe.ts header')
}
