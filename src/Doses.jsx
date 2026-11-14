import { useState } from 'react'
import { write, uuid, nowISO } from './db'
import { localDate, fromLocalDate, niceDate, firstDay } from './logic'
import { addDays, mondayOf } from './calc'
import { DAYS, dueOn, scheduledOn, dueToday, missedOn, logKey, hhmm, niceTime, niceClock } from './dosing'
import { askConfirm } from './confirm'
import Reminders from './Reminders'

const amount = (n, unit) => `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit}`
const schedule = (item) =>
  (item.schedule_days || []).length === 7 ? 'Every day' : DAYS.filter(([d]) => (item.schedule_days || []).includes(d)).map(([, name]) => name).join(', ') || 'No days set'

export default function Doses({ v }) {
  const today = localDate()
  const yesterday = addDays(today, -1)
  const [screen, setScreen] = useState(null)
  const close = () => setScreen(null)

  if (screen?.type === 'item') return <ItemForm v={v} item={v.doseItems.find((i) => i.id === screen.id)} onClose={close} />
  if (screen?.type === 'history') return <History v={v} onClose={close} onOpen={(itemId, date) => setScreen({ type: 'log', itemId, date, from: 'history' })} />
  if (screen?.type === 'log') {
    const item = v.doseItems.find((i) => i.id === screen.itemId)
    if (item) return <LogEdit v={v} item={item} date={screen.date} onClose={() => setScreen(screen.from === 'history' ? { type: 'history' } : null)} />
  }

  const due = dueToday(v, today)
  const missed = missedOn(v, yesterday)
  const others = v.doseItems.filter((i) => !dueOn(i, today))
  const take = (item) =>
    write([['dose_logs', { dose_item_id: item.id, scheduled_on: today, status: 'taken', taken_at: nowISO(), amount_taken: item.amount, deleted_at: null }]])

  return (
    <section>
      <div className="weekhead">
        <p className="eyebrow">Dosing</p>
        <h2>Due today</h2>
        <p className="muted">{niceDate(fromLocalDate(today))}</p>
      </div>

      {missed.length > 0 && (
        <button className="card missedcard" onClick={() => setScreen({ type: 'history' })}>
          <strong>
            Missed yesterday: {missed.length} {missed.length === 1 ? 'item' : 'items'}
          </strong>
          <small>{missed.map((i) => i.name).join(', ')}</small>
          <span className="go">Open history to correct it ›</span>
        </button>
      )}

      {due.length ? (
        <ul className="doses">
          {due.map((item) => {
            const log = v.doseLogs[logKey(item.id, today)]
            return (
              <li key={item.id} className={log ? `dose ${log.status}` : 'dose'}>
                <button className="doseinfo" onClick={() => setScreen({ type: 'log', itemId: item.id, date: today })}>
                  <strong>{item.name}</strong>
                  <small>
                    {amount(item.amount, item.unit)}
                    {item.time_of_day ? ` · ${niceTime(item.time_of_day)}` : ''}
                  </small>
                  {log && (
                    <small className="state">
                      {log.status === 'taken' ? `Taken ${niceClock(log.taken_at)} · ${amount(log.amount_taken, item.unit)}` : 'Skipped'} · tap to change
                    </small>
                  )}
                </button>
                {!log && (
                  <button className="primary logbtn" aria-label={`Log ${item.name}`} onClick={() => take(item)}>
                    Log
                  </button>
                )}
                {log && <span className="tick" aria-hidden="true">{log.status === 'taken' ? '✓' : '–'}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted">{v.doseItems.length ? 'Nothing is scheduled for today.' : 'No items yet. Add what you take and the days you take it.'}</p>
      )}
      {due.some((i) => !v.doseLogs[logKey(i.id, today)]) && <p className="muted small">Tap Log to record the scheduled amount. Tap the name to skip or enter a different amount.</p>}

      {others.length > 0 && (
        <>
          <h3>Not due today</h3>
          <ul className="list">
            {others.map((item) => (
              <li key={item.id}>
                <button onClick={() => setScreen({ type: 'item', id: item.id })}>
                  <span>
                    {item.name}
                    <small className="left">{amount(item.amount, item.unit)}</small>
                  </span>
                  <small>{item.active ? schedule(item) : 'Paused'}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {due.length > 0 && (
        <>
          <h3>Scheduled today</h3>
          <ul className="list">
            {due.map((item) => (
              <li key={item.id}>
                <button onClick={() => setScreen({ type: 'item', id: item.id })}>
                  <span>{item.name}</span>
                  <small>{schedule(item)} · Edit</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="secondary" onClick={() => setScreen({ type: 'item', id: null })}>
        Add an item
      </button>
      {v.doseItems.length > 0 && (
        <button className="secondary" onClick={() => setScreen({ type: 'history' })}>
          History
        </button>
      )}

      {v.doseItems.length > 0 && <Reminders v={v} />}
    </section>
  )
}

// Create or edit something taken on a schedule.
function ItemForm({ v, item, onClose }) {
  const today = localDate()
  const [f, setF] = useState({
    name: item?.name || '',
    amount: item?.amount == null ? '' : String(item.amount),
    unit: item?.unit || '',
    days: item?.schedule_days || [],
    time: hhmm(item?.time_of_day),
    notes: item?.notes || '',
    active: item ? Boolean(item.active) : true,
  })
  const set = (key, value) => setF((x) => ({ ...x, [key]: value }))
  const valid = f.name.trim() && Number(f.amount) > 0 && f.unit.trim() && f.days.length > 0

  const save = () => {
    const row = {
      id: item?.id || uuid(),
      name: f.name.trim(),
      amount: Number(f.amount),
      unit: f.unit.trim(),
      schedule_days: [...f.days].sort(),
      time_of_day: f.time || null,
      notes: f.notes.trim() || null,
      active: f.active,
    }
    if (!item) row.starts_on = today
    // Switching an item back on starts it fresh: the paused days do not count as missed.
    if (item && !item.active && f.active) row.missed_through = addDays(today, -1)
    write([['dose_items', row]])
    onClose()
  }

  const remove = async () => {
    if (!(await askConfirm(`Delete ${item.name} and its history?`, { ok: 'Delete', danger: true }))) return
    write([['dose_items', { id: item.id, deleted_at: nowISO() }]])
    onClose()
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Dosing</p>
        <h2>{item ? 'Edit item' : 'Add an item'}</h2>
      </div>

      <div className="card">
        <label>
          Name
          <input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="two">
          <label>
            Dose amount
            <input inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
          </label>
          <label>
            Unit
            <input value={f.unit} placeholder="mg, ml, IU, capsule" autoCapitalize="none" onChange={(e) => set('unit', e.target.value)} />
          </label>
        </div>
        <p className="fieldname">Days</p>
        <div className="chips">
          {DAYS.map(([d, name]) => {
            const on = f.days.includes(d)
            return (
              <button type="button" key={d} aria-pressed={on} onClick={() => set('days', on ? f.days.filter((x) => x !== d) : [...f.days, d])}>
                {name}
              </button>
            )
          })}
        </div>
        <button className="link" onClick={() => set('days', f.days.length === 7 ? [] : DAYS.map(([d]) => d))}>
          {f.days.length === 7 ? 'Clear all days' : 'Every day'}
        </button>
        <label>
          Time of day (optional)
          <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
        </label>
        <label>
          Notes (optional)
          <input value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        {item && (
          <label className="toggle">
            <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
            Active
          </label>
        )}
        {item && !f.active && <p className="muted small">A paused item is not due and does not count as missed.</p>}
      </div>

      <div className="actions">
        {!valid && <p className="warn small">An item needs a name, an amount above 0, a unit, and at least one day.</p>}
        <button className="primary" disabled={!valid} onClick={save}>
          {item ? 'Save item' : 'Add item'}
        </button>
        {item && (
          <button className="danger" onClick={remove}>
            Delete this item
          </button>
        )}
      </div>
    </section>
  )
}

const STATUSES = [
  ['taken', 'Taken'],
  ['skipped', 'Skipped'],
  ['missed', 'Missed'],
]

// Record or correct one day's entry for an item.
function LogEdit({ v, item, date, onClose }) {
  const today = localDate()
  const log = v.doseLogs[logKey(item.id, date)]
  const [status, setStatus] = useState(log?.status || 'taken')
  const [qty, setQty] = useState(String(log?.amount_taken ?? item.amount))
  const startTime = log?.taken_at ? new Date(log.taken_at) : date === today ? new Date() : null
  const pad = (x) => String(x).padStart(2, '0')
  const [time, setTime] = useState(startTime ? `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}` : hhmm(item.time_of_day) || '12:00')
  const valid = status !== 'taken' || (Number(qty) >= 0 && qty !== '' && time)

  const save = () => {
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    write([
      [
        'dose_logs',
        {
          dose_item_id: item.id,
          scheduled_on: date,
          status,
          taken_at: status === 'taken' ? new Date(y, m - 1, d, hh, mm).toISOString() : null,
          amount_taken: status === 'taken' ? Number(qty) : null,
          deleted_at: null,
        },
      ],
    ])
    onClose()
  }
  const clear = () => {
    write([['dose_logs', { dose_item_id: item.id, scheduled_on: date, deleted_at: nowISO() }]])
    onClose()
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">{date === today ? 'Today' : niceDate(fromLocalDate(date))}</p>
        <h2>{item.name}</h2>
        <p className="muted">
          Scheduled: {amount(item.amount, item.unit)}
          {item.time_of_day ? ` at ${niceTime(item.time_of_day)}` : ''}
        </p>
        {item.notes && <p className="muted small">{item.notes}</p>}
      </div>

      <div className="card">
        <div className="seg">
          {STATUSES.filter(([id]) => id !== 'missed' || date < today).map(([id, name]) => (
            <button key={id} aria-selected={status === id} onClick={() => setStatus(id)}>
              {name}
            </button>
          ))}
        </div>
        {status === 'taken' && (
          <div className="two spaced">
            <label>
              Amount taken ({item.unit})
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label>
              Time taken
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <div className="actions">
        {!valid && <p className="warn small">Enter the amount taken and the time.</p>}
        <button className="primary" disabled={!valid} onClick={save}>
          Save
        </button>
        {log && date === today && (
          <button className="danger" onClick={clear}>
            Clear this entry
          </button>
        )}
      </div>
    </section>
  )
}

const MARK = { taken: '✓', missed: '✕', skipped: '–' }
const WORD = { taken: 'taken', missed: 'missed', skipped: 'skipped' }

// One week at a time: every item against every day.
function History({ v, onClose, onOpen }) {
  const today = localDate()
  const thisWeek = mondayOf(today)
  const [start, setStart] = useState(thisWeek)
  const firstWeek = mondayOf(firstDay(v))
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const short = (d) => new Date(fromLocalDate(d)).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
  const range = `${niceDate(fromLocalDate(dates[0])).split(', ')[1]} to ${niceDate(fromLocalDate(dates[6])).split(', ')[1]}`

  const rows = v.doseItems
    .map((item) => ({
      item,
      cells: dates.map((d) => {
        const log = v.doseLogs[logKey(item.id, d)]
        if (log) return { d, status: log.status }
        if (d >= today && dueOn(item, d)) return { d, status: 'due' }
        return { d, status: scheduledOn(item, d) && item.active && d < today ? 'pending' : null }
      }),
    }))
    .filter((r) => r.cells.some((c) => c.status))
  const count = (status) => rows.reduce((n, r) => n + r.cells.filter((c) => c.status === status).length, 0)

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Dosing history</p>
        <div className="datenav">
          <button aria-label="Previous week" disabled={start <= firstWeek} onClick={() => setStart(addDays(start, -7))}>
            ‹
          </button>
          <h2>{start === thisWeek ? 'This week' : range}</h2>
          <button aria-label="Next week" disabled={start >= thisWeek} onClick={() => setStart(addDays(start, 7))}>
            ›
          </button>
        </div>
        {start === thisWeek && <p className="muted small center">{range}</p>}
      </div>

      {rows.length ? (
        <>
          <div className="card">
            <p className="rx">
              {count('taken')} taken · {count('missed')} missed · {count('skipped')} skipped
            </p>
            <table className="grid">
              <thead>
                <tr>
                  <th>Item</th>
                  {dates.map((d) => (
                    <th key={d} className={d === today ? 'now' : ''}>
                      {short(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, cells }) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    {cells.map((c) => {
                      const open = c.status && c.status !== 'pending' && (c.status !== 'due' || c.d === today)
                      const label = `${item.name}, ${niceDate(fromLocalDate(c.d))}: ${WORD[c.status] || (c.status === 'due' ? 'due' : 'not scheduled')}`
                      return (
                        <td key={c.d}>
                          {open ? (
                            <button className={`cell ${c.status}`} aria-label={label} onClick={() => onOpen(item.id, c.d)}>
                              {MARK[c.status] || '·'}
                            </button>
                          ) : (
                            <span className="cell empty" aria-label={label}>
                              {c.status === 'due' ? '·' : ''}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">✓ taken · ✕ missed · – skipped · dot is still due. Tap a mark to change it.</p>
        </>
      ) : (
        <p className="muted">Nothing was scheduled this week.</p>
      )}
    </section>
  )
}
