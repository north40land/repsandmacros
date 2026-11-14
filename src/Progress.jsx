import { useState } from 'react'
import { PARTS } from './program'
import { history, exKey, niceDate } from './logic'

export default function Progress({ v }) {
  const [open, setOpen] = useState(null)
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
  ].filter((g) => g.lifts.length)

  return (
    <section>
      <div className="weekhead">
        <p className="eyebrow">Progress</p>
        <h2>
          {finished} {finished === 1 ? 'workout' : 'workouts'} logged
        </h2>
        <p className="muted">Heaviest set per workout, by lift. Tap a lift for its history.</p>
      </div>

      {groups.map((group) => (
        <div key={group.name}>
          <h3>{group.name}</h3>
          <ul className="list">
            {group.lifts.map((lift) => {
              const h = history(v, lift.key)
              const last = h[h.length - 1]
              const change = h.length > 1 ? Number(last.top.weight) - Number(h[0].top.weight) : null
              return (
                <li key={lift.key}>
                  <button disabled={!h.length} onClick={() => setOpen(open === lift.key ? null : lift.key)}>
                    <span>{lift.name}</span>
                    <small>
                      {last ? `${last.top.weight} ${last.top.unit || 'lb'} × ${last.top.reps}` : 'Not logged yet'}
                      {change ? ` · ${change > 0 ? '+' : ''}${change}` : ''}
                    </small>
                  </button>
                  {open === lift.key && (
                    <div className="detail">
                      <Spark values={h.map((x) => Number(x.top.weight))} />
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Sets (weight × reps)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...h].reverse().map((x) => (
                            <tr key={x.id}>
                              <td>
                                {niceDate(x.at)}
                                {x.week ? ` · B${x.block} W${x.week}` : ''}
                              </td>
                              <td>{x.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
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
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Heaviest set from ${values[0]} to ${values[values.length - 1]}`}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />
      ))}
    </svg>
  )
}
