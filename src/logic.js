import { PARTS, BOOKS } from './program'

export const BODY_PARTS = [
  ['chest', 'Chest'],
  ['back', 'Back'],
  ['shoulders', 'Shoulders'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['legs', 'Legs'],
  ['glutes', 'Glutes'],
  ['core', 'Core'],
  ['cardio', 'Cardio'],
  ['full body', 'Full body'],
]

export const partById = (id) => PARTS.find((p) => p.id === id)
// Blocks run through the three phases in order and then repeat: 1, 2, 3, 1, ...
export const bookFor = (block) => BOOKS[(Math.max(1, block) - 1) % BOOKS.length]
export const weekInfo = (block, w) => bookFor(block).weeks[Math.min(w, 4) - 1]
// The workbook rounds every weight up to the next 5 lb, so the app does too.
export const round5 = (x) => Math.max(5, Math.ceil(x / 5 - 1e-9) * 5)

const time = (iso) => Date.parse(iso) || 0
const groupBy = (rows, field) => {
  const out = {}
  for (const r of rows) (out[r[field]] ||= []).push(r)
  return out
}

// One indexed read of the signed-in person's data, rebuilt only when the data changes.
const cache = new WeakMap()
export function view(db) {
  const hit = cache.get(db)
  if (hit) return hit
  const mine = (t) => Object.values(db.tables[t]).filter((r) => !r.deleted_at && r.user_id === db.uid)
  const stored = db.tables.profiles[db.uid]
  const v = {
    uid: db.uid,
    hasProfile: Boolean(stored),
    // null means "not following a program". Profiles from before this setting existed count as following.
    hasProgram: Boolean(stored) && stored.program_id !== null,
    profile: { display_name: '', default_unit: 'lb', rest_seconds: 60, program_block: 1, ...stored, id: db.uid },
    workouts: mine('workouts').sort((a, b) => time(b.performed_at) - time(a.performed_at)),
    exercises: groupBy(mine('workout_exercises').sort((a, b) => a.order_index - b.order_index), 'workout_id'),
    sets: groupBy(mine('workout_sets').sort((a, b) => a.set_number - b.set_number), 'exercise_id'),
    presets: mine('user_presets').sort((a, b) => a.name.localeCompare(b.name)),
    maxes: Object.fromEntries(mine('one_rep_maxes').map((r) => [r.exercise_key, r])),
    foods: mine('foods'),
    foodLogs: groupBy(mine('food_logs'), 'logged_on'),
    targets: mine('user_targets'),
    metrics: mine('user_profile_metrics')[0] || null,
    bodyMetrics: mine('body_metrics').sort((a, b) => a.measured_on.localeCompare(b.measured_on)),
  }
  cache.set(db, v)
  return v
}

// A program week is finished once all six body parts have a finished day in it.
// Returns 1-4, or 5 when the whole block is done.
export function currentWeek(v) {
  const block = v.profile.program_block
  for (let w = 1; w <= 4; w++) {
    const done = new Set(
      v.workouts
        .filter((x) => x.source === 'program' && x.program_block === block && x.program_week === w && x.finished_at)
        .map((x) => x.body_parts[0]),
    )
    if (done.size < PARTS.length) return w
  }
  return 5
}

// The block number to use when starting a chosen program: always a fresh block,
// so the program begins at week 1 and earlier blocks keep their history.
export function blockForBook(v, bookId) {
  const used = Math.max(0, ...v.workouts.map((w) => w.program_block || 0))
  if (!used) return bookId // nothing logged yet: blocks 1, 2 and 3 are the phases themselves
  let block = Math.max(v.profile.program_block, used) + 1
  while (bookFor(block).id !== bookId) block += 1
  return block
}

// Target weight for a program lift: 1RM x the week's percentage, rounded up to 5 lb.
export function target(v, exerciseKey, block, week) {
  const max = v.maxes[exerciseKey]?.value
  return max ? round5(max * weekInfo(block, week).pct) : null
}

// Program lifts are tracked by their fixed key; free-form ones by name.
export const exKey = (ex) => ex.exercise_key || `name:${ex.name.trim().toLowerCase()}`

export const loggedSets = (v, exerciseId) => (v.sets[exerciseId] || []).filter((s) => s.done && s.reps > 0)

const KG_TO_LB = 2.20462
export const tidy = (n) => Math.round(n * 10) / 10

// Convert a weight between lb and kg so sessions logged in different units compare fairly.
export const convert = (weight, from, to) =>
  weight == null || (from || 'lb') === to ? weight : tidy(to === 'lb' ? weight * KG_TO_LB : weight / KG_TO_LB)

// Every session that includes this lift, oldest first. Each set gets `w`, its weight in `unit`.
// `top` is the best set (heaviest, then most reps); `volume` is the sum of reps x weight.
export function history(v, key, unit = v.profile.default_unit) {
  const out = []
  for (const w of v.workouts) {
    for (const ex of v.exercises[w.id] || []) {
      if (exKey(ex) !== key) continue
      const sets = loggedSets(v, ex.id).map((s) => ({ ...s, w: convert(Number(s.weight), s.unit, unit) }))
      if (!sets.length) continue
      const top = sets.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.reps > a.reps) ? b : a))
      const volume = tidy(sets.reduce((n, s) => n + s.w * s.reps, 0))
      out.push({ id: w.id, at: w.performed_at, block: w.program_block, week: w.program_week, top, sets, volume })
    }
  }
  return out.sort((a, b) => time(a.at) - time(b.at))
}

// Personal records from a lift's history: heaviest set, highest-volume session,
// and the most reps done at each weight (heaviest weights first).
export function records(h) {
  if (!h.length) return null
  let heaviest = null
  let volume = null
  const byWeight = new Map()
  for (const session of h) {
    if (!volume || session.volume > volume.volume) volume = { volume: session.volume, at: session.at }
    for (const set of session.sets) {
      if (!heaviest || set.w > heaviest.w || (set.w === heaviest.w && set.reps > heaviest.reps)) {
        heaviest = { w: set.w, reps: set.reps, at: session.at }
      }
      const best = byWeight.get(set.w)
      if (!best || set.reps > best.reps) byWeight.set(set.w, { w: set.w, reps: set.reps, at: session.at })
    }
  }
  return { heaviest, volume, repsAtWeight: [...byWeight.values()].sort((a, b) => b.w - a.w) }
}

// Dates are stored as UTC timestamps and shown in the phone's own time zone.
const pad = (n) => String(n).padStart(2, '0')
export function localDate(iso) {
  const d = iso ? new Date(iso) : new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function fromLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toISOString()
}
export function niceDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
