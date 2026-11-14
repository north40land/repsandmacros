import { localDate, convert, history, exKey, loggedSets, firstDay } from './logic'
import { addDays, weekAdherence } from './calc'
import { targetFor } from './nutrition'
import { dueToday, missedOn, logKey } from './dosing'
import { PARTS } from './program'

// Everything the weekly dashboard shows, worked out for the week starting on `start` (a Monday).

const tidy = (n) => Math.round(n * 10) / 10
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)

function volumeOf(v, workout, unit) {
  return (v.exercises[workout.id] || []).reduce(
    (total, ex) => total + loggedSets(v, ex.id).reduce((n, s) => n + convert(Number(s.weight), s.unit, unit) * s.reps, 0),
    0,
  )
}

function weekVolume(v, start, unit) {
  const end = addDays(start, 6)
  return v.workouts
    .filter((w) => w.finished_at && localDate(w.performed_at) >= start && localDate(w.performed_at) <= end)
    .reduce((n, w) => n + volumeOf(v, w, unit), 0)
}

export function weekSummary(v, start) {
  const today = localDate()
  const first = firstDay(v)
  const unit = v.profile.default_unit
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const end = dates[6]
  const upTo = end < today ? end : today
  const isCurrent = today >= start && today <= end
  const inWeek = (iso) => localDate(iso) >= start && localDate(iso) <= end

  // Workouts and volume
  const workouts = v.workouts.filter((w) => w.finished_at && inWeek(w.performed_at))
  const volume = Math.round(workouts.reduce((n, w) => n + volumeOf(v, w, unit), 0))
  // Up to 8 weeks, leaving out weeks from before this person started.
  const volumeTrend = Array.from({ length: 8 }, (_, i) => addDays(start, -7 * (7 - i)))
    .filter((monday) => addDays(monday, 6) >= first)
    .map((monday) => Math.round(weekVolume(v, monday, unit)))

  // Nutrition
  const adherence = weekAdherence(v, start)
  const logged = adherence.days.filter((d) => d.logged)
  const avg = (pick) => {
    const m = mean(logged.map(pick).filter((x) => x > 0))
    return m == null ? null : Math.round(m)
  }
  const nutrition = {
    days: logged.length,
    calories: logged.length ? Math.round(mean(logged.map((d) => d.totals.calories))) : null,
    protein: logged.length ? Math.round(mean(logged.map((d) => d.totals.protein))) : null,
    calorieTarget: avg((d) => d.target?.calories),
    proteinTarget: avg((d) => d.target?.protein),
  }

  // Sleep and water
  const nights = dates.map((d) => v.sleep[d]).filter(Boolean)
  const waterDays = dates
    .filter((d) => d <= today && d >= first)
    .map((d) => {
      const goal = Number(targetFor(v, d).target?.water_oz) || 0
      const drunk = (v.water[d] || []).reduce((n, l) => n + Number(l.amount_oz), 0)
      return goal > 0 ? Math.min(1, drunk / goal) : null
    })
    .filter((x) => x != null)
  const sleep = {
    nights: nights.length,
    average: nights.length ? tidy(mean(nights.map((n) => Number(n.hours)))) : null,
    target: Number(targetFor(v, upTo).target?.sleep_hours) || null,
  }
  const water = { percent: waterDays.length ? Math.round(mean(waterDays) * 100) : null }

  // Dosing
  const due = isCurrent ? dueToday(v, today) : []
  const doses = {
    due,
    left: due.filter((i) => !v.doseLogs[logKey(i.id, today)]),
    missed: dates.filter((d) => d < today || (d === today && !isCurrent)).flatMap((d) => missedOn(v, d).map((i) => ({ name: i.name, date: d }))),
    any: v.doseItems.length > 0,
  }

  // Body trend, as of the end of this week (or today)
  const weights = v.bodyMetrics
    .filter((b) => b.weight != null && b.measured_on <= upTo)
    .map((b) => ({ date: b.measured_on, value: convert(Number(b.weight), b.unit || 'lb', unit) }))
  const latest = weights[weights.length - 1] || null
  const changeOver = (n) => {
    if (!latest) return null
    const then = [...weights].reverse().find((p) => p.date <= addDays(latest.date, -n))
    return then ? tidy(latest.value - then.value) : null
  }
  const body = {
    latest,
    change7: changeOver(7),
    change30: changeOver(30),
    lastMeasured: [...v.bodyMetrics].reverse().find((b) => b.measurements && b.measured_on <= upTo)?.measured_on || null,
    trend: weights.slice(-20).map((p) => p.value),
  }

  // Personal records set this week: a best set heavier than anything logged before that workout.
  const best = new Map()
  for (const w of workouts) {
    for (const ex of v.exercises[w.id] || []) {
      const key = exKey(ex)
      const h = history(v, key, unit)
      const here = h.find((x) => x.id === w.id)
      if (!here) continue
      const before = h.filter((x) => Date.parse(x.at) < Date.parse(here.at))
      if (!before.length) continue
      const priorMax = Math.max(...before.map((x) => x.top.w))
      if (here.top.w > priorMax && (!best.has(key) || best.get(key).w < here.top.w)) {
        best.set(key, { name: ex.name, w: here.top.w, reps: here.top.reps, gain: tidy(here.top.w - priorMax), date: localDate(w.performed_at) })
      }
    }
  }

  return {
    start,
    end,
    dates,
    isCurrent,
    unit,
    workouts: { done: workouts.length, planned: v.hasProgram ? PARTS.length : null },
    volume,
    volumeTrend,
    nutrition,
    sleep,
    water,
    doses,
    body,
    records: [...best.values()].sort((a, b) => a.name.localeCompare(b.name)),
    adherence,
  }
}

// One row per day, for the CSV export.
export function weekCsv(v, s) {
  const unit = s.unit
  const rows = [['Date', 'Workouts', `Volume (${unit})`, 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Water (oz)', 'Sleep (h)', `Weight (${unit})`, 'Doses taken', 'Doses missed', 'Doses skipped']]
  for (const day of s.adherence.days) {
    if (day.before) continue
    const d = day.date
    const done = v.workouts.filter((w) => w.finished_at && localDate(w.performed_at) === d)
    const weighIn = v.bodyMetrics.find((b) => b.measured_on === d && b.weight != null)
    const logs = v.doseItems.map((i) => v.doseLogs[logKey(i.id, d)]).filter(Boolean)
    const count = (status) => logs.filter((l) => l.status === status).length
    rows.push([
      d,
      done.length,
      Math.round(done.reduce((n, w) => n + volumeOf(v, w, unit), 0)),
      day.logged ? day.totals.calories : '',
      day.logged ? day.totals.protein : '',
      day.logged ? day.totals.carbs : '',
      day.logged ? day.totals.fat : '',
      tidy((v.water[d] || []).reduce((n, l) => n + Number(l.amount_oz), 0)) || '',
      v.sleep[d] ? Number(v.sleep[d].hours) : '',
      weighIn ? convert(Number(weighIn.weight), weighIn.unit || 'lb', unit) : '',
      count('taken'),
      count('missed'),
      count('skipped'),
    ])
  }
  return rows.map((r) => r.join(',')).join('\n')
}
