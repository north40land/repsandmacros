import { useState } from 'react'
import { PROGRAMS, PARTS, BOOKS } from './program'
import { write } from './db'
import { bookFor, blockForBook, currentWeek } from './logic'
import { askConfirm } from './confirm'
import PhasePicker from './ProgramPicker'

// Browse programs, read what one does, then start it. `openId` jumps straight to a program.
export default function Library({ v, openId, onClose }) {
  const [id, setId] = useState(openId || null)
  const program = PROGRAMS.find((p) => p.id === id)
  if (program) return <Detail v={v} program={program} onBack={() => (openId ? onClose() : setId(null))} onDone={onClose} />

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Programs</p>
        <h2>Find a program</h2>
        <p className="muted">A program plans your sessions and works out your weights. You can stop or switch at any time.</p>
      </div>

      {PROGRAMS.map((p) => {
        const active = v.hasProgram && (v.profile.program_id || PROGRAMS[0].id) === p.id
        return (
          <button className="card libcard" key={p.id} onClick={() => setId(p.id)}>
            <span className="programhead">
              <strong>{p.name}</strong>
              {active && <em>Following</em>}
            </span>
            <span className="phasenote">{p.goal}</span>
            <small>
              {p.length} · {p.frequency}
            </small>
            <small>{p.level}</small>
            <span className="go">View program ›</span>
          </button>
        )
      })}
      <p className="muted small">More programs will appear here as they are added.</p>
    </section>
  )
}

function Detail({ v, program, onBack, onDone }) {
  const active = v.hasProgram && (v.profile.program_id || PROGRAMS[0].id) === program.id
  const block = v.profile.program_block
  const currentBook = active ? bookFor(block) : null
  const [phase, setPhase] = useState(currentBook ? currentBook.id : 1)
  const inProgress = v.workouts.find((w) => !w.finished_at)
  const picked = BOOKS.find((b) => b.id === phase)

  const start = () => {
    write([['profiles', { id: v.uid, program_id: program.id, program_block: blockForBook(v, phase) }]])
    onDone()
  }

  const switchPhase = async () => {
    const started = v.workouts.some((w) => w.source === 'program' && w.program_block === block)
    const text = started
      ? `Switch to ${picked.name}? It starts at week 1. What you logged in ${currentBook.name} stays in your history, but that phase stops at week ${Math.min(currentWeek(v), 4)}.`
      : `Switch to ${picked.name}? It starts at week 1.`
    if (!(await askConfirm(text, { ok: `Switch to ${picked.name}` }))) return
    write([['profiles', { id: v.uid, program_block: blockForBook(v, phase) }]])
    onDone()
  }

  const stop = async () => {
    const text = `Stop following ${program.name}? Your logged workouts and one-rep maxes are kept, and you can start it again later.`
    if (!(await askConfirm(text, { ok: 'Stop program', danger: true }))) return
    write([['profiles', { id: v.uid, program_id: null }]])
    onDone()
  }

  return (
    <section className="detailpage">
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">{active ? 'Your program' : 'Program'}</p>
        <h2>{program.name}</h2>
        <p className="muted">{program.goal}</p>
      </div>

      <div className="facts">
        <span>{program.length}</span>
        <span>{program.frequency}</span>
        <span>{program.level}</span>
      </div>

      <h3>What it does</h3>
      <p>{program.description}</p>

      <h3>What you need</h3>
      <p>{program.needs}</p>
      <div className="chips static">
        {program.equipment.map((e) => (
          <span key={e}>{e}</span>
        ))}
      </div>

      <h3>{active ? 'Phases' : 'Choose where to start'}</h3>
      <p className="muted small">
        The plan runs the phases in order, four weeks each. Most people start at phase 1.
      </p>
      <PhasePicker
        current={currentBook?.id}
        suggested={currentBook ? bookFor(block + 1).id : undefined}
        selected={phase}
        notes={program.phaseNotes}
        onPick={setPhase}
      />

      <details className="card extras">
        <summary>All 38 exercises</summary>
        {PARTS.map((part) => (
          <div key={part.id}>
            <h4>{part.name}</h4>
            <p className="small">{part.exercises.map((ex) => ex.name).join(', ')}</p>
          </div>
        ))}
      </details>

      <div className="actions">
        {inProgress && <p className="warn small">Finish or delete the workout in progress before changing programs.</p>}
        {!active && (
          <button className="primary" disabled={Boolean(inProgress)} onClick={start}>
            Start this program
            <small className="sub">Begins with phase {picked.id}, {picked.name}</small>
          </button>
        )}
        {active && phase !== currentBook.id && (
          <button className="primary" disabled={Boolean(inProgress)} onClick={switchPhase}>
            Switch to phase {picked.id}
          </button>
        )}
        {active && (
          <button className="danger" disabled={Boolean(inProgress)} onClick={stop}>
            Stop following this program
          </button>
        )}
      </div>
    </section>
  )
}
