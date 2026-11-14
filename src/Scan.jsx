import { useEffect, useRef, useState } from 'react'
import { supabase } from './supa'
import { fromLookup } from './nutrition'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

// Look a packaged food up by barcode. Uses the camera where the browser can read
// barcodes itself (the Barcode Detection API); otherwise the number is typed in.
export default function Scan({ onFood, onBack }) {
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window
  const video = useRef(null)
  const busy = useRef(false)
  const [camera, setCamera] = useState(canScan ? 'starting' : 'unsupported') // starting | on | blocked | unsupported
  const [code, setCode] = useState('')
  const [state, setState] = useState('idle') // idle | looking | notfound | error | limited

  const lookup = async (raw) => {
    const digits = String(raw).replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 14 || busy.current) return
    busy.current = true
    setCode(digits)
    setState('looking')
    const { data, error } = await supabase.functions.invoke('food-barcode', { body: { upc: digits } })
    busy.current = false
    if (error) setState(error.context?.status === 429 ? 'limited' : error.context?.status === 400 ? 'notfound' : 'error')
    else if (!data?.food) setState('notfound')
    else onFood(fromLookup(data.food))
  }

  useEffect(() => {
    if (!canScan) return
    let stream
    let timer
    let stopped = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        video.current.srcObject = stream
        await video.current.play()
        setCamera('on')
        const detector = new window.BarcodeDetector({ formats: FORMATS })
        timer = setInterval(async () => {
          if (busy.current || !video.current) return
          try {
            const found = await detector.detect(video.current)
            if (found[0]?.rawValue) lookup(found[0].rawValue)
          } catch {
            /* a frame that cannot be read is fine; try the next one */
          }
        }, 350)
      } catch {
        setCamera('blocked')
      }
    })()
    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const digits = code.replace(/\D/g, '')

  return (
    <section>
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Barcode</p>
        <h2>Find by barcode</h2>
      </div>

      {canScan && camera !== 'blocked' && (
        <div className="camera">
          <video ref={video} playsInline muted aria-label="Camera view" />
          <p className="muted small">{camera === 'on' ? 'Hold the barcode inside the frame.' : 'Starting the camera'}</p>
        </div>
      )}
      {camera === 'blocked' && <p className="muted small">The camera is not available. Type the number under the barcode instead.</p>}
      {camera === 'unsupported' && (
        <p className="muted small">This browser cannot read barcodes with the camera. Type the number printed under the barcode.</p>
      )}

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault()
          lookup(code)
        }}
      >
        <input
          inputMode="numeric"
          aria-label="Barcode number"
          placeholder="Barcode number"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setState('idle')
          }}
        />
        <button className="primary" disabled={digits.length < 8 || digits.length > 14 || state === 'looking'}>
          {state === 'looking' ? 'Looking' : 'Look up'}
        </button>
      </form>
      {digits.length > 14 && <p className="warn small">A barcode has 8 to 14 digits.</p>}
      {state === 'notfound' && <p className="muted small">No product found for {code}. Search by name, or create the food yourself.</p>}
      {state === 'error' && <p className="warn small">The lookup did not work. Check your connection and try again.</p>}
      {state === 'limited' && <p className="warn small">The food database is busy right now. Try again in a little while.</p>}
    </section>
  )
}
