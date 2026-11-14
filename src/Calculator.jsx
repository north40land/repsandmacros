import { useState } from 'react'
import { write, uuid } from './db'
import { localDate, convert } from './logic'
import { ACTIVITY, GOALS, SPLIT_DEFAULTS, METRIC_DEFAULTS, plan, withOverrides, targetOps, latestWeightLb } from './calc'

const FINAL = [
  ['calories', 'Calories'],
  ['protein', 'Protein (g)'],
  ['carbs', 'Carbs (g)'],
  ['fat', 'Fat (g)'],
]
const SPLIT_KEYS = ['goal_adjustment_kcal', ...Object.keys(SPLIT_DEFAULTS)]
const n = (text) => (text === '' || text == null || !Number.isFinite(Number(text)) ? null : Number(text))
const num = (x) => Number(x).toLocaleString()
const strings = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] == null ? '' : String(obj[k])]))

// Works out calorie and macro targets from a person's own numbers, shows every step,
// and saves the result as today's targets.
export default function Calculator({ v, onClose }) {
  const saved = { ...METRIC_DEFAULTS, ...(v.metrics || {}) }
  const metric = v.profile.default_unit === 'kg'
  const savedLb = latestWeightLb(v)

  const [f, setF] = useState({
    sex: saved.sex || 'male',
    birth_date: saved.birth_date || '',
    activity_level: saved.activity_level || 'moderate',
    goal_type: saved.goal_type || 'maintain',
    separate: Boolean(saved.separate_training_day_split),
    ...strings(saved, SPLIT_KEYS),
  })
  const [rest, setRest] = useState(strings({ goal_adjustment_kcal: saved.goal_adjustment_kcal, ...SPLIT_DEFAULTS, ...(saved.rest_split || {}) }, SPLIT_KEYS))
  const inches = saved.height_cm ? saved.height_cm / 2.54 : null
  const [height, setHeight] = useState({
    cm: saved.height_cm ? String(Math.round(saved.height_cm)) : '',
    ft: inches ? String(Math.floor(Math.round(inches) / 12)) : '',
    inch: inches ? String(Math.round(inches) % 12) : '',
  })
  const [weight, setWeight] = useState(savedLb ? String(convert(savedLb, 'lb', metric ? 'kg' : 'lb')) : '')
  const [overrides, setOverrides] = useState(saved.overrides || {})
  const set = (key, value) => setF((x) => ({ ...x, [key]: value }))

  const heightCm = metric ? n(height.cm) : n(height.ft) != null ? ((n(height.ft) || 0) * 12 + (n(height.inch) || 0)) * 2.54 : null
  const weightLb = n(weight) != null ? convert(n(weight), metric ? 'kg' : 'lb', 'lb') : null
  const parseSplit = (s) => Object.fromEntries(SPLIT_KEYS.map((k) => [k, k === 'macro_mode' ? s[k] : n(s[k]) ?? 0]))
  const metrics = {
    sex: f.sex,
    birth_date: f.birth_date,
    height_cm: heightCm ? Math.round(heightCm * 10) / 10 : null,
    activity_level: f.activity_level,
    goal_type: f.goal_type,
    ...parseSplit(f),
    separate_training_day_split: f.separate,
    rest_split: f.separate ? parseSplit(rest) : null,
    overrides,
  }

  const problems = []
  const checkSplit = (s, label) => {
    if (s.macro_mode === 'percent' && Math.round(s.protein_pct + s.carb_pct + s.fat_pct) !== 100) {
      problems.push(`${label}percentages must add up to 100 (now ${Math.round(s.protein_pct + s.carb_pct + s.fat_pct)}).`)
    }
    if (s.macro_mode !== 'percent' && !(s.protein_g_per_lb > 0)) problems.push(`${label}protein per pound must be above 0.`)
    if (s.macro_mode !== 'percent' && !(s.fat_pct_of_calories >= 0 && s.fat_pct_of_calories < 100)) problems.push(`${label}fat must be between 0 and 99 percent.`)
    if (s.goal_adjustment_kcal < 0) problems.push(`${label}calorie adjustment cannot be negative.`)
  }
  if (!f.birth_date || f.birth_date > localDate()) problems.push('Enter your date of birth.')
  if (!(heightCm > 0)) problems.push('Enter your height.')
  if (!(weightLb > 0)) problems.push('Enter your current weight.')
  checkSplit(metrics, '')
  if (f.separate) checkSplit(metrics.rest_split, 'Rest days: ')

  const p = problems.length ? null : plan(metrics, weightLb)
  if (!problems.length && !p) problems.push('Check your date of birth.')
  const types = p ? [['training', f.separate ? 'Training days' : 'Every day', p.training], ...(p.rest ? [['rest', 'Rest days', p.rest]] : [])] : []
  const lowest = Math.min(...types.map(([type, , computed]) => withOverrides(computed, overrides[type]).calories))
  const tooLow = p && lowest < (f.sex === 'female' ? 1200 : 1500)

  const setOverride = (type, key, text, computed) => {
    const next = { ...(overrides[type] || {}) }
    if (n(text) == null || n(text) < 0 || n(text) === computed[key]) delete next[key]
    else next[key] = Math.round(n(text))
    setOverrides({ ...overrides, [type]: next })
  }
  const edited = (type) => Object.keys(overrides[type] || {}).length > 0

  const save = () => {
    const today = localDate()
    const ops = [['user_profile_metrics', { ...metrics, auto: true }]]
    // A changed weight is recorded as today's weigh-in, so the history starts here.
    if (savedLb == null || Math.abs(savedLb - weightLb) > 0.05) {
      const todays = v.bodyMetrics.find((b) => b.measured_on === today)
      ops.push(['body_metrics', { id: todays?.id || uuid(), measured_on: today, weight: n(weight), unit: metric ? 'kg' : 'lb' }])
    }
    write([...ops, ...targetOps(v, metrics, weightLb)])
    onClose()
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Nutrition</p>
        <h2>Target calculator</h2>
        <p className="muted">Works out your calories and macros from your own numbers. A general estimate, not medical or coaching advice.</p>
      </div>

      <h3>About you</h3>
      <div className="card">
        <p className="fieldname">Sex (used by the formula)</p>
        <div className="seg">
          {[
            ['male', 'Male'],
            ['female', 'Female'],
          ].map(([id, name]) => (
            <button key={id} aria-selected={f.sex === id} onClick={() => set('sex', id)}>
              {name}
            </button>
          ))}
        </div>
        <label className="spaced">
          Date of birth
          <input type="date" max={localDate()} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
        </label>
        {metric ? (
          <label>
            Height (cm)
            <input inputMode="decimal" value={height.cm} onChange={(e) => setHeight({ ...height, cm: e.target.value })} />
          </label>
        ) : (
          <div className="two">
            <label>
              Height (feet)
              <input inputMode="numeric" value={height.ft} onChange={(e) => setHeight({ ...height, ft: e.target.value })} />
            </label>
            <label>
              Inches
              <input inputMode="decimal" value={height.inch} onChange={(e) => setHeight({ ...height, inch: e.target.value })} />
            </label>
          </div>
        )}
        <label>
          Current weight ({metric ? 'kg' : 'lb'})
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label>
          Activity level
          <select value={f.activity_level} onChange={(e) => set('activity_level', e.target.value)}>
            {ACTIVITY.map(([id, name, mult]) => (
              <option key={id} value={id}>
                {name} (× {mult})
              </option>
            ))}
          </select>
        </label>
      </div>

      <h3>Goal</h3>
      <div className="card">
        <div className="seg">
          {GOALS.map(([id, name, adjustment]) => (
            <button
              key={id}
              aria-selected={f.goal_type === id}
              onClick={() => {
                setF((x) => ({ ...x, goal_type: id, goal_adjustment_kcal: String(adjustment) }))
                setRest((x) => ({ ...x, goal_adjustment_kcal: String(adjustment) }))
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <h3>{f.separate ? 'Training days' : 'Calories and macros'}</h3>
      <Split s={f} set={set} goal={f.goal_type} prefix={f.separate ? 'Training day' : 'Daily'} />

      <label className="toggle">
        <input type="checkbox" checked={f.separate} onChange={(e) => set('separate', e.target.checked)} />
        Use a different split on rest days
      </label>
      {f.separate && (
        <>
          <p className="muted small">A day counts as a training day when you log a workout on it.</p>
          <h3>Rest days</h3>
          <Split s={rest} set={(key, value) => setRest((x) => ({ ...x, [key]: value }))} goal={f.goal_type} prefix="Rest day" />
        </>
      )}

      <h3>The math</h3>
      {p ? (
        <div className="card math">
          <p className="barline">
            <span>BMR (Mifflin-St Jeor)</span>
            <span>{num(p.bmr)} cal</span>
          </p>
          <p className="muted small">
            10 × {num(Math.round(weightLb * 0.45359237 * 10) / 10)} kg + 6.25 × {num(metrics.height_cm)} cm − 5 × {p.age} years{' '}
            {f.sex === 'female' ? '− 161' : '+ 5'}
          </p>
          <p className="barline">
            <span>Maintenance</span>
            <span>{num(p.maintenance)} cal</span>
          </p>
          <p className="muted small">
            {num(p.bmr)} × {p.multiplier} activity
          </p>
          {types.map(([type, label, computed]) => (
            <div key={type}>
              <p className="barline">
                <span>Target, {label.toLowerCase()}</span>
                <span>{num(computed.calories)} cal</span>
              </p>
              <p className="muted small">
                {num(p.maintenance)} {computed.adjustment < 0 ? '−' : '+'} {num(Math.abs(computed.adjustment))} · protein {computed.protein} g × 4, carbs{' '}
                {computed.carbs} g × 4, fat {computed.fat} g × 9
              </p>
            </div>
          ))}
        </div>
      ) : (
        <ul className="problems">
          {problems.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}

      {types.map(([type, label, computed]) => {
        const final = withOverrides(computed, overrides[type])
        return (
          <div key={type}>
            <div className="h3row">
              <h3>Your targets, {label.toLowerCase()}</h3>
              {edited(type) && (
                <button className="link" onClick={() => setOverrides({ ...overrides, [type]: {} })}>
                  Use calculated
                </button>
              )}
            </div>
            <div className="card targetgrid">
              {FINAL.map(([key, name]) => (
                <label key={key}>
                  {name}
                  {overrides[type]?.[key] != null ? ' · edited' : ''}
                  <FinalInput label={`${label} ${name}`} value={final[key]} onCommit={(text) => setOverride(type, key, text, computed)} />
                </label>
              ))}
            </div>
          </div>
        )
      })}
      {p && <p className="muted small">Change any number to override it. Targets update by themselves when you log a new weight; your edits are kept.</p>}
      {tooLow && (
        <p className="warn small">
          {num(lowest)} calories a day is very low. Check a plan like this with a coach or doctor before following it.
        </p>
      )}

      <div className="actions">
        <button className="primary" disabled={!p} onClick={save}>
          Save targets
        </button>
      </div>
    </section>
  )
}

// A final number that can be typed over. Each valid keystroke is saved as an override;
// the box shows what is being typed until focus leaves it.
function FinalInput({ label, value, onCommit }) {
  const [draft, setDraft] = useState(null)
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      value={draft ?? value}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        if (text.trim() !== '' && Number.isFinite(Number(text)) && Number(text) >= 0) onCommit(text)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

// Calorie adjustment and macro split for one day type.
function Split({ s, set, goal, prefix }) {
  const field = (key, label) => (
    <label key={key}>
      {label}
      <input inputMode="decimal" aria-label={`${prefix} ${label}`} value={s[key]} onChange={(e) => set(key, e.target.value)} />
    </label>
  )
  return (
    <div className="card">
      {goal !== 'maintain' && field('goal_adjustment_kcal', goal === 'cut' ? 'Daily deficit (calories)' : 'Daily surplus (calories)')}
      <p className="fieldname">Macro split</p>
      <div className="seg">
        {[
          ['protein_first', 'Protein first'],
          ['percent', 'Percentages'],
        ].map(([id, name]) => (
          <button key={id} aria-selected={s.macro_mode === id} onClick={() => set('macro_mode', id)}>
            {name}
          </button>
        ))}
      </div>
      {s.macro_mode === 'percent' ? (
        <div className="three spaced">
          {field('protein_pct', 'Protein %')}
          {field('carb_pct', 'Carbs %')}
          {field('fat_pct', 'Fat %')}
        </div>
      ) : (
        <>
          <div className="two spaced">
            {field('protein_g_per_lb', 'Protein (g per lb)')}
            {field('fat_pct_of_calories', 'Fat (% of calories)')}
          </div>
          <p className="muted small">Carbs fill whatever calories are left.</p>
        </>
      )}
    </div>
  )
}
