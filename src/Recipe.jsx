import { useState } from 'react'
import { write, uuid, nowISO } from './db'
import { MACROS, MACRO_LABEL, fmt, round, sum } from './nutrition'
import { askConfirm } from './confirm'
import AddFood from './AddFood'

// Build a recipe from foods and amounts. It is saved as one of your foods,
// with the numbers for a single serving, and logged like any other food.
export default function Recipe({ v, food, onBack, onSaved }) {
  const [name, setName] = useState(food?.name || '')
  const [servings, setServings] = useState(String(food?.recipe?.servings ?? 1))
  const [items, setItems] = useState(food?.recipe?.items || [])
  const [picking, setPicking] = useState(false)

  if (picking) {
    return (
      <AddFood
        v={v}
        onClose={() => setPicking(false)}
        onIngredient={(item) => {
          setItems((list) => [...list, item])
          setPicking(false)
        }}
      />
    )
  }

  const n = Number(servings)
  const totals = sum(items)
  const per = Object.fromEntries(MACROS.map((m) => [m, round(totals[m] / (n > 0 ? n : 1), m === 'calories' ? 0 : 1)]))
  const valid = name.trim() && n > 0 && items.length > 0

  const save = () => {
    const row = {
      id: food?.id || uuid(),
      source: 'recipe',
      name: name.trim(),
      brand: null,
      serving_size: 1,
      serving_unit: 'serving',
      ...per,
      recipe: { servings: n, items },
    }
    write([['foods', row]])
    onSaved({ ...food, ...row })
  }

  const remove = async () => {
    if (!(await askConfirm(`Delete the recipe ${food.name}? Days you already logged it on keep their numbers.`, { ok: 'Delete', danger: true }))) return
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
        <h2>{food ? 'Edit recipe' : 'Create a recipe'}</h2>
        <p className="muted">Add everything that goes in the pot, then say how many servings it makes.</p>
      </div>

      <div className="card">
        <label>
          Recipe name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Turkey chili, Overnight oats" />
        </label>
        <label>
          Servings it makes
          <input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
        </label>
      </div>

      <h3>Ingredients</h3>
      {items.length ? (
        <ul className="list">
          {items.map((it, i) => (
            <li key={i} className="split">
              <button disabled>
                <span>
                  {it.name}
                  <small className="left">
                    {fmt(it.quantity)} {it.unit}
                    {it.brand ? ` · ${it.brand}` : ''}
                  </small>
                </span>
                <small>
                  {fmt(it.calories)} cal
                  <br />P {fmt(it.protein)} · C {fmt(it.carbs)} · F {fmt(it.fat)}
                </small>
              </button>
              <button className="side danger-text" aria-label={`Remove ${it.name}`} onClick={() => setItems((list) => list.filter((_, x) => x !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No ingredients yet.</p>
      )}
      <button className="secondary" onClick={() => setPicking(true)}>
        Add an ingredient
      </button>

      {items.length > 0 && (
        <>
          <h3>Per serving</h3>
          <div className="card perserving">
            {MACROS.map((m) => (
              <p className="barline" key={m}>
                <span>{MACRO_LABEL[m]}</span>
                <span>
                  {fmt(per[m])}
                  {m === 'calories' ? '' : ' g'}
                </span>
              </p>
            ))}
            <p className="muted small">
              Whole recipe: {fmt(totals.calories)} cal, {fmt(totals.protein)} g protein.
            </p>
          </div>
        </>
      )}

      <div className="actions">
        {!valid && <p className="warn small">A recipe needs a name, at least one ingredient, and servings above 0.</p>}
        <button className="primary" disabled={!valid} onClick={save}>
          {food ? 'Save recipe' : 'Save and add'}
        </button>
        {food && (
          <button className="danger" onClick={remove}>
            Delete this recipe
          </button>
        )}
      </div>
    </section>
  )
}
