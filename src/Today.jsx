import { useEffect, useState } from 'react'
import { PARTS, programById } from './program'
import { write, uuid, nowISO } from './db'
import PhasePicker from './ProgramPicker'
import { BODY_PARTS, currentWeek, weekInfo, bookFor, blockForBook, niceDate, localDate, fromLocalDate } from './logic'
import Session from './Session'
import PresetEditor from './PresetEditor'
import Library from './Library'
import Maxes from './Maxes'

export default function Today({ v, firstScreen, clearFirstScreen }) {
  const [screen, setScreen] = useState(firstScreen || null)
  // The screen requested at sign-up is shown once, not every time this tab reopens.
  useEffect(() => {
    if (firstScreen) clearFirstScreen()
  }, [firstScreen, clearFirstScreen])
  const openSession = (id) => setScreen({ type: 'session', id })
  const close = () => setScreen(null)

  if (screen?.type === 'session' && v.workouts.some((w) => w.id === screen.id)) {
    return <Session v={v} id={screen.id} onClose={close} />
  }
  if (screen?.type === 'new') return <NewWorkout onCancel={close} onStart={openSession} />
  if (screen?.type === 'preset') return <PresetEditor v={v} id={screen.id} onClose={close} />
  if (screen?.type === 'library') return <Library v={v} openId={screen.openId} onClose={close} />
  if (screen?.type === 'maxes') return <Maxes v={v} onClose={close} />
  const goMaxes = () => setScreen({ type: 'maxes' })

  const inProgress = v.workouts.find((w) => !w.finished_at)
  const recent = v.workouts.slice(0, 8)

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

  const newWorkoutButton = (
    <button
      className={v.hasProgram ? 'secondary' : 'primary'}
      disabled={Boolean(inProgress)}
      onClick={() => setScreen({ type: 'new' })}
    >
      {v.hasProgram ? 'New workout' : 'Log a workout'}
    </button>
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

      {v.hasProgram ? (
        <ProgramCard
          v={v}
          inProgress={inProgress}
          openSession={openSession}
          goMaxes={goMaxes}
          openDetails={() => setScreen({ type: 'library', openId: programById(v.profile.program_id).id })}
        />
      ) : (
        newWorkoutButton
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
        <p className="muted small">
          No saved workouts yet. Log a workout and switch on "Save as preset" when you finish to reuse it.
        </p>
      )}
      {v.hasProgram && newWorkoutButton}
      {inProgress && <p className="muted small">Finish the workout in progress before starting another.</p>}

      {!v.hasProgram && (
        <>
          <h3>Programs</h3>
          <button className="card libcard" onClick={() => setScreen({ type: 'library' })}>
            <span className="programhead">
              <strong>Follow a program</strong>
            </span>
            <span className="phasenote">Let a plan set your sessions and work out your weights.</span>
            <span className="go">Browse programs ›</span>
          </button>
        </>
      )}

      <h3>Recent</h3>
      {recent.length ? (
        <ul className="list">
          {recent.map((w) => (
            <li key={w.id}>
              <button onClick={() => openSession(w.id)}>
                <span>{w.name}</span>
                <small>
                  {niceDate(w.performed_at)}
                  {w.source === 'program' ? ` · ${bookFor(w.program_block).name} W${w.program_week}` : ''}
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

// "Your program": where you are in the plan and this week's sessions.
function ProgramCard({ v, inProgress, openSession, goMaxes, openDetails }) {
  const program = programById(v.profile.program_id)
  const block = v.profile.program_block
  const week = currentWeek(v)
  const book = bookFor(block)
  const info = week <= 4 ? weekInfo(block, week) : null
  const maxCount = Object.values(v.maxes).filter((m) => m.value).length

  const doneThisWeek = (partId) =>
    v.workouts.find(
      (w) =>
        w.source === 'program' &&
        w.program_block === block &&
        w.program_week === week &&
        w.body_parts[0] === partId &&
        w.finished_at,
    )
  const doneCount = PARTS.filter((p) => doneThisWeek(p.id)).length

  const startDay = (part) => {
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

  return (
    <>
      <div className="h3row">
        <h3>Your program</h3>
        <span className="links">
          <button className="link" onClick={goMaxes}>
            Maxes
          </button>
          <button className="link" onClick={openDetails}>
            Details
          </button>
        </span>
      </div>
      <div className="card programcard">
        <strong>{program.name}</strong>
        {info ? (
          <>
            <p className="muted small">
              Phase {book.id}, {book.name} · Week {week} of 4 · {doneCount} of 6 sessions done
            </p>
            <p className="rx">
              {info.sets} sets × {info.reps} reps at {Math.round(info.pct * 100)}% of one-rep max
            </p>
            {maxCount === 0 && (
              <button className="link" onClick={goMaxes}>
                Enter your one-rep maxes to get target weights ›
              </button>
            )}
            <div className="parts">
              {PARTS.map((p) => {
                const done = doneThisWeek(p.id)
                return (
                  <button
                    key={p.id}
                    className={done ? 'part done' : 'part'}
                    disabled={!done && Boolean(inProgress)}
                    onClick={() => (done ? openSession(done.id) : startDay(p))}
                  >
                    <strong>{p.name}</strong>
                    <small>{done ? `Done ${niceDate(done.performed_at)}` : `${p.exercises.length} exercises`}</small>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Phase {book.id}, {book.name}, is complete. Pick what to run next, then update your one-rep maxes before you
              start.
            </p>
            <PhasePicker
              suggested={bookFor(block + 1).id}
              notes={program.phaseNotes}
              onPick={(bookId) => {
                write([['profiles', { id: v.uid, program_block: blockForBook(v, bookId) }]])
                goMaxes()
              }}
            />
          </>
        )}
      </div>
    </>
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
