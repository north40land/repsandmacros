import { useState } from 'react'
import { write, uuid, nowISO } from './db'
import { localDate, fromLocalDate, niceDate, convert } from './logic'
import { addDays, targetOps } from './calc'
import { askConfirm } from './confirm'
import TrendChart from './TrendChart'

// Series colours for the two-line weight chart. Validated together against the card
// colour for dark mode (lightness band, colour-blind separation, contrast).
const BLUE = '#3987e5'
const ORANGE = '#d95926'

export const MEASURES = [
  ['neck', 'Neck'],
  ['shoulders', 'Shoulders'],
  ['chest', 'Chest'],
  ['waist', 'Waist'],
  ['hips', 'Hips'],
  ['left_arm', 'Left arm'],
  ['right_arm', 'Right arm'],
  ['left_thigh', 'Left thigh'],
  ['right_thigh', 'Right thigh'],
  ['calves', 'Calves'],
]
const RANGES = [
  ['4w', '4 weeks', 28],
  ['12w', '12 weeks', 84],
  ['6m', '6 months', 183],
  ['all', 'All', null],
]

const tidy = (n) => Math.round(n * 10) / 10
const show = (n) => Number(tidy(n)).toLocaleString(undefined, { maximumFractionDigits: 1 })
const length = (value, from, to) => (value == null || from === to ? value : tidy(to === 'cm' ? value * 2.54 : value / 2.54))

