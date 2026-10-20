import { useSelector } from '@xstate/store-react'
import { renderMarkdown } from '../core/preview'
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
          {part === '' && <div className="tq-hint">Export is empty — check your options.</div>}
          <div className="tq-qr-plate">
            {image !== null && image !== undefined ? (
              <img src={image} alt={`QR part ${index + 1} of ${parts.length}`} />
            ) : (
              <div className="tq-qr-placeholder" />
            )}
          </div>
          <div className="tq-bottom">
            <button
              type="button"
              className="tq-navbtn"
              disabled={index === 0}
              onClick={() => telepathyStore.send({ type: 'prev' })}
            >
              ← Prev
            </button>
            <span className="tq-counter">
              {index + 1} / {parts.length}
            </span>
            <button
              type="button"
              className="tq-navbtn"
              disabled={encoding || index >= parts.length - 1}
              onClick={() => telepathyStore.send({ type: 'next' })}
            >
              {encoding && <span className="tq-spinner" aria-hidden="true" />}
              Next →
            </button>
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
    </>
  )
}
