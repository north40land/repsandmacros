import { useState } from 'react'
import { write, nowISO } from './db'
import { askConfirm } from './confirm'
import { PartChips } from './Today'
import ExercisePicker from './ExercisePicker'

// Edit a saved workout: name, body parts, and each exercise's default sets.
export default function PresetEditor({ v, id, onClose }) {
  const preset = v.presets.find((p) => p.id === id)
  const [name, setName] = useState(preset?.name || '')
  const [parts, setParts] = useState(preset?.body_parts || [])
  const [items, setItems] = useState(() =>
    (preset?.exercises || []).map((ex) => ({
      name: ex.name,
      original: ex.sets || [],
      changed: false,
      sets: String((ex.sets || []).length || 1),
      reps: String(ex.sets?.[0]?.reps ?? ''),
      weight: String(ex.sets?.[0]?.weight ?? ''),
    })),
  )
  if (!preset) return null

  const edit = (i, patch, changesSets) =>
    setItems((list) => list.map((it, n) => (n === i ? { ...it, ...patch, changed: it.changed || changesSets } : it)))

  const num = (text, min) => {
    const n = Number(text)
    return text.trim() !== '' && Number.isFinite(n) && n >= min ? n : null
  }
  const valid = name.trim() && items.every((it) => it.name.trim() && num(it.sets, 1))

  const save = () => {
    const unit = v.profile.default_unit
    const exercises = items.map((it) => ({
      name: it.name.trim(),
      // Untouched exercises keep their set-by-set detail; edited ones use the same numbers for every set.
      sets: it.changed
        ? Array.from({ length: Math.min(20, Math.round(num(it.sets, 1))) }, () => ({
            reps: num(it.reps, 1) && Math.round(num(it.reps, 1)),
            weight: num(it.weight, 0),
            unit,
          }))
        : it.original,
    }))
    write([['user_presets', { id, name: name.trim(), body_parts: parts, exercises }]])
    onClose()
  }

  const remove = async () => {
    const text = `Delete the saved workout "${preset.name}"? Workouts you already logged with it are kept.`
    if (!(await askConfirm(text, { ok: 'Delete', danger: true }))) return
    write([['user_presets', { id, deleted_at: nowISO() }]])
    onClose()
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">My workouts</p>
        <h2>Edit saved workout</h2>
      </div>

      <div className="card">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="fieldname">Body parts</p>
        <PartChips value={parts} onChange={setParts} />
      </div>

      {items.map((it, i) => (
        <div className="card" key={i}>
          <p className="fieldname">Exercise</p>
          <ExercisePicker
            v={v}
            aria-label="Exercise name"
            placeholder="Start typing an exercise"
            value={it.name}
            onChange={(name) => edit(i, { name }, false)}
            onPick={(name) => edit(i, { name }, false)}
            parts={parts}
            exclude={items.filter((_, n) => n !== i).map((x) => x.name)}
          />
          <div className="three">
            <label>
              Sets
              <input inputMode="numeric" value={it.sets} onChange={(e) => edit(i, { sets: e.target.value }, true)} />
            </label>
            <label>
              Reps
              <input inputMode="numeric" value={it.reps} onChange={(e) => edit(i, { reps: e.target.value }, true)} />
            </label>
            <label>
              Weight
              <input inputMode="decimal" value={it.weight} onChange={(e) => edit(i, { weight: e.target.value }, true)} />
            </label>
          </div>
          <button className="link danger-text" onClick={() => setItems((list) => list.filter((_, n) => n !== i))}>
            Remove exercise
          </button>
        </div>
      ))}

      <button
        className="secondary"
        onClick={() => setItems((list) => [...list, { name: '', original: [], changed: true, sets: '3', reps: '', weight: '' }])}
      >
        Add exercise
      </button>

      <div className="actions">
        {!valid && <p className="warn small">Every exercise needs a name and at least 1 set.</p>}
        <button className="primary" disabled={!valid} onClick={save}>
          Save changes
        </button>
        <button className="danger" onClick={remove}>
          Delete saved workout
        </button>
      </div>
    </section>
  )
}
