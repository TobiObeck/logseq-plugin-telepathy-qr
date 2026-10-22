import { useCallback, useEffect } from 'react'
import { useSelector } from '@xstate/store-react'
import type { Host } from '../core/host'
import { cancelActiveGeneration } from '../core/runner'
import { telepathyStore } from '../core/store'
import { ConfigStage } from './ConfigStage'
import { BUILD_LABEL } from './buildInfo'
import { QrStage } from './QrStage'

/**
 * The modal shell: dark backdrop, centered card, wizard stage switching, and
 * the keyboard contract (Esc closes everywhere, arrows paginate on the QR
 * stage only).
 */
export const App = ({ host }: { host: Host }) => {
  const stage = useSelector(telepathyStore, (snapshot) => snapshot.context.stage)

  const close = useCallback(() => {
    cancelActiveGeneration()
    telepathyStore.send({ type: 'close' })
    host.close()
  }, [host])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (telepathyStore.getSnapshot().context.stage !== 'qr') return
      if (event.key === 'ArrowRight') telepathyStore.send({ type: 'next' })
      else if (event.key === 'ArrowLeft') {
        // Prev on the first part returns to the Config stage; a generation
        // still running in the background must not write into it.
        if (telepathyStore.getSnapshot().context.index === 0) cancelActiveGeneration()
        telepathyStore.send({ type: 'prev' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className="tq-backdrop" onClick={close}>
      <div className="tq-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="delete tq-close" aria-label="Close" onClick={close} />
        {stage === 'config' ? <ConfigStage host={host} /> : <QrStage />}
        <span className="tq-build" style={{display: import.meta.env.DEV ? 'span' : 'none' }}>{BUILD_LABEL}</span>
      </div>
    </div>
  )
}
