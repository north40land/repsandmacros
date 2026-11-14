import { useState } from 'react'
import { localDate, fromLocalDate, niceDate } from './logic'
import { addDays, mondayOf } from './calc'
import { weekSummary, weekCsv } from './summary'

const num = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })
const signed = (n, unit) => (n == null ? 'n/a' : `${n > 0 ? '+' : ''}${num(n)} ${unit}`)
const short = (d) => new Date(fromLocalDate(d)).toLocaleDateString(undefined, { weekday: 'short' })
const span = (start) => {
  const f = (d) => new Date(fromLocalDate(d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${f(start)} to ${f(addDays(start, 6))}`
}
// A tiny trend line for a stat tile. The numbers it draws are listed in full on the screen it opens.
function Spark({ values, label }) {
  if (values.filter((x) => x > 0).length < 2) return null
  const W = 120
  const H = 28
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pts = values.map((val, i) => `${2 + (i * (W - 4)) / (values.length - 1)},${H - 3 - ((val - lo) / (hi - lo || 1)) * (H - 6)}`)
  return (
    <svg className="minispark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Tile({ label, value, note, children, onClick }) {
  const body = (
    <>
      <small>{label}</small>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
      {children}
    </>
  )
  return onClick ? (
    <button className="tile" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="tile">{body}</div>
  )
}

// The home screen: the whole week on one page.
export default function Dashboard({ v, go }) {
  const thisWeek = mondayOf(localDate())
  const [start, setStart] = useState(thisWeek)
  const s = weekSummary(v, start)
  const { unit } = s

  const exportCsv = () => {
    const blob = new Blob([weekCsv(v, s)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `week-of-${start}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="dash">
      <div className="weekhead">
        <div className="h3row top">
          <p className="eyebrow">{v.profile.display_name}</p>
          <button className="link" onClick={() => go('settings')}>
            Settings
          </button>
        </div>
        <div className="datenav">
          <button aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>
            ‹
          </button>
          <h2>{s.isCurrent ? 'This week' : span(start)}</h2>
          <button aria-label="Next week" disabled={start >= thisWeek} onClick={() => setStart(addDays(start, 7))}>
            ›
          </button>
        </div>
        {s.isCurrent && <p className="muted small center">{span(start)}</p>}
      </div>

      <h3>At a glance</h3>
      <div className="tiles">
        <Tile label="Workouts" value={s.workouts.planned ? `${s.workouts.done} of ${s.workouts.planned}` : String(s.workouts.done)} note={s.workouts.planned ? 'done of planned' : 'completed'} />
        <Tile label="Volume lifted" value={`${num(s.volume)} ${unit}`} note="last 8 weeks" onClick={() => go('progress', { view: 'lifts' })}>
          <Spark values={s.volumeTrend} label={`Weekly volume over 8 weeks, ending at ${num(s.volume)} ${unit}`} />
        </Tile>
        <Tile
          label="Calories, daily average"
          value={s.nutrition.calories == null ? 'n/a' : num(s.nutrition.calories)}
          note={s.nutrition.calorieTarget ? `target ${num(s.nutrition.calorieTarget)}` : s.nutrition.days ? 'no target set' : 'nothing logged'}
        />
        <Tile
          label="Protein, daily average"
          value={s.nutrition.protein == null ? 'n/a' : `${num(s.nutrition.protein)} g`}
          note={s.nutrition.proteinTarget ? `target ${num(s.nutrition.proteinTarget)} g` : s.nutrition.days ? 'no target set' : 'nothing logged'}
        />
        <Tile label="Sleep, nightly average" value={s.sleep.average == null ? 'n/a' : `${num(s.sleep.average)} h`} note={s.sleep.target ? `target ${num(s.sleep.target)} h` : s.sleep.nights ? 'no target set' : 'nothing logged'} />
        <Tile label="Water" value={s.water.percent == null ? 'n/a' : `${s.water.percent}%`} note={s.water.percent == null ? 'no target set' : 'of target, daily average'} />
      </div>

      <h3>Dosing</h3>
      <button className="card rowcard" onClick={() => go('doses')}>
        {!s.doses.any ? (
          <span className="muted">No items set up.</span>
        ) : (
          <>
            {s.isCurrent && (
              <p>
                <strong>{s.doses.due.length === 0 ? 'Nothing due today' : s.doses.left.length === 0 ? 'All logged for today' : `Due today: ${s.doses.left.length} of ${s.doses.due.length} left`}</strong>
                {s.doses.left.length > 0 && <small>{s.doses.left.map((i) => i.name).join(', ')}</small>}
              </p>
            )}
            <p className={s.doses.missed.length ? 'alert' : ''}>
              <strong>{s.doses.missed.length ? `Missed this week: ${s.doses.missed.length}` : 'Nothing missed this week'}</strong>
              {s.doses.missed.length > 0 && <small>{s.doses.missed.map((m) => `${m.name} (${short(m.date)})`).join(', ')}</small>}
            </p>
          </>
        )}
        <span className="go">Open doses ›</span>
      </button>

      <h3>Body trend</h3>
      <button className="card rowcard" onClick={() => go('progress', { view: 'body' })}>
        {s.body.latest ? (
          <>
            <div className="bodyrow">
              <p>
                <strong className="big">
                  {num(s.body.latest.value)} {unit}
                </strong>
                <small>{niceDate(fromLocalDate(s.body.latest.date))}</small>
              </p>
              <Spark values={s.body.trend} label={`Weight trend, latest ${num(s.body.latest.value)} ${unit}`} />
            </div>
            <p className="muted small">
              7 days {signed(s.body.change7, unit)} · 30 days {signed(s.body.change30, unit)}
            </p>
            <p className="muted small">{s.body.lastMeasured ? `Last measurements ${niceDate(fromLocalDate(s.body.lastMeasured))}` : 'No measurements logged yet'}</p>
          </>
        ) : (
          <span className="muted">No weigh-ins yet.</span>
        )}
        <span className="go">Open body ›</span>
      </button>

      <h3>Lifts</h3>
      <button className="card rowcard" onClick={() => go('progress', { view: 'lifts' })}>
        {s.records.length ? (
          <>
            <p>
              <strong>
                {s.records.length} personal {s.records.length === 1 ? 'record' : 'records'} this week
              </strong>
            </p>
            <ul className="plain">
              {s.records.map((r) => (
                <li key={r.name}>
                  <span>{r.name}</span>
                  <small>
                    {num(r.w)} {unit} × {r.reps} · up {num(r.gain)}
                  </small>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span className="muted">No personal records this week.</span>
        )}
        <span className="go">Open lifts ›</span>
      </button>

      <h3>Nutrition adherence</h3>
      <div className="strip" role="list">
        {s.adherence.days.map((d) => {
          const tone = d.future ? 'future' : d.within == null ? 'none' : d.within ? 'hit' : 'miss'
          const label = d.future ? 'not yet' : !d.logged ? 'nothing logged' : d.within == null ? 'no targets' : d.within ? 'within tolerance' : 'outside tolerance'
          return (
            <button key={d.date} role="listitem" className={`day ${tone}`} disabled={d.future} aria-label={`${short(d.date)}: ${label}`} onClick={() => go('food', { date: d.date })}>
              <span>{short(d.date)}</span>
              <strong>{d.future ? '' : d.within == null ? '·' : d.within ? '✓' : '✕'}</strong>
            </button>
          )
        })}
      </div>
      <div className="setactions">
        <button className="link" onClick={() => go('food', { week: true })}>
          See the numbers ›
        </button>
        <button className="link" onClick={exportCsv}>
          Export week (CSV)
        </button>
      </div>
    </section>
  )
}
