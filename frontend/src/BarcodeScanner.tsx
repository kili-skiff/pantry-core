import { useEffect, useRef, useState } from 'react'
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

// Grocery barcodes (1D) plus QR for self-printed labels on items that
// don't have one - the other formats zxing supports (PDF417, Aztec,
// DataMatrix, MaxiCode, Micro QR) aren't relevant here and checking for
// them on every frame is wasted CPU, especially on the Pi.
const POSSIBLE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
]

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
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, POSSIBLE_FORMATS]])
    const reader = new BrowserMultiFormatReader(hints)
    let cancelled = false
    let controls: IScannerControls | undefined

    reader
      // Not decodeFromVideoDevice(undefined, ...): that requests
      // { facingMode: 'environment' }, a front/back-camera preference that
      // makes no sense for a desktop USB webcam - Firefox throws
      // NotFoundError for it instead of falling back. { video: true } just
      // asks for whatever camera is available.
      .decodeFromConstraints({ video: true }, videoRef.current ?? undefined, (result) => {
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
      .catch((err) => {
        console.error('Barcode scanner failed to start:', err)
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        setError(`Could not access the camera (${detail}).`)
      })

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="scanner">
      <div className="scanner-frame">
        <video ref={videoRef} className="scanner-video" muted playsInline />
        <div className="scanner-guide" />
      </div>
      {error && <p className="error">{error}</p>}
      <p className="scanner-hint">Position the barcode inside the frame</p>
      <button type="button" className="scanner-cancel" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}

export default BarcodeScanner
