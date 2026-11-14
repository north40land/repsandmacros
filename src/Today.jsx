import { useState } from 'react'
import { PARTS } from './program'
import { write, uuid, nowISO } from './db'
import { BODY_PARTS, currentWeek, weekInfo, bookFor, niceDate, localDate, fromLocalDate } from './logic'
import Session from './Session'
import PresetEditor from './PresetEditor'

export default function Today({ v, goMaxes }) {
  const [screen, setScreen] = useState(null)
  const openSession = (id) => setScreen({ type: 'session', id })

  if (screen?.type === 'session' && v.workouts.some((w) => w.id === screen.id)) {
    return <Session v={v} id={screen.id} onClose={() => setScreen(null)} />
  }
  if (screen?.type === 'new') return <NewWorkout onCancel={() => setScreen(null)} onStart={openSession} />
  if (screen?.type === 'preset') return <PresetEditor v={v} id={screen.id} onClose={() => setScreen(null)} />

  const week = currentWeek(v)
  const block = v.profile.program_block
  const inProgress = v.workouts.find((w) => !w.finished_at)
  const recent = v.workouts.slice(0, 8)

  const startProgramDay = (part) => {
    const id = uuid()
    write([
      [
        'workouts',
        {
          id,
          name: `${part.name} day`,
          performed_at: nowISO(),
          body_parts: [part.id],
          source: 'program',
          program_block: block,
          program_week: week,
          finished_at: null,
          extras: { cardio: { type: '', note: '' }, queenax: [] },
        },
      ],
      ...part.exercises.map((ex, i) => [
        'workout_exercises',
        { id: uuid(), workout_id: id, name: ex.name, order_index: i, exercise_key: ex.id },
      ]),
    ])
    openSession(id)
  }

  const startPreset = (preset) => {
    const id = uuid()
    const ops = [
      [
        'workouts',
        {
          id,
          name: preset.name,
          performed_at: nowISO(),
          body_parts: preset.body_parts || [],
          source: 'preset',
          preset_id: preset.id,
          finished_at: null,
        },
      ],
    ]
    ;(preset.exercises || []).forEach((ex, i) => {
      const exId = uuid()
      ops.push(['workout_exercises', { id: exId, workout_id: id, name: ex.name, order_index: i }])
      ;(ex.sets || []).forEach((s, n) =>
        ops.push([
          'workout_sets',
          {
            id: uuid(),
            exercise_id: exId,
            set_number: n + 1,
            reps: s.reps ?? null,
            weight: s.weight ?? null,
            unit: s.unit || v.profile.default_unit,
            done: false,
          },
        ]),
      )
    })
    write(ops)
    openSession(id)
  }

  const book = bookFor(block)
  const nextBook = bookFor(block + 1)
  const info = week <= 4 ? weekInfo(block, week) : null
  const doneThisWeek = (partId) =>
    v.workouts.find(
      (w) =>
        w.source === 'program' &&
        w.program_block === block &&
        w.program_week === week &&
        w.body_parts[0] === partId &&
        w.finished_at,
    )

  return (
    <section>
      <div className="weekhead">
        <p className="eyebrow">{v.profile.display_name}</p>
        <h2>What are you training today?</h2>
      </div>

      {inProgress && (
        <button className="card resume" onClick={() => openSession(inProgress.id)}>
          <span>
            <strong>{inProgress.name} in progress</strong>
            <small>{niceDate(inProgress.performed_at)}</small>
          </span>
          <span className="go">Resume</span>
        </button>
      )}

      <h3>Program · Phase {book.id} of 3</h3>
      {info ? (
        <>
          <p className="muted small">
            {book.name} · Week {week} of 4 · {info.sets} sets × {info.reps} reps at {Math.round(info.pct * 100)}% of
            one-rep max
          </p>
          <div className="parts">
            {PARTS.map((p) => {
              const done = doneThisWeek(p.id)
              return (
                <button
                  key={p.id}
                  className={done ? 'part done' : 'part'}
                  disabled={!done && Boolean(inProgress)}
                  onClick={() => (done ? openSession(done.id) : startProgramDay(p))}
                >
                  <strong>{p.name}</strong>
                  <small>{done ? `Done ${niceDate(done.performed_at)}` : `${p.exercises.length} exercises`}</small>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="card center">
          <h4>{book.name} complete</h4>
          <p className="muted">
            All four weeks are logged. Next is phase {nextBook.id}, {nextBook.name}. Update your one-rep maxes before you
            start.
          </p>
          <button
            className="primary"
            onClick={() => {
              write([['profiles', { id: v.uid, program_block: block + 1 }]])
              goMaxes()
            }}
          >
            Start {nextBook.name}
          </button>
        </div>
      )}

      <h3>My workouts</h3>
      {v.presets.length ? (
        <ul className="list">
          {v.presets.map((p) => (
            <li key={p.id} className="split">
              <button disabled={Boolean(inProgress)} onClick={() => startPreset(p)}>
                <span>{p.name}</span>
                <small>
                  {(p.exercises || []).length} {(p.exercises || []).length === 1 ? 'exercise' : 'exercises'}
                </small>
              </button>
              <button className="side" aria-label={`Edit ${p.name}`} onClick={() => setScreen({ type: 'preset', id: p.id })}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No saved workouts yet. Log a new workout and switch on "Save as preset" when you finish.</p>
      )}
      <button className="secondary" disabled={Boolean(inProgress)} onClick={() => setScreen({ type: 'new' })}>
        New workout
      </button>
      {inProgress && <p className="muted small">Finish the workout in progress before starting another.</p>}

      <h3>Recent</h3>
      {recent.length ? (
        <ul className="list">
          {recent.map((w) => (
            <li key={w.id}>
              <button onClick={() => openSession(w.id)}>
                <span>{w.name}</span>
                <small>
                  {niceDate(w.performed_at)}
                  {w.source === 'program' ? ` · B${w.program_block} W${w.program_week}` : ''}
                  {w.finished_at ? '' : ' · in progress'}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Nothing logged yet.</p>
      )}
    </section>
  )
}

export function PartChips({ value, onChange }) {
  return (
    <div className="chips">
      {BODY_PARTS.map(([id, name]) => {
        const on = value.includes(id)
        return (
          <button
            type="button"
            key={id}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== id) : [...value, id])}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}

function NewWorkout({ onCancel, onStart }) {
  const today = localDate()
  const [name, setName] = useState('')
  const [date, setDate] = useState(today)
  const [parts, setParts] = useState([])
  const valid = name.trim() && date && date <= today

  const start = (e) => {
    e.preventDefault()
    if (!valid) return
    const id = uuid()
    write([
      [
        'workouts',
        {
          id,
          name: name.trim(),
          performed_at: date === today ? nowISO() : fromLocalDate(date),
          body_parts: parts,
          source: 'custom',
          finished_at: null,
        },
      ],
    ])
    onStart(id)
  }

  return (
    <section>
      <button className="back" onClick={onCancel}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">New workout</p>
        <h2>Log anything</h2>
      </div>
      <form className="card" onSubmit={start}>
        <label>
          Workout name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Upper body, Glutes and core" />
        </label>
        <label>
          Date
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date > today && <p className="warn small">The date cannot be in the future.</p>}
        <p className="fieldname">Body parts (optional)</p>
        <PartChips value={parts} onChange={setParts} />
        <button className="primary" disabled={!valid}>
          Start workout
        </button>
      </form>
    </section>
  )
}
