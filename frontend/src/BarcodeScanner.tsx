import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false
    let controls: IScannerControls | undefined

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result) {
          controls?.stop()
          onDetectedRef.current(result.getText())
        }
      })
      .then((c) => {
        // Effect may already have been cleaned up (React StrictMode runs
        // effects twice in dev) by the time this promise resolves - don't
        // leave a second camera stream running.
        if (cancelled) {
          c.stop()
        } else {
          controls = c
        }
      })
      .catch(() => setError('Could not access the camera.'))

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" muted playsInline />
      {error && <p className="error">{error}</p>}
      <button type="button" className="scanner-cancel" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}

export default BarcodeScanner
