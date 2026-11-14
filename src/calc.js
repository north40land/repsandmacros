import { localDate, fromLocalDate, convert, firstDay } from './logic'
import { sum, targetFor, latestTarget } from './nutrition'
import { uuid, nowISO } from './db'

// ---- Target calculator (Phase 3b) ----

export const ACTIVITY = [
  ['sedentary', 'Sedentary', 1.2],
  ['light', 'Lightly active', 1.375],
  ['moderate', 'Moderately active', 1.55],
  ['very', 'Very active', 1.725],
  ['extreme', 'Extremely active', 1.9],
]
export const GOALS = [
  ['cut', 'Cut', 500],
  ['maintain', 'Maintain', 0],
  ['build', 'Build', 300],
]

export const SPLIT_DEFAULTS = {
  macro_mode: 'protein_first',
  protein_pct: 30,
  carb_pct: 40,
  fat_pct: 30,
  protein_g_per_lb: 1,
  fat_pct_of_calories: 25,
}
export const METRIC_DEFAULTS = {
  sex: 'male',
  birth_date: '',
  height_cm: null,
  activity_level: 'moderate',
  goal_type: 'maintain',
  goal_adjustment_kcal: 0,
  ...SPLIT_DEFAULTS,
  separate_training_day_split: false,
  rest_split: null,
  overrides: {},
  auto: true,
  tol_calories_pct: 5,
  tol_protein_g: 10,
}

const LB_TO_KG = 0.45359237

export function ageOn(birthDate, date = localDate()) {
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

// Calories -> grams for one day type.
function macros(calories, weightLb, s) {
  let protein
  let fat
  let carbs
  if (s.macro_mode === 'percent') {
    protein = (calories * s.protein_pct) / 100 / 4
    carbs = (calories * s.carb_pct) / 100 / 4
    fat = (calories * s.fat_pct) / 100 / 9
  } else {
    // Protein first: protein from bodyweight, fat as a share of calories, carbs fill what is left.
    protein = s.protein_g_per_lb * weightLb
    fat = (calories * s.fat_pct_of_calories) / 100 / 9
    carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4)
  }
  return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }
}

const signed = (goal, adjustment) => (goal === 'cut' ? -adjustment : goal === 'build' ? adjustment : 0)

// The whole chain: BMR (Mifflin-St Jeor) -> maintenance -> target calories -> grams.
// `m` is a user_profile_metrics row with numbers already parsed. Returns null if something is missing.
export function plan(m, weightLb) {
  if (!m?.birth_date || !(m.height_cm > 0) || !(weightLb > 0)) return null
  const age = ageOn(m.birth_date)
  const multiplier = ACTIVITY.find(([id]) => id === m.activity_level)?.[2]
  if (!(age > 0) || !multiplier) return null
  const kg = weightLb * LB_TO_KG
  const bmr = 10 * kg + 6.25 * m.height_cm - 5 * age + (m.sex === 'female' ? -161 : 5)
  const maintenance = bmr * multiplier
  const day = (split) => {
    const adjustment = signed(m.goal_type, Number(split.goal_adjustment_kcal) || 0)
    return { adjustment, ...macros(maintenance + adjustment, weightLb, split) }
  }
  const rest = m.separate_training_day_split && m.rest_split ? day({ ...SPLIT_DEFAULTS, ...m.rest_split }) : null
  return { age, multiplier, bmr: Math.round(bmr), maintenance: Math.round(maintenance), training: day(m), rest }
}

export const withOverrides = (computed, overrides) => ({ ...computed, ...(overrides || {}) })

export function latestWeightLb(v) {
  const last = [...v.bodyMetrics].reverse().find((b) => b.weight != null)
  return last ? convert(Number(last.weight), last.unit || 'lb', 'lb') : null
}

// The rows to write so today's targets match the calculator. Used when the calculator is
// saved and whenever a new weigh-in lands while automatic targets are on.
export function targetOps(v, m, weightLb) {
  const p = plan(m, weightLb)
  if (!p) return []
  const today = localDate()
  const ops = []
  const put = (dayType, computed) => {
    const overrides = m.overrides?.[dayType]
    const hasOverride = overrides && Object.keys(overrides).length > 0
    const final = withOverrides(computed, overrides)
    const todays = v.targets.find((t) => t.day_type === dayType && t.effective_from === today)
    const carry = latestTarget(v, dayType) || latestTarget(v, 'training')
    ops.push([
      'user_targets',
      {
        id: todays?.id || uuid(),
        day_type: dayType,
        effective_from: today,
        computed: !hasOverride,
        calories: final.calories,
        protein: final.protein,
        carbs: final.carbs,
        fat: final.fat,
        water_oz: carry?.water_oz ?? null,
        sleep_hours: carry?.sleep_hours ?? null,
        deleted_at: null,
      },
    ])
  }
  put('training', p.training)
  if (p.rest) put('rest', p.rest)
  else for (const t of v.targets.filter((x) => x.day_type === 'rest')) ops.push(['user_targets', { id: t.id, deleted_at: nowISO() }])
  return ops
}

// ---- Weekly adherence ----

export function addDays(date, days) {
  const d = new Date(fromLocalDate(date))
  d.setDate(d.getDate() + days)
  return localDate(d.toISOString())
}
// Weeks run Monday to Sunday.
export function mondayOf(date) {
  const d = new Date(fromLocalDate(date))
  return addDays(date, -((d.getDay() + 6) % 7))
}

const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat']

export function weekAdherence(v, start) {
  const today = localDate()
  const first = firstDay(v)
  const tolCal = Number(v.metrics?.tol_calories_pct ?? METRIC_DEFAULTS.tol_calories_pct)
  const tolProtein = Number(v.metrics?.tol_protein_g ?? METRIC_DEFAULTS.tol_protein_g)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const logs = v.foodLogs[date] || []
    const totals = sum(logs)
    const { target, dayType } = targetFor(v, date)
    const logged = logs.length > 0
    const pct = Object.fromEntries(
      NUTRIENTS.map((n) => [n, logged && target?.[n] > 0 ? Math.round((totals[n] / target[n]) * 100) : null]),
    )
    // Within tolerance: calories inside the percentage band and protein inside the gram band.
    let within = null
    if (logged && target && (target.calories > 0 || target.protein > 0)) {
      const calOk = !(target.calories > 0) || Math.abs(totals.calories - target.calories) <= (target.calories * tolCal) / 100
      const proteinOk = !(target.protein > 0) || Math.abs(totals.protein - target.protein) <= tolProtein
      within = calOk && proteinOk
    }
    // `before`: a day from before this person started. It is shown blank.
    return { date, future: date > today, before: date < first, logged, totals, target, dayType, pct, within }
  })
  const counted = days.filter((d) => d.logged)
  const average = Object.fromEntries(
    NUTRIENTS.map((n) => {
      const vals = counted.map((d) => d.pct[n]).filter((x) => x != null)
      return [n, vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null]
    }),
  )
  const judged = days.filter((d) => d.within != null)
  return {
    days,
    average,
    loggedDays: counted.length,
    judgedDays: judged.length,
    withinDays: judged.filter((d) => d.within).length,
    tolCal,
    tolProtein,
  }
}
