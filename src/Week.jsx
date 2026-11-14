import { useState } from 'react'
import { write } from './db'
import { localDate, fromLocalDate } from './logic'
import { addDays, mondayOf, weekAdherence } from './calc'

const COLS = [
  ['calories', 'Cal'],
  ['protein', 'Protein'],
  ['carbs', 'Carbs'],
  ['fat', 'Fat'],
]
const short = (date) => new Date(fromLocalDate(date)).toLocaleDateString(undefined, { weekday: 'short' })
const span = (start) => {
  const f = (d) => new Date(fromLocalDate(d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${f(start)} to ${f(addDays(start, 6))}`
}
const pct = (x) => (x == null ? 'n/a' : `${x}%`)

// How close each day of a week came to its targets.
export default function Week({ v, onClose, onPickDay }) {
  const thisWeek = mondayOf(localDate())
  const [start, setStart] = useState(thisWeek)
  const w = weekAdherence(v, start)
  const [tol, setTol] = useState({ cal: String(w.tolCal), protein: String(w.tolProtein) })

  const saveTolerance = (next) => {
    setTol(next)
    const cal = Number(next.cal)
    const protein = Number(next.protein)
    if (next.cal !== '' && next.protein !== '' && cal >= 0 && cal <= 100 && protein >= 0) {
      write([['user_profile_metrics', { tol_calories_pct: cal, tol_protein_g: protein }]])
    }
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Weekly adherence</p>
        <div className="datenav">
          <button aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>
            ‹
          </button>
          <h2>{start === thisWeek ? 'This week' : span(start)}</h2>
          <button aria-label="Next week" disabled={start >= thisWeek} onClick={() => setStart(addDays(start, 7))}>
            ›
          </button>
        </div>
        {start === thisWeek && <p className="muted small center">{span(start)}</p>}
      </div>

      <div className="strip" role="list">
        {w.days.map((d) => {
          const tone = d.future ? 'future' : d.within == null ? 'none' : d.within ? 'hit' : 'miss'
          const label = d.future ? 'not yet' : !d.logged ? 'nothing logged' : d.within == null ? 'no targets' : d.within ? 'within tolerance' : 'outside tolerance'
          return (
            <button key={d.date} role="listitem" className={`day ${tone}`} disabled={d.future} aria-label={`${short(d.date)}: ${label}`} onClick={() => onPickDay(d.date)}>
              <span>{short(d.date)}</span>
              <strong>{d.future ? '' : d.within == null ? '·' : d.within ? '✓' : '✕'}</strong>
            </button>
          )
        })}
      </div>
      <p className="muted small">
        Green days were within {w.tolCal}% of calories and {w.tolProtein} g of protein. Tap a day to open it.
      </p>

      <h3>Week so far</h3>
      {w.loggedDays ? (
        <div className="card">
          <p className="rx">
            {w.withinDays} of {w.judgedDays} {w.judgedDays === 1 ? 'day' : 'days'} within tolerance
          </p>
          <p className="muted small">
            Average of target hit across {w.loggedDays} logged {w.loggedDays === 1 ? 'day' : 'days'}
          </p>
          <div className="prs four">
            {COLS.map(([key, name]) => (
              <div key={key}>
                <small>{name}</small>
                <strong>{pct(w.average[key])}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted small">Nothing logged this week.</p>
      )}

      <h3>Day by day</h3>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              {COLS.map(([key, name]) => (
                <th key={key}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {w.days
              .filter((d) => !d.future)
              .map((d) => (
                <tr key={d.date}>
                  <td>{short(d.date)}</td>
                  {d.logged ? COLS.map(([key]) => <td key={key}>{pct(d.pct[key])}</td>) : <td colSpan={4}>Nothing logged</td>}
                </tr>
              ))}
          </tbody>
        </table>
        <p className="muted small">Percent of that day's target. "n/a" means no target was set for it.</p>
      </div>

      <h3>Tolerance</h3>
      <div className="card two">
        <label>
          Calories (± %)
          <input inputMode="decimal" value={tol.cal} onChange={(e) => saveTolerance({ ...tol, cal: e.target.value })} />
        </label>
        <label>
          Protein (± g)
          <input inputMode="decimal" value={tol.protein} onChange={(e) => saveTolerance({ ...tol, protein: e.target.value })} />
        </label>
      </div>
    </section>
  )
}
