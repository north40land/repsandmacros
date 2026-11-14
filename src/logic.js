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
    profile: { display_name: '', default_unit: 'lb', rest_seconds: 60, program_block: 1, ...stored, id: db.uid },
    workouts: mine('workouts').sort((a, b) => time(b.performed_at) - time(a.performed_at)),
    exercises: groupBy(mine('workout_exercises').sort((a, b) => a.order_index - b.order_index), 'workout_id'),
    sets: groupBy(mine('workout_sets').sort((a, b) => a.set_number - b.set_number), 'exercise_id'),
    presets: mine('user_presets').sort((a, b) => a.name.localeCompare(b.name)),
    maxes: Object.fromEntries(mine('one_rep_maxes').map((r) => [r.exercise_key, r])),
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

// Target weight for a program lift: 1RM x the week's percentage, rounded up to 5 lb.
export function target(v, exerciseKey, block, week) {
  const max = v.maxes[exerciseKey]?.value
  return max ? round5(max * weekInfo(block, week).pct) : null
}

// Program lifts are tracked by their fixed key; free-form ones by name.
export const exKey = (ex) => ex.exercise_key || `name:${ex.name.trim().toLowerCase()}`

export const loggedSets = (v, exerciseId) => (v.sets[exerciseId] || []).filter((s) => s.done && s.reps > 0)

export function history(v, key) {
  const out = []
  for (const w of v.workouts) {
    for (const ex of v.exercises[w.id] || []) {
      if (exKey(ex) !== key) continue
      const sets = loggedSets(v, ex.id)
      if (!sets.length) continue
      const top = sets.reduce((a, b) => (Number(b.weight) > Number(a.weight) ? b : a))
      out.push({ id: w.id, at: w.performed_at, block: w.program_block, week: w.program_week, top, sets })
    }
  }
  return out.sort((a, b) => time(a.at) - time(b.at))
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
