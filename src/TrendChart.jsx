import { useState } from 'react'
import { fromLocalDate } from './logic'

// A small line chart for values over time.
//   series: [{ name, color, dots, points: [{ date: 'YYYY-MM-DD', value }] }]
// Colours are passed in by the caller (validated pairs live in Body.jsx). Text always uses
// the app's text colours; a short stroke of the series colour beside a label carries identity.
// Touch or hover moves a hairline to the nearest date and the readout under the chart
// shows every series at that date. The same numbers are in the history list on the page.

const W = 320
const H = 170
const M = { top: 10, right: 12, bottom: 22, left: 38 }
const SURFACE = '#ffffff'

const day = (date) => Date.parse(fromLocalDate(date))
const label = (date) => new Date(fromLocalDate(date)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const tidy = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })

export default function TrendChart({ series, unit, title }) {
  const all = series.flatMap((s) => s.points)
  const dates = [...new Set(all.map((p) => p.date))].sort()
  const [picked, setPicked] = useState(null)
  if (dates.length < 2) return <p className="muted small">The chart appears once there are two entries in this range.</p>

  const t0 = day(dates[0])
  const t1 = day(dates[dates.length - 1])
  const values = all.map((p) => p.value)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = (hi - lo || Math.abs(hi) * 0.02 || 1) * 0.15
  lo -= pad
  hi += pad
  const x = (date) => M.left + ((day(date) - t0) / (t1 - t0 || 1)) * (W - M.left - M.right)
  const y = (value) => M.top + (1 - (value - lo) / (hi - lo)) * (H - M.top - M.bottom)
  const ticks = [0, 0.5, 1].map((f) => lo + pad + f * (hi - lo - 2 * pad))

  const at = picked && dates.includes(picked) ? picked : dates[dates.length - 1]
  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setPicked(dates.reduce((best, d) => (Math.abs(x(d) - px) < Math.abs(x(best) - px) ? d : best), dates[0]))
  }

  return (
    <figure className="trend">
      {series.length > 1 && (
        <figcaption className="legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} from ${label(dates[0])} to ${label(dates[dates.length - 1])}`} onPointerDown={pick} onPointerMove={pick}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="gridline" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="axis">
              {tidy(t)}
            </text>
          </g>
        ))}
        <text x={M.left} y={H - 6} className="axis">
          {label(dates[0])}
        </text>
        <text x={W - M.right} y={H - 6} textAnchor="end" className="axis">
          {label(dates[dates.length - 1])}
        </text>
        <line x1={x(at)} x2={x(at)} y1={M.top} y2={H - M.bottom} className="hairline" />
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={s.points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dots ? 1 : 2}
              strokeOpacity={s.dots ? 0.5 : 1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.points
              .filter((p) => s.dots || p.date === at)
              .map((p) => (
                <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={p.date === at ? 5 : 4} fill={s.color} stroke={SURFACE} strokeWidth="2" />
              ))}
          </g>
        ))}
      </svg>
      <p className="readout" role="status">
        <strong>{label(at)}</strong>
        {series.map((s) => {
          const p = s.points.find((q) => q.date === at)
          return (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              <b>{p ? `${tidy(p.value)} ${unit}` : 'no entry'}</b>
              {series.length > 1 ? ` ${s.name.toLowerCase()}` : ''}
            </span>
          )
        })}
      </p>
    </figure>
  )
}
