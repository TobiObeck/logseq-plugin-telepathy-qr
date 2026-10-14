import { useEffect, useState, useSyncExternalStore } from 'react'
import { toQrDataUrl } from './lib/qr.ts'
import { qrStore } from './store.ts'

/**
 * Encoded codes are cached by content, so paging back and forth does not
 * re-run the encoder. `undefined` means "not encoded yet".
 */
const cache = new Map<string, string | null>()

/**
 * Renders a single QR code. Encoding is fast but not instant, so the plate
 * stays mounted while it runs rather than flashing empty.
 */
const QrCode = ({ text }: { text: string }) => {
  const [dataUrl, setDataUrl] = useState<string | null | undefined>(() =>
    cache.get(text),
  )

  useEffect(() => {
    if (cache.has(text)) return

    let active = true
    toQrDataUrl(text).then(
      (url) => {
        cache.set(text, url)
        if (active) setDataUrl(url)
      },
      (error) => {
        console.error('TelepathyQR failed to encode a part', error)
        cache.set(text, null)
        if (active) setDataUrl(null)
      },
    )

    return () => {
      active = false
    }
  }, [text])

  return (
    <div className="telepathy-qr-plate">
      {dataUrl === null ? (
        <p>This part could not be encoded.</p>
      ) : dataUrl === undefined ? (
        <img width={320} height={320} alt="" />
      ) : (
        <img src={dataUrl} width={320} height={320} alt="QR code" />
      )}
    </div>
  )
}

export default function App() {
  const { parts, index } = useSyncExternalStore(
    qrStore.subscribe,
    qrStore.get,
  )

  if (parts.length === 0) {
    return (
      <div className="telepathy-qr-error">
        Select &ldquo;Export page as QR code&rdquo; from a page menu.
      </div>
    )
  }

  const total = parts.length
  const current = parts[index] ?? parts[0]

  return (
    <div className="telepathy-qr-backdrop">
      <div className="telepathy-qr-panel">
        <QrCode key={index} text={current} />
        <p className="telepathy-qr-counter">
          {index + 1} / {total}
        </p>
        <div className="telepathy-qr-controls">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => qrStore.setIndex(index - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => qrStore.setIndex(index + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}