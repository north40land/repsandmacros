import { useState } from 'react'
import { write, uuid, nowISO } from './db'
import { localDate } from './logic'
import { latestTarget } from './nutrition'

const FIELDS = [
  ['calories', 'Calories'],
  ['protein', 'Protein (g)'],
  ['carbs', 'Carbs (g)'],
  ['fat', 'Fat (g)'],
  ['water_oz', 'Water (oz)'],
  ['sleep_hours', 'Sleep (hours)'],
]

const toForm = (row) => Object.fromEntries(FIELDS.map(([k]) => [k, row?.[k] == null ? '' : String(row[k])]))
const ok = (form) => FIELDS.every(([k]) => form[k] === '' || Number(form[k]) >= 0)
const toRow = (form) => Object.fromEntries(FIELDS.map(([k]) => [k, form[k] === '' ? null : Number(form[k])]))

// Daily targets. Each save is dated, so past days keep the targets they had at the time.
export default function Targets({ v, onClose, onCalculator }) {
  const today = localDate()
  const [training, setTraining] = useState(() => toForm(latestTarget(v, 'training')))
  const [rest, setRest] = useState(() => toForm(latestTarget(v, 'rest')))
  const [separate, setSeparate] = useState(v.targets.some((t) => t.day_type === 'rest'))
  const valid = ok(training) && (!separate || ok(rest))

  const save = () => {
    const ops = []
    const put = (dayType, form) => {
      const todays = v.targets.find((t) => t.day_type === dayType && t.effective_from === today)
      ops.push(['user_targets', { id: todays?.id || uuid(), day_type: dayType, effective_from: today, computed: false, ...toRow(form) }])
    }
    put('training', training)
    if (separate) put('rest', rest)
    // Switching rest-day targets off removes them, so every day uses the main targets again.
    else for (const t of v.targets.filter((x) => x.day_type === 'rest')) ops.push(['user_targets', { id: t.id, deleted_at: nowISO() }])
    // Typing targets in by hand switches off the calculator's automatic updates.
    if (v.metrics?.auto) ops.push(['user_profile_metrics', { auto: false }])
    write(ops)
    onClose()
  }

  const fields = (form, setForm, prefix) =>
    FIELDS.map(([key, label]) => (
      <label key={key}>
        {label}
        <input
          inputMode="decimal"
          aria-label={`${prefix} ${label}`}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      </label>
    ))

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Nutrition</p>
        <h2>Daily targets</h2>
        <p className="muted">Leave a box empty if you do not want a target for it. Changes apply from today onward.</p>
      </div>

      <button className="card libcard" onClick={onCalculator}>
        <span className="programhead">
          <strong>Calculate my targets</strong>
          {v.metrics?.auto && v.metrics?.birth_date && <em>In use</em>}
        </span>
        <span className="phasenote">Work out calories and macros from your height, weight, activity and goal.</span>
        <span className="go">Open the calculator ›</span>
      </button>
      {v.metrics?.auto && v.metrics?.birth_date && <p className="muted small">Saving this page by hand turns off the calculator's automatic updates.</p>}

      <h3>{separate ? 'Training days' : 'Every day'}</h3>
      <div className="card targetgrid">{fields(training, setTraining, separate ? 'Training day' : 'Daily')}</div>

      <label className="toggle">
        <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
        Use different targets on rest days
      </label>
      {separate && (
        <>
          <p className="muted small">A day counts as a training day when you log a workout on it.</p>
          <h3>Rest days</h3>
          <div className="card targetgrid">{fields(rest, setRest, 'Rest day')}</div>
        </>
      )}

      <div className="actions">
        {!valid && <p className="warn small">Targets must be 0 or more.</p>}
        <button className="primary" disabled={!valid} onClick={save}>
          Save targets
        </button>
      </div>
    </section>
  )
}
