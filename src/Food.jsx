import { useState } from 'react'
import { write, nowISO } from './db'
import { localDate, fromLocalDate, niceDate } from './logic'
import { MEALS, MACROS, MACRO_LABEL, fmt, round, sum, targetFor } from './nutrition'
import { askConfirm } from './confirm'
import AddFood from './AddFood'
import Targets from './Targets'

const shift = (date, days) => {
  const d = new Date(fromLocalDate(date))
  d.setDate(d.getDate() + days)
  return localDate(d.toISOString())
}

export default function Food({ v }) {
  const today = localDate()
  const [date, setDate] = useState(today)
  const [screen, setScreen] = useState(null)
  const close = () => setScreen(null)

  if (screen?.type === 'add') return <AddFood v={v} date={date} meal={screen.meal} onClose={close} />
  if (screen?.type === 'targets') return <Targets v={v} onClose={close} />
  const editing = screen?.type === 'edit' && (v.foodLogs[date] || []).find((l) => l.id === screen.id)
  if (editing) return <EditEntry log={editing} onClose={close} />

  const logs = v.foodLogs[date] || []
  const totals = sum(logs)
  const { target, dayType, hasRest } = targetFor(v, date)

  return (
    <section>
      <div className="weekhead">
        <p className="eyebrow">Nutrition</p>
        <div className="datenav">
          <button aria-label="Previous day" onClick={() => setDate(shift(date, -1))}>
            ‹
          </button>
          <h2>{date === today ? 'Today' : niceDate(fromLocalDate(date))}</h2>
          <button aria-label="Next day" disabled={date >= today} onClick={() => setDate(shift(date, 1))}>
            ›
          </button>
        </div>
        {hasRest && <p className="muted small">{dayType === 'training' ? 'Training day targets' : 'Rest day targets'}</p>}
      </div>

      <div className="card totals">
        {target ? (
          ['calories', 'protein', 'carbs', 'fat'].map((m) => <Bar key={m} macro={m} eaten={totals[m]} goal={target[m]} />)
        ) : (
          <>
            <p className="rx">{fmt(totals.calories)} calories</p>
            <p className="muted small">
              Protein {fmt(totals.protein)} g · Carbs {fmt(totals.carbs)} g · Fat {fmt(totals.fat)} g
            </p>
          </>
        )}
        <p className="muted small">Fiber {fmt(totals.fiber)} g</p>
        <button className="link" onClick={() => setScreen({ type: 'targets' })}>
          {target ? 'Edit targets' : 'Set daily targets ›'}
        </button>
      </div>

      {MEALS.map(([id, name]) => {
        const items = logs.filter((l) => l.meal === id)
        return (
          <div key={id}>
            <div className="h3row">
              <h3>{name}</h3>
              {items.length > 0 && <small>{fmt(sum(items).calories)} cal</small>}
            </div>
            {items.length > 0 && (
              <ul className="list">
                {items.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => setScreen({ type: 'edit', id: l.id })}>
                      <span>
                        {l.name}
                        <small className="left">
                          {fmt(l.quantity)} {l.unit === 'serving' ? (Number(l.quantity) === 1 ? 'serving' : 'servings') : l.unit}
                          {l.brand ? ` · ${l.brand}` : ''}
                        </small>
                      </span>
                      <small>
                        {fmt(l.calories)} cal
                        <br />P {fmt(l.protein)} · C {fmt(l.carbs)} · F {fmt(l.fat)}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="secondary addfood" onClick={() => setScreen({ type: 'add', meal: id })}>
              Add food to {name.toLowerCase()}
            </button>
          </div>
        )
      })}
    </section>
  )
}

function Bar({ macro, eaten, goal }) {
  const unit = macro === 'calories' ? '' : ' g'
  if (!(goal > 0)) {
    return (
      <p className="barline">
        <span>{MACRO_LABEL[macro]}</span>
        <span>
          {fmt(eaten)}
          {unit}
        </span>
      </p>
    )
  }
  const left = round(goal - eaten, macro === 'calories' ? 0 : 1)
  const pct = Math.min(100, Math.round((eaten / goal) * 100))
  return (
    <div className="bar">
      <p className="barline">
        <span>{MACRO_LABEL[macro]}</span>
        <span>
          {fmt(eaten)} of {fmt(goal)}
          {unit} · {left >= 0 ? `${fmt(left)}${unit} left` : `${fmt(-left)}${unit} over`}
        </span>
      </p>
      <div
        className={left < 0 ? 'track over' : 'track'}
        role="progressbar"
        aria-label={MACRO_LABEL[macro]}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(eaten, goal)}
      >
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Change the amount, meal or numbers of something already logged.
function EditEntry({ log, onClose }) {
  const [quantity, setQuantity] = useState(String(log.quantity))
  const [meal, setMeal] = useState(log.meal)
  const [manual, setManual] = useState(null)
  const q = Number(quantity)
  const valid = q > 0 && (!manual || MACROS.every((m) => Number(manual[m]) >= 0 && manual[m] !== ''))
  // Changing the amount scales the logged numbers in proportion.
  const scaled = Object.fromEntries(
    MACROS.map((m) => [m, round((Number(log[m]) || 0) * (q > 0 ? q / log.quantity : 1), m === 'calories' ? 0 : 1)]),
  )

  const save = () => {
    const values = manual ? Object.fromEntries(MACROS.map((m) => [m, Number(manual[m])])) : scaled
    write([['food_logs', { id: log.id, quantity: q, meal, ...values }]])
    onClose()
  }
  const remove = async () => {
    if (!(await askConfirm(`Remove ${log.name} from this day?`, { ok: 'Remove', danger: true }))) return
    write([['food_logs', { id: log.id, deleted_at: nowISO() }]])
    onClose()
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Edit entry</p>
        <h2>{log.name}</h2>
        {log.brand && <p className="muted">{log.brand}</p>}
      </div>
      <div className="card">
        <label>
          Amount ({log.unit})
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label>
          Meal
          <select value={meal} onChange={(e) => setMeal(e.target.value)}>
            {MEALS.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <MacroFields values={manual || scaled} editable={Boolean(manual)} onChange={(m, val) => setManual({ ...(manual || scaled), [m]: val })} />
        {!manual && (
          <button className="link" onClick={() => setManual(Object.fromEntries(MACROS.map((m) => [m, String(scaled[m])])))}>
            Edit the numbers by hand
          </button>
        )}
      </div>
      <div className="actions">
        {!valid && <p className="warn small">Enter an amount above 0 and numbers of 0 or more.</p>}
        <button className="primary" disabled={!valid} onClick={save}>
          Save changes
        </button>
        <button className="danger" onClick={remove}>
          Remove from this day
        </button>
      </div>
    </section>
  )
}

export function MacroFields({ values, editable, onChange }) {
  return (
    <div className="macrogrid">
      {MACROS.map((m) => (
        <label key={m}>
          {MACRO_LABEL[m]}
          {m === 'calories' ? '' : ' (g)'}
          <input
            inputMode="decimal"
            value={values[m] ?? ''}
            readOnly={!editable}
            className={editable ? '' : 'readonly'}
            onChange={(e) => onChange(m, e.target.value)}
          />
        </label>
      ))}
    </div>
  )
}
