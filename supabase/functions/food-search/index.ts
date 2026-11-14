// food-search: looks a food name up in USDA FoodData Central and returns a trimmed list.
// The USDA key stays here on the server (secret USDA_API_KEY); the browser never sees it.
// Until that secret is set it falls back to USDA's public DEMO_KEY, which is heavily rate limited.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const CACHE_DAYS = 30

// USDA nutrient ids. Energy has three possible ids depending on the data set.
const IDS = { calories: [1008, 2047, 2048], protein: [1003], carbs: [1005], fat: [1004], fiber: [1079] }

function nutrient(food: any, ids: number[]) {
  for (const id of ids) {
    const hit = (food.foodNutrients || []).find((n: any) => n.nutrientId === id)
    if (hit && typeof hit.value === 'number') return hit.value
  }
  return 0
}

// Everything is per 100 g (or per 100 ml for drinks), which is how USDA search reports it.
function trim(food: any) {
  const measure = (food.foodMeasures || []).find((m: any) => m.gramWeight > 0)
  const unit = String(food.servingSizeUnit || '').toLowerCase()
  const hasServing = food.servingSize > 0 && ['g', 'grm', 'ml', 'mlt'].includes(unit)
  return {
    fdcId: food.fdcId,
    description: food.description,
    brand: food.brandName || food.brandOwner || null,
    dataType: food.dataType,
    servingSize: hasServing ? food.servingSize : measure?.gramWeight ?? null,
    servingText: hasServing ? food.householdServingFullText || null : measure?.disseminationText || null,
    calories: nutrient(food, IDS.calories),
    protein: nutrient(food, IDS.protein),
    carbs: nutrient(food, IDS.carbs),
    fat: nutrient(food, IDS.fat),
    fiber: nutrient(food, IDS.fiber),
  }
}

async function usda(query: string, dataType: string[], pageSize: number) {
  const res = await fetch('https://api.nal.usda.gov/fdc/v1/foods/search', {
    method: 'POST',
    headers: { 'X-Api-Key': Deno.env.get('USDA_API_KEY') || 'DEMO_KEY', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, dataType, pageSize }),
  })
  if (!res.ok) throw new Error(res.status === 429 ? 'rate_limited' : `usda_${res.status}`)
  return ((await res.json()).foods || []).map(trim)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Signed-in users only.
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: req.headers.get('Authorization') || '',
        apikey: req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '',
      },
    })
    if (!who.ok) return json({ error: 'unauthorized' }, 401)

    const { query } = await req.json()
    const q = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)
    if (q.length < 2) return json({ foods: [] })

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const admin = serviceKey ? createClient(SUPABASE_URL, serviceKey) : null
    const key = `usda:search:${q}`

    // The cache is a nice-to-have: any failure here just means a fresh lookup.
    try {
      const { data } = await admin!.from('food_cache').select('payload, fetched_at').eq('key', key).maybeSingle()
      if (data && Date.now() - Date.parse(data.fetched_at) < CACHE_DAYS * 864e5) {
        return json({ foods: data.payload, cached: true })
      }
    } catch (_) { /* fall through */ }

    // Whole foods first (this family cooks from scratch), then packaged products.
    const [whole, branded] = await Promise.all([
      usda(q, ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], 15),
      usda(q, ['Branded'], 10),
    ])
    const foods = [...whole, ...branded]

    try {
      await admin!.from('food_cache').upsert({ key, payload: foods, fetched_at: new Date().toISOString() })
    } catch (_) { /* not fatal */ }

    return json({ foods })
  } catch (err) {
    const message = String((err as Error)?.message || err)
    if (message === 'rate_limited') return json({ error: 'rate_limited' }, 429)
    console.error('food-search failed', message)
    return json({ error: 'lookup_failed' }, 502)
  }
})
