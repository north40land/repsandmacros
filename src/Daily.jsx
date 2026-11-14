import { useState } from 'react'
import { write, uuid, nowISO } from './db'
import { hhmm, niceTime } from './dosing'

// Water and sleep: the two quick daily inputs on the day view (Phase 6).

const OZ_TO_ML = 29.5735
const tidy = (n) => Math.round(n * 10) / 10
const show = (n) => Number(tidy(n)).toLocaleString(undefined, { maximumFractionDigits: 1 })

function Meter({ label, value, goal, unit }) {
  if (!(goal > 0)) return null
  const left = tidy(goal - value)
  return (
    <div className="bar">
      <p className="barline">
        <span>{label}</span>
        <span>{left > 0 ? `${show(left)} ${unit} to go` : 'Target reached'}</span>
      </p>
      <div className="track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(value, goal)}>
        <div style={{ width: `${Math.min(100, Math.round((value / goal) * 100))}%` }} />
      </div>
    </div>
  )
}

// Water is stored in ounces; people who use kilograms see and enter millilitres.
export function Water({ v, date, target, onTargets }) {
  const metric = v.profile.default_unit === 'kg'
  const unit = metric ? 'ml' : 'oz'
  const toUnit = (oz) => (metric ? Math.round(oz * OZ_TO_ML) : tidy(oz))
  const [custom, setCustom] = useState('')
  const logs = [...(v.water[date] || [])].sort((a, b) => Date.parse(a.logged_at) - Date.parse(b.logged_at))
  const total = logs.reduce((n, l) => n + Number(l.amount_oz), 0)
  const goal = target?.water_oz > 0 ? Number(target.water_oz) : null
  const amount = Number(custom)
  const validCustom = custom.trim() !== '' && amount > 0 && amount <= (metric ? 5000 : 170)

  const add = (inUnit) =>
    write([['water_logs', { id: uuid(), logged_on: date, amount_oz: tidy(metric ? inUnit / OZ_TO_ML : inUnit), logged_at: nowISO() }]])
  const last = logs[logs.length - 1]

  return (
    <>
      <div className="h3row">
        <h3>Water</h3>
        <small>
          {show(toUnit(total))}
          {goal ? ` of ${show(toUnit(goal))}` : ''} {unit}
        </small>
      </div>
      <div className="card">
        <Meter label="Today's water" value={toUnit(total)} goal={goal ? toUnit(goal) : null} unit={unit} />
        <div className="quick">
          {(metric ? [250, 500] : [8, 16]).map((n) => (
            <button key={n} className="secondary" onClick={() => add(n)}>
              + {n} {unit}
            </button>
          ))}
        </div>
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault()
            if (!validCustom) return
            add(amount)
            setCustom('')
          }}
        >
          <input inputMode="decimal" aria-label={`Custom amount in ${unit}`} placeholder={`Other amount (${unit})`} value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="primary" disabled={!validCustom}>
            Add
          </button>
        </form>
        <div className="setactions">
          {last ? (
            <button className="link" onClick={() => write([['water_logs', { id: last.id, deleted_at: nowISO() }]])}>
              Undo last ({show(toUnit(Number(last.amount_oz)))} {unit})
            </button>
          ) : (
            <span />
          )}
          {!goal && (
            <button className="link" onClick={onTargets}>
              Set a water target ›
            </button>
          )}
        </div>
      </div>
    </>
  )
}

const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
// Hours between bedtime and waking, allowing for sleep that crosses midnight.
export const sleepHours = (bed, wake) => (bed && wake ? Math.round((((minutes(wake) - minutes(bed) + 1440) % 1440) / 60) * 100) / 100 : 0)

// One entry per night, filed under the day you woke up.
export function Sleep({ v, date, target, onTargets }) {
  const entry = v.sleep[date]
  const [editing, setEditing] = useState(false)
  const [bed, setBed] = useState('22:30')
  const [wake, setWake] = useState('06:30')
  const [quality, setQuality] = useState(null)
  const goal = target?.sleep_hours > 0 ? Number(target.sleep_hours) : null
  const hours = sleepHours(bed, wake)

  const open = () => {
    setBed(hhmm(entry?.bed_time) || '22:30')
    setWake(hhmm(entry?.wake_time) || '06:30')
    setQuality(entry?.quality ?? null)
    setEditing(true)
  }
  const save = () => {
    write([['sleep_logs', { slept_on: date, bed_time: bed, wake_time: wake, hours, quality, deleted_at: null }]])
    setEditing(false)
  }
  const remove = () => {
    write([['sleep_logs', { slept_on: date, deleted_at: nowISO() }]])
    setEditing(false)
  }

  return (
    <>
      <div className="h3row">
        <h3>Sleep</h3>
        {entry && (
          <small>
            {show(entry.hours)}
            {goal ? ` of ${show(goal)}` : ''} h
          </small>
        )}
      </div>
      <div className="card">
        {editing ? (
          <>
            <div className="two">
              <label>
                Bedtime
                <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
              </label>
              <label>
                Woke up
                <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
              </label>
            </div>
            <p className="rx">{hours > 0 ? `${show(hours)} hours` : 'Enter both times'}</p>
            <p className="fieldname">Quality (optional)</p>
            <div className="chips">
              {[1, 2, 3, 4, 5].map((q) => (
                <button key={q} aria-pressed={quality === q} aria-label={`Quality ${q} of 5`} onClick={() => setQuality(quality === q ? null : q)}>
                  {q}
                </button>
              ))}
            </div>
            <p className="muted small">1 is poor, 5 is great.</p>
            <button className="primary" disabled={!(hours > 0)} onClick={save}>
              Save sleep
            </button>
            <div className="setactions">
              <button className="link" onClick={() => setEditing(false)}>
                Cancel
              </button>
              {entry && (
                <button className="link danger-text" onClick={remove}>
                  Remove this entry
                </button>
              )}
            </div>
          </>
        ) : entry ? (
          <>
            <Meter label="Last night" value={Number(entry.hours)} goal={goal} unit="h" />
            <p className="rx">{show(entry.hours)} hours</p>
            <p className="muted small">
              {niceTime(entry.bed_time)} to {niceTime(entry.wake_time)}
              {entry.quality ? ` · quality ${entry.quality} of 5` : ''}
            </p>
            <div className="setactions">
              <button className="link" onClick={open}>
                Edit
              </button>
              {!goal && (
                <button className="link" onClick={onTargets}>
                  Set a sleep target ›
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="muted">Nothing logged for the night before this day.</p>
            <button className="secondary" onClick={open}>
              Log sleep
            </button>
          </>
        )}
      </div>
    </>
  )
}
