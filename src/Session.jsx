import { useEffect, useState } from 'react'
import { CARDIO, extrasFor } from './program'
import { write, uuid, nowISO } from './db'
import { askConfirm } from './confirm'
import { BODY_PARTS, bookFor, weekInfo, target, history, exKey, niceDate, localDate, fromLocalDate, round5 } from './logic'

// A number box that lets you type freely (including "12.") and saves each valid value.
function NumInput({ value, fallback, onCommit, kind, ...rest }) {
  const [draft, setDraft] = useState(null)
  return (
    <input
      {...rest}
      inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
      value={draft ?? value ?? fallback ?? ''}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        const n = Number(text)
        if (text.trim() === '' || !Number.isFinite(n)) return onCommit(null)
        if (kind === 'weight') onCommit(n >= 0 ? n : null)
        else if (kind === 'reps') onCommit(n >= 1 ? Math.round(n) : null)
        else onCommit(n >= 1 && n <= 10 ? n : null)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

export default function Session({ v, id, onClose }) {
  const w = v.workouts.find((x) => x.id === id)
  const [restEnd, setRestEnd] = useState(0)
  const [, tick] = useState(0)
  const [openSet, setOpenSet] = useState(null)
  const [newName, setNewName] = useState('')
  const [savePreset, setSavePreset] = useState(false)

  useEffect(() => {
    if (!restEnd) return
    const t = setInterval(() => {
      if (Date.now() >= restEnd) setRestEnd(0)
      tick((n) => n + 1)
    }, 250)
    return () => clearInterval(t)
  }, [restEnd])

  const isProgram = w.source === 'program'
  const info = isProgram ? weekInfo(w.program_block, w.program_week) : null
  const book = isProgram ? bookFor(w.program_block) : null
  const exercises = v.exercises[w.id] || []
  const today = localDate()
  const unit = v.profile.default_unit

  // Program days always show the prescribed number of rows, filled in or not.
  const rowsFor = (ex) => {
    const real = v.sets[ex.id] || []
    if (!isProgram) return real
    const count = Math.max(info.sets, ...real.map((s) => s.set_number))
    return Array.from({ length: count }, (_, i) => real.find((s) => s.set_number === i + 1) || { set_number: i + 1 })
  }

  const saveSet = (ex, row, patch) =>
    write([
      [
        'workout_sets',
        {
          id: row.id || uuid(),
          exercise_id: ex.id,
          set_number: row.set_number,
          unit: row.unit || unit,
          done: Boolean(row.done),
          ...patch,
        },
      ],
    ])

  const addSet = (ex, copyLast) => {
    const rows = rowsFor(ex)
    const last = rows[rows.length - 1]
    saveSet(
      ex,
      { set_number: (last?.set_number || 0) + 1, unit: last?.unit },
      copyLast && last ? { reps: last.reps ?? null, weight: last.weight ?? null } : { reps: null, weight: null },
    )
  }

  const addExercise = (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    const exId = uuid()
    write([
      ['workout_exercises', { id: exId, workout_id: w.id, name: newName.trim(), order_index: exercises.length }],
      ['workout_sets', { id: uuid(), exercise_id: exId, set_number: 1, reps: null, weight: null, unit, done: false }],
    ])
    setNewName('')
  }

  const removeExercise = async (ex) => {
    if (!(await askConfirm(`Remove ${ex.name} and its sets?`, { ok: 'Remove', danger: true }))) return
    const at = nowISO()
    write([
      ['workout_exercises', { id: ex.id, deleted_at: at }],
      ...(v.sets[ex.id] || []).map((s) => ['workout_sets', { id: s.id, deleted_at: at }]),
    ])
  }

  // A set counts once it is ticked, or at finish time if both boxes are filled in.
  const countable = (s) => s.done || (s.reps > 0 && s.weight != null)
  const logged = exercises.reduce((n, ex) => n + (v.sets[ex.id] || []).filter(countable).length, 0)

  const finish = () => {
    const ops = []
    const template = []
    for (const ex of exercises) {
      const sets = (v.sets[ex.id] || []).filter(countable)
      for (const s of sets) if (!s.done) ops.push(['workout_sets', { id: s.id, done: true }])
      if (sets.length) template.push({ name: ex.name, sets: sets.map((s) => ({ reps: s.reps, weight: s.weight, unit: s.unit })) })
      // No max on file for a program lift: estimate one from what was lifted today.
      if (isProgram && sets.length && !v.maxes[ex.exercise_key]?.value) {
        const heaviest = Math.max(...sets.map((s) => Number(s.weight)))
        if (heaviest > 0) {
          ops.push(['one_rep_maxes', { exercise_key: ex.exercise_key, value: round5(heaviest / info.pct), estimated: true, deleted_at: null }])
        }
      }
    }
    ops.push(['workouts', { id: w.id, finished_at: nowISO() }])
    if (savePreset) ops.push(['user_presets', { id: uuid(), name: w.name, body_parts: w.body_parts, exercises: template }])
    write(ops)
    onClose()
  }

  const discard = async () => {
    if (!(await askConfirm(`Delete "${w.name}" and everything logged in it?`, { ok: 'Delete', danger: true }))) return
    const at = nowISO()
    const ops = [['workouts', { id: w.id, deleted_at: at }]]
    for (const ex of exercises) {
      ops.push(['workout_exercises', { id: ex.id, deleted_at: at }])
      for (const s of v.sets[ex.id] || []) ops.push(['workout_sets', { id: s.id, deleted_at: at }])
    }
    write(ops)
    onClose()
  }

  const setExtras = (patch) => write([['workouts', { id: w.id, extras: { ...w.extras, ...patch } }]])
  const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000))
  const partNames = (w.body_parts || []).map((p) => BODY_PARTS.find(([id]) => id === p)?.[1] || p).join(', ')

  return (
    <section className="session">
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">
          {isProgram
            ? `${book.name} · Week ${w.program_week} · ${info.sets} × ${info.reps} at ${Math.round(info.pct * 100)}%`
            : partNames || 'Workout'}
        </p>
        {isProgram ? (
          <h2>{w.name}</h2>
        ) : (
          <input
            className="title"
            aria-label="Workout name"
            value={w.name}
            onChange={(e) => write([['workouts', { id: w.id, name: e.target.value }]])}
          />
        )}
        <input
          className="date"
          type="date"
          aria-label="Workout date"
          max={today}
          value={localDate(w.performed_at)}
          onChange={(e) => {
            const d = e.target.value
            if (d && d <= today) write([['workouts', { id: w.id, performed_at: fromLocalDate(d) }]])
          }}
        />
      </div>

      {!exercises.length && <p className="muted">No exercises yet. Add the first one below.</p>}

      {exercises.map((ex) => {
        const tgt = isProgram ? target(v, ex.exercise_key, w.program_block, w.program_week) : null
        const prev = history(v, exKey(ex))
          .filter((h) => h.id !== w.id)
          .pop()
        const rows = rowsFor(ex)
        return (
          <div className="card ex" key={ex.id}>
            <div className="exhead">
              {isProgram ? (
                <h4>{ex.name}</h4>
              ) : (
                <input
                  className="exname"
                  aria-label="Exercise name"
                  value={ex.name}
                  onChange={(e) => write([['workout_exercises', { id: ex.id, name: e.target.value }]])}
                />
              )}
              {!isProgram && (
                <button className="link" onClick={() => removeExercise(ex)}>
                  Remove
                </button>
              )}
            </div>
            <p className="muted small">
              {isProgram && (tgt ? `Target ${tgt} lb` : 'No max yet. Log what you use and the app will estimate one.')}
              {isProgram && prev ? ' · ' : ''}
              {prev ? `Last ${prev.top.weight} × ${prev.top.reps} (${niceDate(prev.at)})` : ''}
            </p>
            {rows.length > 0 && (
              <div className="rowhead">
                <span>Set</span>
                <span>Weight</span>
                <span>Reps</span>
                <span>RPE</span>
                <span />
                <span />
              </div>
            )}
            {rows.map((row, i) => {
              const earlier = rows.slice(0, i).reverse().find((x) => x.done)
              const shownW = row.weight ?? (isProgram ? tgt ?? earlier?.weight ?? null : null)
              const shownR = row.reps ?? (isProgram ? info.reps : null)
              const ready = shownR > 0 && shownW != null
              const label = `${ex.name} set ${i + 1}`
              const rowKey = row.id || `n${row.set_number}`
              return (
                <div key={isProgram ? row.set_number : row.id}>
                  <div className={row.done ? 'row done' : 'row'}>
                    <span>{i + 1}</span>
                    <NumInput kind="weight" aria-label={`${label} weight`} value={row.weight} fallback={shownW} onCommit={(n) => saveSet(ex, row, { weight: n })} />
                    <NumInput kind="reps" aria-label={`${label} reps`} value={row.reps} fallback={shownR} onCommit={(n) => saveSet(ex, row, { reps: n })} />
                    <NumInput kind="rpe" aria-label={`${label} RPE`} value={row.rpe} onCommit={(n) => saveSet(ex, row, { rpe: n })} />
                    <button
                      className="check"
                      aria-label={`${label} ${row.done ? 'logged' : 'log'}`}
                      aria-pressed={Boolean(row.done)}
                      disabled={!ready}
                      onClick={() => {
                        saveSet(ex, row, { weight: shownW, reps: shownR, done: !row.done })
                        if (!row.done && v.profile.rest_seconds > 0) setRestEnd(Date.now() + v.profile.rest_seconds * 1000)
                      }}
                    >
                      ✓
                    </button>
                    <button
                      className="more"
                      aria-label={`${label} more options`}
                      aria-expanded={openSet === rowKey}
                      onClick={() => setOpenSet(openSet === rowKey ? null : rowKey)}
                    >
                      ⋯
                    </button>
                  </div>
                  {openSet === rowKey && (
                    <div className="setmore">
                      <select aria-label={`${label} unit`} value={row.unit || unit} onChange={(e) => saveSet(ex, row, { unit: e.target.value })}>
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                      <input
                        aria-label={`${label} notes`}
                        placeholder="Notes"
                        value={row.notes || ''}
                        onChange={(e) => saveSet(ex, row, { notes: e.target.value })}
                      />
                      {row.id && (
                        <button
                          className="link danger-text"
                          onClick={() => {
                            write([['workout_sets', { id: row.id, deleted_at: nowISO() }]])
                            setOpenSet(null)
                          }}
                        >
                          Remove set
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="setactions">
              <button className="link" onClick={() => addSet(ex, false)}>
                + Add set
              </button>
              <button className="link" disabled={!rows.length} onClick={() => addSet(ex, true)}>
                Duplicate last set
              </button>
            </div>
          </div>
        )
      })}

      {!isProgram && (
        <form className="card addex" onSubmit={addExercise}>
          <input aria-label="New exercise name" placeholder="Exercise name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="primary" disabled={!newName.trim()}>
            Add exercise
          </button>
        </form>
      )}

      {isProgram && (
        <details className="card extras">
          <summary>Cardio and add-ons</summary>
          <h4>Cardio</h4>
          <div className="chips">
            {CARDIO.map((c) => (
              <button
                key={c}
                aria-pressed={w.extras?.cardio?.type === c}
                onClick={() => setExtras({ cardio: { ...w.extras?.cardio, type: w.extras?.cardio?.type === c ? '' : c } })}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            placeholder="Stations, time per station, rest, notes"
            aria-label="Cardio notes"
            value={w.extras?.cardio?.note || ''}
            onChange={(e) => setExtras({ cardio: { ...w.extras?.cardio, note: e.target.value } })}
          />
          {extrasFor(book.id).map((group) => (
            <div key={group.title}>
              <h4>{group.title}</h4>
              <div className="chips">
                {group.items.map((q) => {
                  const list = w.extras?.queenax || []
                  const on = list.includes(q)
                  return (
                    <button key={q} aria-pressed={on} onClick={() => setExtras({ queenax: on ? list.filter((x) => x !== q) : [...list, q] })}>
                      {q}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </details>
      )}

      <label className="notes">
        Workout notes
        <input value={w.notes || ''} onChange={(e) => write([['workouts', { id: w.id, notes: e.target.value }]])} />
      </label>

      <div className="actions">
        {!w.finished_at && w.source === 'custom' && (
          <label className="toggle">
            <input type="checkbox" checked={savePreset} onChange={(e) => setSavePreset(e.target.checked)} />
            Save as preset in My workouts
          </label>
        )}
        {!w.finished_at && (
          <button className="primary" disabled={!logged} onClick={finish}>
            Finish workout ({logged} {logged === 1 ? 'set' : 'sets'})
          </button>
        )}
        <button className="danger" onClick={discard}>
          Delete this workout
        </button>
      </div>

      {left > 0 && (
        <button className="rest" onClick={() => setRestEnd(0)}>
          Rest {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} <small>tap to skip</small>
        </button>
      )}
    </section>
  )
}
