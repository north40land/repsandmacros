import { PARTS } from './program'
import { write, nowISO } from './db'
import { currentWeek, target, weekInfo, bookFor } from './logic'

export default function Maxes({ v, onClose }) {
  const week = Math.min(currentWeek(v), 4)
  const block = v.profile.program_block
  const info = weekInfo(block, week)
  const entered = PARTS.flatMap((p) => p.exercises).filter((ex) => v.maxes[ex.id]?.value).length

  const set = (exerciseKey, text) => {
    const n = Number(text)
    if (text.trim() !== '' && Number.isFinite(n) && n > 0) {
      write([['one_rep_maxes', { exercise_key: exerciseKey, value: n, estimated: false, deleted_at: null }]])
    } else if (v.maxes[exerciseKey]) {
      write([['one_rep_maxes', { exercise_key: exerciseKey, deleted_at: nowISO() }]])
    }
  }

  if (!v.hasProgram) {
    return (
      <section>
        <button className="back" onClick={onClose}>
          ‹ Back
        </button>
        <div className="weekhead">
          <p className="eyebrow">One-rep maxes</p>
          <h2>No program yet</h2>
          <p className="muted">
            Maxes are used by programs to work out your target weights. Start a program from the Today tab and its lifts
            will be listed here.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">{bookFor(block).name} · one-rep maxes</p>
        <h2>{entered} of 38 set</h2>
        <p className="muted">
          Enter the maxes you know. Targets are {Math.round(info.pct * 100)}% this week, rounded up to 5 lb. Lifts left
          blank get an estimate after the first time you log them.
        </p>
      </div>

      {PARTS.map((part) => (
        <div key={part.id}>
          <h3>{part.name}</h3>
          <div className="card maxes">
            {part.exercises.map((ex) => {
              const m = v.maxes[ex.id]
              const tgt = target(v, ex.id, block, week)
              return (
                <label key={ex.id}>
                  <span>
                    {ex.name}
                    <small>
                      {tgt ? `Week ${week} target ${tgt} lb` : 'No max yet'}
                      {m?.estimated ? ' · estimated' : ''}
                    </small>
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="lb"
                    aria-label={`${ex.name} one-rep max in pounds`}
                    value={m?.value ?? ''}
                    onChange={(e) => set(ex.id, e.target.value)}
                  />
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
