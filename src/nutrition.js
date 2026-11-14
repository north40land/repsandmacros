import { localDate } from './logic'

export const MEALS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['snacks', 'Snacks'],
]
export const MACROS = ['calories', 'protein', 'carbs', 'fat', 'fiber']
export const MACRO_LABEL = { calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fiber' }
const OZ_IN_G = 28.3495

export const round = (n, places = 1) => Math.round((Number(n) || 0) * 10 ** places) / 10 ** places
export const fmt = (n) => Number(round(n, 1)).toLocaleString(undefined, { maximumFractionDigits: 1 })

// "CHICKEN BREAST" -> "Chicken breast". Leaves normally cased names alone.
export const tidyName = (s) => {
  const text = String(s || '').trim()
  return text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text
}

// "1 slice" stays as it is; a bare weight such as "35 g" becomes "serving" so the label does not repeat itself.
const servingName = (text) => (text && !/^\s*[\d.]+\s*(g|ml)\s*$/i.test(text) ? tidyName(text).toLowerCase() : 'serving')

// Turn a search or barcode result into this app's food shape. Macros are per 100 g.
export function fromLookup(r) {
  const portion = r.servingSize > 0 ? round(r.servingSize, 1) : null
  return {
    source: r.source || 'usda',
    external_id: String(r.fdcId ?? r.code),
    name: tidyName(r.description),
    brand: r.brand ? tidyName(r.brand) : null,
    serving_size: 100,
    serving_unit: 'g',
    portion_g: portion,
    portion_label: portion ? `${servingName(r.servingText)} (${portion} g)` : null,
    calories: round(r.calories, 0),
    protein: round(r.protein),
    carbs: round(r.carbs),
    fat: round(r.fat),
    fiber: round(r.fiber),
  }
}

// The units a food can be logged in, as [value, label].
export function unitsFor(food) {
  if (food.serving_unit !== 'g') return [[food.serving_unit, food.serving_unit]]
  const units = [
    ['g', 'grams'],
    ['oz', 'ounces'],
  ]
  if (food.portion_g) units.unshift(['serving', food.portion_label || `serving (${food.portion_g} g)`])
  return units
}

// How many of the food's base amounts a quantity represents.
function factor(food, quantity, unit) {
  const q = Number(quantity) || 0
  if (food.serving_unit !== 'g') return q / food.serving_size
  const grams = unit === 'oz' ? q * OZ_IN_G : unit === 'serving' ? q * (food.portion_g || food.serving_size) : q
  return grams / food.serving_size
}

export function macrosFor(food, quantity, unit) {
  const f = factor(food, quantity, unit)
  return Object.fromEntries(MACROS.map((m) => [m, round((food[m] || 0) * f, m === 'calories' ? 0 : 1)]))
}

export const sum = (logs) =>
  Object.fromEntries(MACROS.map((m) => [m, round(logs.reduce((n, l) => n + (Number(l[m]) || 0), 0), m === 'calories' ? 0 : 1)]))

// A day counts as a training day if any workout was logged on it.
export const isTrainingDay = (v, date) => v.workouts.some((w) => localDate(w.performed_at) === date)

// The targets that apply on a given day: the newest set on or before that day
// for its day type. Rest-day targets only apply if the person has set some.
export function targetFor(v, date) {
  const hasRest = v.targets.some((t) => t.day_type === 'rest')
  const dayType = hasRest && !isTrainingDay(v, date) ? 'rest' : 'training'
  const pick = (type) => {
    const rows = v.targets.filter((t) => t.day_type === type).sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    return [...rows].reverse().find((t) => t.effective_from <= date) || rows[0] || null
  }
  let target = pick(dayType)
  // Water and sleep rarely differ by day type: a rest day without its own uses the main ones.
  if (target && dayType === 'rest') {
    const main = pick('training')
    target = { ...target, water_oz: target.water_oz ?? main?.water_oz ?? null, sleep_hours: target.sleep_hours ?? main?.sleep_hours ?? null }
  }
  return { target, dayType, hasRest }
}

export const latestTarget = (v, dayType) =>
  v.targets.filter((t) => t.day_type === dayType).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] || null
