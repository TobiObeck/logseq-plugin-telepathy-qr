import { useSelector } from '@xstate/store-react'
import { useRef, type UIEvent } from 'react'
import type { Host } from '../core/host'
import { EXAMPLE_MD } from '../core/example'
import type { ExportOptions } from '../core/options'
import { startGeneration } from '../core/runner'
import { telepathyStore } from '../core/store'
import { transformMarkdown } from '../core/transform'
import { Segmented } from './Segmented'

/**
 * Wizard step 1 (DESIGN.md §2.2): option rows on top, the Clean sub-settings
 * nested under them, then the two live preview columns and the confirm button.
 */
export const ConfigStage = ({ host }: { host: Host }) => {
  const ctx = useSelector(telepathyStore, (snapshot) => snapshot.context)
  const options = ctx.options
  const raw = options.flavor === 'raw'

  const set = (patch: Partial<ExportOptions>) => telepathyStore.send({ type: 'setOption', patch })

  const input = ctx.previewSource === 'example' ? EXAMPLE_MD : (ctx.sourceText ?? '')
  const output = transformMarkdown(input, options)

  const handleGenerate = () => {
    void host.persistConfig({ options: ctx.options, previewSource: ctx.previewSource })
    startGeneration(telepathyStore)
  }

  // Input on top, output below, scrolling in lockstep: scrolling either panel
  // copies its scrollTop to the other. The lock ref swallows the programmatic
  // scroll event of the synced panel so the two handlers cannot feed each
  // other into a loop.
  const inputRef = useRef<HTMLPreElement>(null)
  const outputRef = useRef<HTMLPreElement>(null)
  const scrollLock = useRef<'input' | 'output' | null>(null)

  const syncScroll =
    (source: 'input' | 'output') => (event: UIEvent<HTMLPreElement>) => {
      const other = source === 'input' ? 'output' : 'input'
      if (scrollLock.current === other) {
        scrollLock.current = null
        return
      }
      scrollLock.current = source
      const target = source === 'input' ? outputRef.current : inputRef.current
      if (target !== null) target.scrollTop = event.currentTarget.scrollTop
    }

  return (
    <>
      <div className="tq-options">
        <div className="tq-opt-row">
          <span className="tq-opt-label">Flavor</span>
          <Segmented
            value={options.flavor}
            onChange={(flavor) => set({ flavor })}
            choices={[
              { value: 'raw', label: 'Raw file' },
              { value: 'clean', label: 'Clean' },
            ]}
          />
        </div>
        <div className="tq-nested">
          <div className="tq-opt-row">
            <span className="tq-opt-label">Wiki links</span>
            <Segmented
              value={options.wikiLinks}
              onChange={(wikiLinks) => set({ wikiLinks })}
              disabled={raw}
              choices={[
                { value: 'as-is', label: 'As-is' },
                { value: 'plain', label: 'Plain text' },
                { value: 'marked', label: '||marked||' },
              ]}
            />
          </div>
          <div className="tq-opt-row">
            <span className="tq-opt-label">Images</span>
            <Segmented
              value={options.images}
              onChange={(images) => set({ images })}
              disabled={raw}
              choices={[
                { value: 'placeholder', label: 'Placeholder' },
                { value: 'remove', label: 'Remove' },
                { value: 'marked', label: '||marked||' },
              ]}
            />
          </div>
          <div className="tq-opt-row">
            <span className="tq-opt-label">Tasks</span>
            <Segmented
              value={options.tasks}
              onChange={(tasks) => set({ tasks })}
              disabled={raw}
              choices={[
                { value: 'logseq', label: 'Logseq markers' },
                { value: 'checkbox', label: 'Markdown checkboxes' },
              ]}
            />
          </div>
          <div className="tq-opt-row">
            <span className="tq-opt-label">External links</span>
            <Segmented
              value={options.externalLinks}
              onChange={(externalLinks) => set({ externalLinks })}
              disabled={raw}
              choices={[
                { value: 'markdown', label: 'Markdown' },
                { value: 'plain', label: 'Plain URL' },
              ]}
            />
          </div>
          <div className="tq-opt-row">
            <span className="tq-opt-label">Refs / embeds</span>
            <Segmented
              value={options.refs}
              onChange={(refs) => set({ refs })}
              disabled={raw}
              choices={[
                { value: 'strip', label: 'Strip placeholder' },
                { value: 'resolve', label: 'Resolve', disabled: true, title: 'Coming soon (NTH feature)' },
              ]}
            />
          </div>
        </div>
      </div>

      <hr className="tq-hr-minimal" />

      <div className="tq-header-row">
        <div className="tq-header-preview">
          <span className="tq-opt-label">Preview</span>
          <Segmented
            value={ctx.previewSource}
            onChange={(previewSource) => telepathyStore.send({ type: 'setPreviewSource', previewSource })}
            choices={[
              { value: 'example', label: 'Example' },
              { value: 'page', label: 'This page' },
            ]}
          />
        </div>
        <div className="tq-col-head tq-head-label">Input</div>
      </div>

      <div className="tq-cols">
        <div className="tq-colwrap">
          <pre className="tq-col" ref={inputRef} onScroll={syncScroll('input')}>
            {input}
          </pre>
        </div>
        <div className="tq-col-head">Output</div>
        <div className="tq-colwrap">
          <pre className="tq-col" ref={outputRef} onScroll={syncScroll('output')}>
            {output}
          </pre>
        </div>
      </div>

      <div className="tq-footer">
        <button
          type="button"
          className="button is-primary"
          disabled={ctx.generating}
          onClick={handleGenerate}
        >
          {ctx.generating ? 'Generating…' : 'Generate QR Code(s)'}
        </button>
      </div>
    </>
  )
}