export default function Body({ v, startCheckIn }) {
  const unit = v.profile.default_unit
  const lengthUnit = unit === 'kg' ? 'cm' : 'in'
  const today = localDate()
  const [range, setRange] = useState('12w')
  const [measure, setMeasure] = useState('body_fat')
  const [editing, setEditing] = useState(startCheckIn ? 'new' : null) // 'new' | an entry

  if (editing) return <CheckIn v={v} entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />

  const days = RANGES.find(([id]) => id === range)[2]
  const from = days ? addDays(today, -days) : '0000-00-00'
  const entries = v.bodyMetrics
  const weights = entries.filter((e) => e.weight != null).map((e) => ({ date: e.measured_on, value: convert(Number(e.weight), e.unit || 'lb', unit) }))

  // 7-day rolling average: the mean of every weigh-in from that day and the six before it.
  const average = weights.map((p) => {
    const window = weights.filter((q) => q.date <= p.date && q.date > addDays(p.date, -7))
    return { date: p.date, value: tidy(window.reduce((n, q) => n + q.value, 0) / window.length) }
  })
  const inRange = (p) => p.date >= from

  const latest = weights[weights.length - 1]
  const changeOver = (n) => {
    if (!latest) return null
    const cutoff = addDays(latest.date, -n)
    const then = [...weights].reverse().find((p) => p.date <= cutoff)
    return then ? tidy(latest.value - then.value) : null
  }
  const delta = (n) => {
    const d = changeOver(n)
    return d == null ? 'n/a' : `${d > 0 ? '+' : ''}${show(d)} ${unit}`
  }

  const valueOf = (e, key) => (key === 'body_fat' ? (e.body_fat == null ? null : Number(e.body_fat)) : length(e.measurements?.[key] ?? null, e.measurements?.unit || 'in', lengthUnit))
  const options = [['body_fat', 'Body fat'], ...MEASURES].filter(([key]) => entries.some((e) => valueOf(e, key) != null))
  const chosen = options.some(([key]) => key === measure) ? measure : options[0]?.[0]
  const measurePoints = chosen ? entries.filter((e) => valueOf(e, chosen) != null).map((e) => ({ date: e.measured_on, value: valueOf(e, chosen) })) : []

  return (
    <>
      {latest ? (
        <div className="prs three-up">
          <div>
            <small>Current weight</small>
            <strong>
              {show(latest.value)} {unit}
            </strong>
            <small>{niceDate(fromLocalDate(latest.date))}</small>
          </div>
          <div>
            <small>7 days</small>
            <strong>{delta(7)}</strong>
          </div>
          <div>
            <small>30 days</small>
            <strong>{delta(30)}</strong>
          </div>
        </div>
      ) : (
        <p className="muted">No check-ins yet. Log your weight to start the trend line.</p>
      )}
      {latest && (changeOver(7) == null || changeOver(30) == null) && (
        <p className="muted small">Changes appear once there is a weigh-in from at least that long ago.</p>
      )}

      <button className="primary" onClick={() => setEditing('new')}>
        Log a check-in
      </button>

      {entries.length > 0 && (
        <>
          <div className="seg four rangeseg" role="tablist" aria-label="Chart range">
            {RANGES.map(([id, name]) => (
              <button key={id} role="tab" aria-selected={range === id} onClick={() => setRange(id)}>
                {name}
              </button>
            ))}
          </div>

          <h3>Weight</h3>
          <div className="card">
            <TrendChart
              title="Weight"
              unit={unit}
              series={[
                { name: 'Weigh-in', color: BLUE, dots: true, points: weights.filter(inRange) },
                { name: '7-day average', color: ORANGE, points: average.filter(inRange) },
              ]}
            />
          </div>

          {options.length > 0 && (
            <>
              <h3>Measurements</h3>
              <div className="card">
                <label>
                  Show
                  <select value={chosen} onChange={(e) => setMeasure(e.target.value)}>
                    {options.map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <TrendChart
                  title={options.find(([key]) => key === chosen)[1]}
                  unit={chosen === 'body_fat' ? '%' : lengthUnit}
                  series={[{ name: options.find(([key]) => key === chosen)[1], color: BLUE, dots: true, points: measurePoints.filter(inRange) }]}
                />
              </div>
            </>
          )}

          <h3>Check-ins</h3>
          <ul className="list">
            {[...entries].reverse().map((e) => {
              const count = MEASURES.filter(([key]) => e.measurements?.[key] != null).length
              return (
                <li key={e.id}>
                  <button onClick={() => setEditing(e)}>
                    <span>
                      {niceDate(fromLocalDate(e.measured_on))}
                      <small className="left">
                        {[e.body_fat != null ? `${show(e.body_fat)}% body fat` : null, count ? `${count} ${count === 1 ? 'measurement' : 'measurements'}` : null]
                          .filter(Boolean)
                          .join(' · ') || 'Weight only'}
                      </small>
                    </span>
                    <small>{e.weight != null ? `${show(convert(Number(e.weight), e.unit || 'lb', unit))} ${unit}` : 'No weight'}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}

// Log or edit one day's weight, body fat and measurements.
function CheckIn({ v, entry, onClose }) {
  const unit = v.profile.default_unit
  const lengthUnit = unit === 'kg' ? 'cm' : 'in'
  const today = localDate()
  const text = (x) => (x == null ? '' : String(x))
  const [date, setDate] = useState(entry?.measured_on || today)
  const [weight, setWeight] = useState(text(entry?.weight != null ? convert(Number(entry.weight), entry.unit || 'lb', unit) : null))
  const [fat, setFat] = useState(text(entry?.body_fat))
  const [m, setM] = useState(
    Object.fromEntries(MEASURES.map(([key]) => [key, text(length(entry?.measurements?.[key] ?? null, entry?.measurements?.unit || 'in', lengthUnit))])),
  )

  const num = (s) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s))
  const w = num(weight)
  const f = num(fat)
  const sizes = Object.fromEntries(MEASURES.map(([key]) => [key, num(m[key])]).filter(([, val]) => val != null))
  const problems = []
  if (!date || date > today) problems.push('The date cannot be in the future.')
  if (weight.trim() !== '' && !(w > 0)) problems.push('Weight must be above 0.')
  if (fat.trim() !== '' && !(f >= 0 && f <= 100)) problems.push('Body fat must be between 0 and 100.')
  if (Object.values(sizes).some((x) => !(x > 0))) problems.push('Measurements must be above 0.')
  if (w == null && f == null && !Object.keys(sizes).length) problems.push('Enter a weight, body fat or at least one measurement.')
  const clash = !entry || entry.measured_on !== date ? v.bodyMetrics.find((b) => b.measured_on === date) : null

  const save = () => {
    const id = entry?.id || clash?.id || uuid()
    const row = {
      id,
      measured_on: date,
      weight: w,
      unit,
      body_fat: f,
      measurements: Object.keys(sizes).length ? { unit: lengthUnit, ...sizes } : null,
      deleted_at: null,
    }
    const ops = [['body_metrics', row]]
    // A new most-recent weight moves calculated targets along with it.
    const newest = !v.bodyMetrics.some((b) => b.weight != null && b.id !== id && b.measured_on > date)
    if (w != null && newest && v.metrics?.auto && v.metrics?.birth_date) ops.push(...targetOps(v, v.metrics, convert(w, unit, 'lb')))
    write(ops)
    onClose()
  }

  const remove = async () => {
    if (!(await askConfirm(`Delete the check-in for ${niceDate(fromLocalDate(entry.measured_on))}?`, { ok: 'Delete', danger: true }))) return
    write([['body_metrics', { id: entry.id, deleted_at: nowISO() }]])
    onClose()
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Body</p>
        <h2>{entry ? 'Edit check-in' : 'Log a check-in'}</h2>
      </div>

      <div className="card">
        <label>
          Date
          <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="two">
          <label>
            Weight ({unit})
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label>
            Body fat (%)
            <input inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
          </label>
        </div>
        {clash && <p className="muted small">There is already a check-in on this date. Saving will replace it.</p>}
        {v.metrics?.auto && v.metrics?.birth_date && <p className="muted small">Your calculated targets update when you log a new weight.</p>}
      </div>

      <details className="card extras" open={Object.keys(sizes).length > 0}>
        <summary>Measurements ({lengthUnit}, optional)</summary>
        <div className="targetgrid spaced">
          {MEASURES.map(([key, name]) => (
            <label key={key}>
              {name}
              <input inputMode="decimal" value={m[key]} onChange={(e) => setM({ ...m, [key]: e.target.value })} />
            </label>
          ))}
        </div>
      </details>

      <div className="actions">
        {problems.length > 0 && <p className="warn small">{problems[0]}</p>}
        <button className="primary" disabled={problems.length > 0} onClick={save}>
          Save check-in
        </button>
        {entry && (
          <button className="danger" onClick={remove}>
            Delete this check-in
          </button>
        )}
      </div>
    </section>
  )
}
