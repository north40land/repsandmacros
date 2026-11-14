// food-barcode: looks a product barcode (UPC/EAN) up in Open Food Facts first,
// then in USDA branded foods, and returns one trimmed food or null.
// Macros are per 100 g, matching food-search.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const CACHE_DAYS = 30
// Open Food Facts asks every app to identify itself: name, version and a contact address.
const USER_AGENT = 'RepsAndMacros/1.0 (+https://repsandmacros.com)'

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const bare = (code: string) => code.replace(/^0+/, '')

async function openFoodFacts(code: string) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity`,
    { headers: { 'User-Agent': USER_AGENT } },
  )
  if (!res.ok) return null
  const body = await res.json()
  const p = body.product
  const n = p?.nutriments
  if (body.status !== 1 || !p?.product_name || !n) return null
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : null)
  // A listing with no nutrition numbers is no use here; let USDA have a try.
  if (kcal == null && n['proteins_100g'] == null) return null
  return {
    source: 'off',
    code,
    description: p.product_name,
    brand: String(p.brands || '').split(',')[0].trim() || null,
    servingSize: num(p.serving_quantity) > 0 ? num(p.serving_quantity) : null,
    servingText: String(p.serving_size || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || null,
    calories: num(kcal),
    protein: num(n['proteins_100g']),
    carbs: num(n['carbohydrates_100g']),
    fat: num(n['fat_100g']),
    fiber: num(n['fiber_100g']),
  }
}

const IDS = { calories: [1008, 2047, 2048], protein: [1003], carbs: [1005], fat: [1004], fiber: [1079] }
function nutrient(food: any, ids: number[]) {
  for (const id of ids) {
    const hit = (food.foodNutrients || []).find((x: any) => x.nutrientId === id)
    if (hit && typeof hit.value === 'number') return hit.value
  }
  return 0
}

async function usdaBranded(code: string) {
  const res = await fetch('https://api.nal.usda.gov/fdc/v1/foods/search', {
    method: 'POST',
    headers: { 'X-Api-Key': Deno.env.get('USDA_API_KEY') || 'DEMO_KEY', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: code, dataType: ['Branded'], pageSize: 10 }),
  })
  if (!res.ok) throw new Error(res.status === 429 ? 'rate_limited' : `usda_${res.status}`)
  const food = ((await res.json()).foods || []).find((f: any) => bare(String(f.gtinUpc || '')) === bare(code))
  if (!food) return null
  const unit = String(food.servingSizeUnit || '').toLowerCase()
  const hasServing = food.servingSize > 0 && ['g', 'grm', 'ml', 'mlt'].includes(unit)
  return {
    source: 'usda',
    code,
    fdcId: food.fdcId,
    description: food.description,
    brand: food.brandName || food.brandOwner || null,
    servingSize: hasServing ? food.servingSize : null,
    servingText: hasServing ? food.householdServingFullText || null : null,
    calories: nutrient(food, IDS.calories),
    protein: nutrient(food, IDS.protein),
    carbs: nutrient(food, IDS.carbs),
    fat: nutrient(food, IDS.fat),
    fiber: nutrient(food, IDS.fiber),
  }
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

    const { upc } = await req.json()
    const code = String(upc || '').replace(/\D/g, '')
    if (code.length < 8 || code.length > 14) return json({ error: 'bad_code' }, 400)

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const admin = serviceKey ? createClient(SUPABASE_URL, serviceKey) : null
    const key = `upc:${code}`

    try {
      const { data } = await admin!.from('food_cache').select('payload, fetched_at').eq('key', key).maybeSingle()
      if (data && Date.now() - Date.parse(data.fetched_at) < CACHE_DAYS * 864e5) {
        return json({ food: data.payload, cached: true })
      }
    } catch (_) { /* fall through */ }

    const food = (await openFoodFacts(code).catch(() => null)) ?? (await usdaBranded(code))
    if (!food) return json({ food: null })

    try {
      await admin!.from('food_cache').upsert({ key, payload: food, fetched_at: new Date().toISOString() })
    } catch (_) { /* not fatal */ }

    return json({ food })
  } catch (err) {
    const message = String((err as Error)?.message || err)
    if (message === 'rate_limited') return json({ error: 'rate_limited' }, 429)
    console.error('food-barcode failed', message)
    return json({ error: 'lookup_failed' }, 502)
  }
})
