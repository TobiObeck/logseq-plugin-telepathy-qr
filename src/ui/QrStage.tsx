import { useSelector } from '@xstate/store-react'
import { renderMarkdown } from '../core/preview'
import { cancelActiveGeneration } from '../core/runner'
import { telepathyStore } from '../core/store'
import type { QrTab } from '../core/store'
import { Segmented } from './Segmented'

/**
 * Wizard step 2 (DESIGN.md §2.3): the QR plate with prev/counter/next, plus the
 * Text and Rendered views of exactly the payload the visible QR encodes.
 */
export const QrStage = () => {
  const ctx = useSelector(telepathyStore, (snapshot) => snapshot.context)
  const { parts, qrImages, encodedCount, index, tab } = ctx

  const encoding = encodedCount < parts.length
  const part = parts[index] ?? ''
  const image = qrImages[index]

  return (
    <>
      <div className="tq-tabs">
        <Segmented
          value={tab}
          onChange={(value: QrTab) => telepathyStore.send({ type: 'setTab', tab: value })}
          choices={[
            { value: 'qr', label: 'QR' },
            { value: 'text', label: 'Text' },
            { value: 'rendered', label: 'Rendered' },
          ]}
        />
      </div>

      {tab === 'qr' && (
        <div className="tq-qr-wrap">
          <div className="tq-qr-plate">
            {image !== null && image !== undefined ? (
              <img src={image} alt={`QR part ${index + 1} of ${parts.length}`} />
            ) : (
              <div className="tq-qr-placeholder" />
            )}
          </div>
        </div>
      )}

      {tab === 'text' && <pre className="tq-text-view">{part}</pre>}

      {tab === 'rendered' && (
        <div
          className="tq-rendered"
          // The Rendered pipeline sanitizes and never emits raw HTML, so this
          // injection is safe by construction (DESIGN.md §5).
          dangerouslySetInnerHTML={{ __html: renderMarkdown(part) }}
        />
      )}

      <div className="tq-bottom">
        <button
          type="button"
          className="button is-small tq-navbtn"
          onClick={() => {
            // Prev on the first part returns to the Config stage; a
            // generation still running must not write into it.
            if (index === 0) cancelActiveGeneration()
            telepathyStore.send({ type: 'prev' })
          }}
        >
          {index === 0 ? '← Back to config' : '← Previous'}
        </button>
        <span className="tq-counter">
          {index + 1} / {parts.length}
        </span>
        {index < parts.length - 1 ? (
          <button
            type="button"
            className="button is-small tq-navbtn"
            disabled={encoding}
            onClick={() => telepathyStore.send({ type: 'next' })}
          >
            {encoding && <span className="tq-spinner" aria-hidden="true" />}
            Next →
          </button>
        ) : (
          <span className="tq-nav-placeholder" aria-hidden="true" />
        )}
      </div>
    </>
  )
}
