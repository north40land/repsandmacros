import { useState } from 'react'
import { PARTS } from './program'
import { history, records, exKey, niceDate } from './logic'

const num = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })

export default function Progress({ v }) {
  const [open, setOpen] = useState(null)
  const unit = v.profile.default_unit
  const finished = v.workouts.filter((w) => w.finished_at).length

  // Free-form exercises, grouped by name.
  const others = new Map()
  for (const list of Object.values(v.exercises)) {
    for (const ex of list) if (!ex.exercise_key && ex.name.trim()) others.set(exKey(ex), ex.name.trim())
  }
  const groups = [
    ...PARTS.map((p) => ({ name: p.name, lifts: p.exercises.map((ex) => ({ key: ex.id, name: ex.name })) })),
    {
      name: 'Other exercises',
      lifts: [...others].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  ]
    .map((g) => ({ ...g, lifts: g.lifts.map((l) => ({ ...l, h: history(v, l.key, unit) })) }))
    // Program lifts only appear once they have been logged or while a program is being followed.
    .map((g) => ({ ...g, lifts: v.hasProgram || g.name === 'Other exercises' ? g.lifts : g.lifts.filter((l) => l.h.length) }))
    .filter((g) => g.lifts.length)

  return (
    <section>
      <div className="weekhead">
        <p className="eyebrow">Progress</p>
        <h2>
          {finished} {finished === 1 ? 'workout' : 'workouts'} logged
        </h2>
        <p className="muted">Tap a lift for its history and personal records. Weights are in {unit}.</p>
      </div>

      {!groups.length && <p className="muted">Nothing logged yet. Your lifts will appear here after your first workout.</p>}

      {groups.map((group) => (
        <div key={group.name}>
          <h3>{group.name}</h3>
          <ul className="list">
            {group.lifts.map(({ key, name, h }) => {
              const last = h[h.length - 1]
              const change = h.length > 1 ? Math.round((last.top.w - h[0].top.w) * 10) / 10 : null
              return (
                <li key={key}>
                  <button disabled={!h.length} aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                    <span>{name}</span>
                    <small>
                      {last ? `${num(last.top.w)} × ${last.top.reps}` : 'Not logged yet'}
                      {change ? ` · ${change > 0 ? '+' : ''}${num(change)}` : ''}
                    </small>
                  </button>
                  {open === key && <LiftDetail h={h} unit={unit} />}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

function LiftDetail({ h, unit }) {
  const pr = records(h)
  return (
    <div className="detail">
      <Spark values={h.map((x) => x.top.w)} />

      <h4 className="subhead">Personal records</h4>
      <div className="prs">
        <div>
          <small>Heaviest set</small>
          <strong>
            {num(pr.heaviest.w)} {unit} × {pr.heaviest.reps}
          </strong>
          <small>{niceDate(pr.heaviest.at)}</small>
        </div>
        <div>
          <small>Highest volume session</small>
          <strong>
            {num(pr.volume.volume)} {unit}
          </strong>
          <small>{niceDate(pr.volume.at)}</small>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Weight</th>
            <th>Most reps</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {pr.repsAtWeight.slice(0, 6).map((r) => (
            <tr key={r.w}>
              <td>
                {num(r.w)} {unit}
              </td>
              <td>{r.reps}</td>
              <td>{niceDate(r.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pr.repsAtWeight.length > 6 && <p className="muted small">Showing the six heaviest weights.</p>}

      <h4 className="subhead">History</h4>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Best set</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>
          {[...h].reverse().map((x) => (
            <tr key={x.id}>
              <td>{niceDate(x.at)}</td>
              <td>
                {num(x.top.w)} × {x.top.reps}
              </td>
              <td>{num(x.volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Spark({ values }) {
  if (values.length < 2) return <p className="muted small">The chart appears after a second workout.</p>
  const W = 300
  const H = 64
  const pad = 8
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((val, i) => [
    pad + (i * (W - 2 * pad)) / (values.length - 1),
    H - pad - ((val - min) / span) * (H - 2 * pad),
  ])
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Best set from ${values[0]} to ${values[values.length - 1]}`}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />
      ))}
    </svg>
  )
}
