import { localDate, fromLocalDate } from './logic'
import { addDays } from './calc'

// Scheduled dosing (Phase 4). An item is due on the weekdays in its schedule;
// each item has at most one log per day: taken, skipped or missed.

export const DAYS = [
  [0, 'Sun'],
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
]

export const weekday = (date) => new Date(fromLocalDate(date)).getDay()
export const logKey = (itemId, date) => `${itemId}|${date}`
export const scheduledOn = (item, date) => (item.schedule_days || []).includes(weekday(date)) && date >= item.starts_on
export const dueOn = (item, date) => item.active && scheduledOn(item, date)

export const hhmm = (t) => (t ? String(t).slice(0, 5) : '')
export function niceTime(t) {
  if (!t) return ''
  const [h, m] = hhmm(t).split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
export const niceClock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const byTime = (a, b) => (hhmm(a.time_of_day) || '99').localeCompare(hhmm(b.time_of_day) || '99') || a.name.localeCompare(b.name)

export function dueToday(v, date = localDate()) {
  return v.doseItems.filter((i) => dueOn(i, date)).sort(byTime)
}

export function missedOn(v, date) {
  return v.doseItems.filter((i) => v.doseLogs[logKey(i.id, date)]?.status === 'missed')
}

// Any scheduled day that ended with nothing logged becomes a "missed" entry.
// Each item remembers how far this has been done (missed_through), so it runs once per day.
const BACKFILL_DAYS = 60

export function missedOps(v) {
  const yesterday = addDays(localDate(), -1)
  const floor = addDays(yesterday, -BACKFILL_DAYS)
  const ops = []
  for (const item of v.doseItems) {
    if (!item.active) continue
    let from = item.missed_through ? addDays(item.missed_through, 1) : item.starts_on
    if (from < floor) from = floor
    if (from > yesterday) continue
    for (let d = from; d <= yesterday; d = addDays(d, 1)) {
      if (scheduledOn(item, d) && !v.doseLogs[logKey(item.id, d)]) {
        ops.push(['dose_logs', { dose_item_id: item.id, scheduled_on: d, status: 'missed', taken_at: null, amount_taken: null, deleted_at: null }])
      }
    }
    ops.push(['dose_items', { id: item.id, missed_through: yesterday }])
  }
  return ops
}
