import { useEffect, useState } from 'react'
import { supabase } from './supa'
import { write, uuid, nowISO } from './db'
import { localDate, fromLocalDate, niceDate } from './logic'
import { askConfirm } from './confirm'

// Progress photos: front, side and back per check-in date, kept in a private storage
// bucket under the person's own folder. Pictures are shrunk on the phone before upload.

const BUCKET = 'progress-photos'
const POSES = [
  ['front', 'Front'],
  ['side', 'Side'],
  ['back', 'Back'],
]
const MAX_SIDE = 1600

async function shrink(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('unreadable'))
      el.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('unreadable'))), 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Private pictures need a short-lived signed address before they can be shown.
const signed = new Map()
function useSigned(paths) {
  const [, bump] = useState(0)
  const wanted = paths.filter((p) => p && !signed.has(p))
  const key = wanted.join('|')
  useEffect(() => {
    if (!wanted.length || !supabase) return
    let live = true
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(wanted, 3600)
      .then(({ data }) => {
        for (const item of data || []) if (item.signedUrl) signed.set(item.path, item.signedUrl)
        if (live) bump((n) => n + 1)
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (path) => signed.get(path) || null
}

export default function Photos({ v }) {
  const [adding, setAdding] = useState(false)
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const [pose, setPose] = useState('front')
  const urlFor = useSigned(v.photos.map((p) => p.storage_path))

  if (!supabase) return <p className="muted">Progress photos need the cloud connection.</p>
  if (adding) return <AddPhotos v={v} onClose={() => setAdding(false)} />

  const dates = [...new Set(v.photos.map((p) => p.taken_on))].sort().reverse()
  const find = (date, which) => v.photos.find((p) => p.taken_on === date && p.pose === which)
  const first = a && dates.includes(a) ? a : dates[dates.length - 1]
  const second = b && dates.includes(b) ? b : dates[0]

  const remove = async (photo) => {
    if (!(await askConfirm(`Delete the ${photo.pose} photo from ${niceDate(fromLocalDate(photo.taken_on))}?`, { ok: 'Delete', danger: true }))) return
    await supabase.storage.from(BUCKET).remove([photo.storage_path])
    write([['progress_photos', { id: photo.id, deleted_at: nowISO() }]])
  }

  const Picture = ({ photo, label }) => (
    <figure className="shot">
      {photo && urlFor(photo.storage_path) ? <img src={urlFor(photo.storage_path)} alt={`${photo.pose} view, ${niceDate(fromLocalDate(photo.taken_on))}`} loading="lazy" /> : <div className="noshot">{photo ? 'Loading' : 'No photo'}</div>}
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )

  return (
    <>
      <button className="primary" onClick={() => setAdding(true)}>
        Add photos
      </button>
      <p className="muted small">Photos are private to your account and need a connection to upload or view.</p>

      {dates.length >= 2 && (
        <>
          <h3>Compare</h3>
          <div className="card">
            <div className="seg" role="tablist" aria-label="Pose">
              {POSES.map(([id, name]) => (
                <button key={id} role="tab" aria-selected={pose === id} onClick={() => setPose(id)}>
                  {name}
                </button>
              ))}
            </div>
            <div className="two spaced">
              {[
                [first, setA, 'Earlier date'],
                [second, setB, 'Later date'],
              ].map(([value, set, name]) => (
                <label key={name}>
                  {name}
                  <select value={value} onChange={(e) => set(e.target.value)}>
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {niceDate(fromLocalDate(d))}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="two compare">
              <Picture photo={find(first, pose)} label={niceDate(fromLocalDate(first))} />
              <Picture photo={find(second, pose)} label={niceDate(fromLocalDate(second))} />
            </div>
          </div>
        </>
      )}

      {dates.length > 0 ? (
        dates.map((date) => (
          <div key={date}>
            <h3>{niceDate(fromLocalDate(date))}</h3>
            <div className="three shots">
              {POSES.map(([id, name]) => {
                const photo = find(date, id)
                return (
                  <div key={id}>
                    <Picture photo={photo} label={name} />
                    {photo && (
                      <button className="link danger-text" onClick={() => remove(photo)}>
                        Delete
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No photos yet. Take a front, side and back photo in the same spot and light each time.</p>
      )}
    </>
  )
}

function AddPhotos({ v, onClose }) {
  const today = localDate()
  const [date, setDate] = useState(today)
  const [files, setFiles] = useState({})
  const [previews, setPreviews] = useState({})
  const [state, setState] = useState('idle') // idle | saving | error
  const chosen = POSES.filter(([id]) => files[id])
  const valid = date && date <= today && chosen.length > 0

  const choose = (pose, file) => {
    if (previews[pose]) URL.revokeObjectURL(previews[pose])
    setFiles({ ...files, [pose]: file || null })
    setPreviews({ ...previews, [pose]: file ? URL.createObjectURL(file) : null })
    setState('idle')
  }

  const save = async () => {
    setState('saving')
    try {
      const ops = []
      for (const [pose] of chosen) {
        const blob = await shrink(files[pose])
        const path = `${v.uid}/${date}/${pose}-${uuid()}.jpg`
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        // A new photo for the same day and pose replaces the old one.
        const old = v.photos.find((p) => p.taken_on === date && p.pose === pose)
        if (old) await supabase.storage.from(BUCKET).remove([old.storage_path])
        ops.push(['progress_photos', { id: old?.id || uuid(), taken_on: date, pose, storage_path: path, deleted_at: null }])
      }
      write(ops)
      onClose()
    } catch (err) {
      console.error('photo upload failed', err)
      setState('error')
    }
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Progress photos</p>
        <h2>Add photos</h2>
      </div>

      <div className="card">
        <label>
          Date
          <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="three shots">
          {POSES.map(([id, name]) => (
            <label key={id} className="pick">
              {previews[id] ? <img src={previews[id]} alt={`${name} photo chosen`} /> : <div className="noshot">Tap to choose</div>}
              <span>{name}</span>
              <input type="file" accept="image/*" aria-label={`${name} photo`} onChange={(e) => choose(id, e.target.files?.[0])} />
            </label>
          ))}
        </div>
        <p className="muted small">Add one, two or all three. A photo for the same day and pose replaces the earlier one.</p>
      </div>

      <div className="actions">
        {date > today && <p className="warn small">The date cannot be in the future.</p>}
        {state === 'error' && <p className="warn small">The upload did not finish. Check your connection and try again.</p>}
        <button className="primary" disabled={!valid || state === 'saving'} onClick={save}>
          {state === 'saving' ? 'Uploading' : `Save ${chosen.length || ''} ${chosen.length === 1 ? 'photo' : 'photos'}`.replace('  ', ' ')}
        </button>
      </div>
    </section>
  )
}
