import { useEffect, useRef, useState } from 'react'
import { supabase } from './supa'
import { fromLookup } from './nutrition'
import { getDetector } from './scanner'

// Look a packaged food up by barcode: point the camera at it, or type the number.
export default function Scan({ onFood, onBack }) {
  const hasCamera = Boolean(navigator.mediaDevices?.getUserMedia)
  const video = useRef(null)
  const busy = useRef(false)
  const [camera, setCamera] = useState(hasCamera ? 'starting' : 'none') // starting | on | blocked | failed | none
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
    if (!hasCamera) return
    let stream
    let timer
    let stopped = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      } catch {
        return setCamera('blocked')
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      try {
        video.current.srcObject = stream
        await video.current.play()
        const detector = await getDetector()
        if (stopped) return
        setCamera('on')
        let lastMiss = ''
        timer = setInterval(async () => {
          if (busy.current || !video.current || video.current.readyState < 2) return
          try {
            const found = await detector.detect(video.current)
            const value = found[0]?.rawValue
            // Do not keep re-sending a code that was just looked up and not found.
            if (value && value !== lastMiss) {
              lastMiss = value
              lookup(value)
            }
          } catch {
            /* a frame that cannot be read is fine; try the next one */
          }
        }, 300)
      } catch {
        setCamera('failed')
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
  const showVideo = camera === 'starting' || camera === 'on'

  return (
    <section>
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Barcode</p>
        <h2>Find by barcode</h2>
      </div>

      {showVideo && (
        <div className="camera">
          <video ref={video} playsInline muted autoPlay aria-label="Camera view" />
          <p className="muted small" role="status">
            {camera === 'on' ? 'Hold the barcode steady inside the frame.' : 'Starting the camera'}
          </p>
        </div>
      )}
      {camera === 'blocked' && (
        <p className="muted small">The camera is switched off for this site. Allow it in your browser settings, or type the number under the barcode.</p>
      )}
      {camera === 'failed' && <p className="muted small">The scanner could not start. Type the number under the barcode instead.</p>}
      {camera === 'none' && <p className="muted small">No camera is available here. Type the number printed under the barcode.</p>}

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
