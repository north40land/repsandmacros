import { useState } from 'react'
import { supabase } from './supa'
import { write, uuid, nowISO } from './db'
import { MEALS, MACROS, fmt, fromUsda, unitsFor, macrosFor } from './nutrition'
import { askConfirm } from './confirm'
import { MacroFields } from './Food'

const TABS = [
  ['search', 'Search'],
  ['recent', 'Recent'],
  ['favorites', 'Favorites'],
  ['mine', 'My foods'],
]

const line = (f) =>
  `${fmt(f.calories)} cal · P ${fmt(f.protein)} · C ${fmt(f.carbs)} · F ${fmt(f.fat)} per ${fmt(f.serving_size)} ${f.serving_unit}`

export default function AddFood({ v, date, meal, onClose }) {
  const [tab, setTab] = useState(v.foods.some((f) => f.last_used_at) ? 'recent' : 'search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [state, setState] = useState('idle') // idle | loading | error | limited
  const [picked, setPicked] = useState(null)
  const [editing, setEditing] = useState(null) // custom food being created or edited

  if (picked) return <Amount v={v} food={picked} date={date} meal={meal} onBack={() => setPicked(null)} onDone={onClose} />
  if (editing) {
    return (
      <CustomFood
        food={editing === 'new' ? null : editing}
        startName={editing === 'new' ? query : ''}
        onBack={() => setEditing(null)}
        onSaved={(food) => {
          setEditing(null)
          setPicked(food)
        }}
      />
    )
  }

  const search = async (e) => {
    e.preventDefault()
    if (query.trim().length < 2 || !supabase) return
    setState('loading')
    const { data, error } = await supabase.functions.invoke('food-search', { body: { query: query.trim() } })
    if (error || !data?.foods) {
      setState(error?.context?.status === 429 ? 'limited' : 'error')
      return
    }
    setResults(data.foods.map(fromUsda))
    setState('idle')
  }

  const saved = v.foods
  const lists = {
    recent: saved.filter((f) => f.last_used_at).sort((a, b) => Date.parse(b.last_used_at) - Date.parse(a.last_used_at)).slice(0, 30),
    favorites: saved.filter((f) => f.favorite).sort((a, b) => a.name.localeCompare(b.name)),
    mine: saved.filter((f) => f.source === 'custom').sort((a, b) => a.name.localeCompare(b.name)),
  }
  const empty = {
    recent: 'Foods you log will show up here for quick entry.',
    favorites: 'Tap the star on a food to keep it here.',
    mine: 'Foods you create yourself, such as home recipes, are kept here.',
  }
  const mealName = MEALS.find(([id]) => id === meal)[1]

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Add to {mealName.toLowerCase()}</p>
        <h2>Find a food</h2>
      </div>

      <div className="seg four" role="tablist">
        {TABS.map(([id, name]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <>
          <form className="searchbar" onSubmit={search}>
            <input
              type="search"
              aria-label="Food name"
              placeholder="Chicken breast, oats, banana"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="primary" disabled={query.trim().length < 2 || state === 'loading' || !supabase}>
              {state === 'loading' ? 'Searching' : 'Search'}
            </button>
          </form>
          {!supabase && <p className="muted small">Food search needs the cloud connection. You can still add your own foods.</p>}
          {state === 'error' && <p className="warn small">The search did not work. Check your connection and try again.</p>}
          {state === 'limited' && <p className="warn small">The food database is busy right now. Try again in a little while.</p>}
          {results && results.length === 0 && state === 'idle' && <p className="muted small">Nothing found. Try a simpler name, or create the food yourself.</p>}
          {results && results.length > 0 && <FoodList foods={results} onPick={setPicked} />}
          {!results && state === 'idle' && supabase && (
            <p className="muted small">Results come from the USDA food database, whole foods first.</p>
          )}
        </>
      )}

      {tab !== 'search' &&
        (lists[tab].length ? (
          <FoodList foods={lists[tab]} onPick={setPicked} onEdit={tab === 'mine' ? setEditing : null} star />
        ) : (
          <p className="muted small">{empty[tab]}</p>
        ))}

      <button className="secondary" onClick={() => setEditing('new')}>
        Create a food
      </button>
    </section>
  )
}

function FoodList({ foods, onPick, onEdit, star }) {
  return (
    <ul className="list foods">
      {foods.map((f) => (
        <li key={f.id || f.external_id} className="split">
          <button onClick={() => onPick(f)}>
            <span>
              {f.name}
              <small className="left">
                {f.brand ? `${f.brand} · ` : ''}
                {line(f)}
              </small>
            </span>
          </button>
          {onEdit && (
            <button className="side" aria-label={`Edit ${f.name}`} onClick={() => onEdit(f)}>
              Edit
            </button>
          )}
          {star && !onEdit && (
            <button
              className="side star"
              aria-label={f.favorite ? `Remove ${f.name} from favorites` : `Add ${f.name} to favorites`}
              aria-pressed={Boolean(f.favorite)}
              onClick={() => write([['foods', { id: f.id, favorite: !f.favorite }]])}
            >
              {f.favorite ? '★' : '☆'}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// Enter how much, see the numbers, and log it.
function Amount({ v, food, date, meal, onBack, onDone }) {
  const units = unitsFor(food)
  const [unit, setUnit] = useState(units[0][0])
  const [quantity, setQuantity] = useState(units[0][0] === 'g' ? '100' : '1')
  const [toMeal, setToMeal] = useState(meal)
  const [favorite, setFavorite] = useState(Boolean(food.favorite))
  const [manual, setManual] = useState(null)

  const q = Number(quantity)
  const computed = macrosFor(food, q, unit)
  const valid = q > 0 && (!manual || MACROS.every((m) => manual[m] !== '' && Number(manual[m]) >= 0))

  const add = () => {
    // A database food is copied into this person's own foods the first time it is logged.
    const existing = food.id ? food : v.foods.find((f) => f.source === food.source && f.external_id && f.external_id === food.external_id)
    const foodId = existing?.id || uuid()
    const values = manual ? Object.fromEntries(MACROS.map((m) => [m, Number(manual[m])])) : computed
    write([
      ['foods', { ...(existing ? {} : food), id: foodId, favorite, last_used_at: nowISO() }],
      ['food_logs', { id: uuid(), logged_on: date, meal: toMeal, food_id: foodId, name: food.name, brand: food.brand || null, quantity: q, unit, ...values }],
    ])
    onDone()
  }

  return (
    <section>
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">How much?</p>
        <h2>{food.name}</h2>
        <p className="muted">
          {food.brand ? `${food.brand} · ` : ''}
          {line(food)}
        </p>
      </div>

      <div className="card">
        <div className="two">
          <label>
            Amount
            <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            Unit
            <select
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value)
                setQuantity(e.target.value === 'g' ? '100' : '1')
              }}
            >
              {units.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <MacroFields values={manual || computed} editable={Boolean(manual)} onChange={(m, val) => setManual({ ...(manual || computed), [m]: val })} />
        {manual ? (
          <button className="link" onClick={() => setManual(null)}>
            Go back to the calculated numbers
          </button>
        ) : (
          <button className="link" onClick={() => setManual(Object.fromEntries(MACROS.map((m) => [m, String(computed[m])])))}>
            Edit the numbers by hand
          </button>
        )}
        <label>
          Meal
          <select value={toMeal} onChange={(e) => setToMeal(e.target.value)}>
            {MEALS.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          Keep in favorites
        </label>
      </div>

      <div className="actions">
        {!valid && <p className="warn small">Enter an amount above 0 and numbers of 0 or more.</p>}
        <button className="primary" disabled={!valid} onClick={add}>
          Add to {MEALS.find(([id]) => id === toMeal)[1].toLowerCase()}
        </button>
      </div>
    </section>
  )
}

// Create or edit one of your own foods.
function CustomFood({ food, startName, onBack, onSaved }) {
  const [form, setForm] = useState({
    name: food?.name || startName || '',
    brand: food?.brand || '',
    serving_size: String(food?.serving_size ?? 1),
    serving_unit: food?.serving_unit || 'serving',
    ...Object.fromEntries(MACROS.map((m) => [m, String(food?.[m] ?? '')])),
  })
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const unit = form.serving_unit.trim()
  const valid =
    form.name.trim() && unit && Number(form.serving_size) > 0 && MACROS.every((m) => form[m] === '' || Number(form[m]) >= 0)

  const save = () => {
    const row = {
      id: food?.id || uuid(),
      source: 'custom',
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      serving_size: Number(form.serving_size),
      // "g" is reserved for weighed foods so grams and ounces both work.
      serving_unit: ['g', 'gram', 'grams'].includes(unit.toLowerCase()) ? 'g' : unit,
      ...Object.fromEntries(MACROS.map((m) => [m, Number(form[m]) || 0])),
    }
    write([['foods', row]])
    onSaved({ ...food, ...row })
  }

  const remove = async () => {
    if (!(await askConfirm(`Delete ${food.name}? Days you already logged it on keep their numbers.`, { ok: 'Delete', danger: true }))) return
    write([['foods', { id: food.id, deleted_at: nowISO() }]])
    onBack()
  }

  return (
    <section>
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">My foods</p>
        <h2>{food ? 'Edit food' : 'Create a food'}</h2>
        <p className="muted">Enter the numbers for one serving, as written on a label or worked out for a home recipe.</p>
      </div>
      <div className="card">
        <label>
          Name
          <input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          Brand or note (optional)
          <input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
        </label>
        <div className="two">
          <label>
            Serving size
            <input inputMode="decimal" value={form.serving_size} onChange={(e) => set('serving_size', e.target.value)} />
          </label>
          <label>
            Unit
            <input value={form.serving_unit} placeholder="serving, cup, g" autoCapitalize="none" onChange={(e) => set('serving_unit', e.target.value)} />
          </label>
        </div>
        <MacroFields values={form} editable onChange={set} />
      </div>
      <div className="actions">
        {!valid && <p className="warn small">A food needs a name, a serving size above 0, and numbers of 0 or more.</p>}
        <button className="primary" disabled={!valid} onClick={save}>
          {food ? 'Save food' : 'Save and add'}
        </button>
        {food && (
          <button className="danger" onClick={remove}>
            Delete this food
          </button>
        )}
      </div>
    </section>
  )
}
