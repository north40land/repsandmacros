// dose-reminders: phone notifications for the dosing log.
//
//   { action: "key" }   signed-in user. Returns the public key a phone needs to subscribe.
//   { action: "test" }  signed-in user. Sends a test notification to that person's phones.
//   { action: "run" }   the database schedule (every 5 minutes), identified by a shared secret.
//                       Sends "due now" reminders and one follow-up for anything still unlogged.
//
// The signing keys are created on first use and kept in push_config, which only this
// function (service role) can read.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const CONTACT = 'https://repsandmacros.com'
const WINDOW_MIN = 60 // do not send a reminder more than an hour late
const NUDGE_AFTER_MIN = 120

let cached: { app: webpush.ApplicationServer; publicKey: string } | null = null

async function pushServer() {
  if (cached) return cached
  const { data: cfg, error } = await admin.from('push_config').select('vapid').eq('id', 1).single()
  if (error) throw new Error(`push_config: ${error.message}`)
  let exported = cfg.vapid
  if (!exported) {
    const fresh = await webpush.exportVapidKeys(await webpush.generateVapidKeys({ extractable: true }))
    // Only the first caller gets to set the keys.
    const { data: won } = await admin.from('push_config').update({ vapid: fresh }).eq('id', 1).is('vapid', null).select('vapid')
    exported = won?.length ? fresh : (await admin.from('push_config').select('vapid').eq('id', 1).single()).data!.vapid
  }
  const vapidKeys = await webpush.importVapidKeys(exported, { extractable: false })
  cached = {
    app: await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys }),
    publicKey: await webpush.exportApplicationServerKey(vapidKeys),
  }
  return cached
}

type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string; updated_at: string }

// Send one notification to one phone. A phone that has unsubscribed is forgotten.
async function send(sub: Sub, payload: Record<string, unknown>) {
  const { app } = await pushServer()
  try {
    await app
      .subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
      .pushTextMessage(JSON.stringify(payload), { urgency: webpush.Urgency.High, ttl: 3600 })
    return 201
  } catch (err) {
    const status = err instanceof webpush.PushMessageError ? err.response.status : 0
    if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    else console.error('push failed', status, String(err))
    return status
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function localNow(now: Date, tz: string) {
  const read = (zone: string) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
      }).formatToParts(now).map((p) => [p.type, p.value]),
    )
  let p
  try { p = read(tz) } catch (_) { p = read('UTC') }
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  }
}
const toMinutes = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null)
const dose = (i: any) => `${i.name}, ${Number(i.amount)} ${i.unit}`

async function run(dry: boolean) {
  const { data: subs, error } = await admin.from('push_subscriptions').select('*')
  if (error) throw new Error(error.message)
  const byUser = new Map<string, Sub[]>()
  for (const s of (subs || []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s])

  const now = new Date()
  const out: unknown[] = []
  for (const [userId, phones] of byUser) {
    // Use the time zone of the phone that checked in most recently.
    const tz = [...phones].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0].tz
    const local = localNow(now, tz)

    const { data: items } = await admin.from('dose_items')
      .select('id, name, amount, unit, schedule_days, time_of_day, starts_on')
      .eq('user_id', userId).eq('active', true).is('deleted_at', null)
    const due = (items || []).filter((i: any) => (i.schedule_days || []).includes(local.weekday) && i.starts_on <= local.date)
    if (!due.length) continue

    const [{ data: logs }, { data: profile }, { data: sent }] = await Promise.all([
      admin.from('dose_logs').select('dose_item_id').eq('user_id', userId).eq('scheduled_on', local.date).is('deleted_at', null),
      admin.from('profiles').select('reminder_time, reminder_followup').eq('id', userId).maybeSingle(),
      admin.from('push_sent').select('dose_item_id, kind').eq('user_id', userId).eq('scheduled_on', local.date),
    ])
    const logged = new Set((logs || []).map((l: any) => l.dose_item_id))
    const already = new Set((sent || []).map((s: any) => `${s.dose_item_id}|${s.kind}`))
    const fallback = toMinutes(profile?.reminder_time ?? null) ?? 8 * 60
    const open = due.filter((i: any) => !logged.has(i.id))

    for (const kind of ['due', 'nudge'] as const) {
      if (kind === 'nudge' && profile?.reminder_followup === false) continue
      const offset = kind === 'due' ? 0 : NUDGE_AFTER_MIN
      const batch = open.filter((i: any) => {
        const at = (toMinutes(i.time_of_day) ?? fallback) + offset
        return local.minutes >= at && local.minutes < at + WINDOW_MIN && !already.has(`${i.id}|${kind}`)
      })
      if (!batch.length) continue

      const payload = {
        title: kind === 'nudge' ? 'Still due today' : batch.length === 1 ? 'Due now' : `${batch.length} items due`,
        body: batch.map(dose).join(' · ').slice(0, 180),
        tag: `dose-${kind}-${local.date}`,
        url: './?tab=doses',
      }
      if (dry) {
        out.push({ user: userId.slice(0, 8), tz, kind, payload, phones: phones.length })
        continue
      }
      // Record first, so a slow send can never cause a second copy on the next run.
      await admin.from('push_sent').upsert(
        batch.map((i: any) => ({ dose_item_id: i.id, scheduled_on: local.date, kind, user_id: userId })),
        { onConflict: 'dose_item_id,scheduled_on,kind', ignoreDuplicates: true },
      )
      const results = await Promise.all(phones.map((p) => send(p, payload)))
      out.push({ user: userId.slice(0, 8), kind, items: batch.length, results })
    }
  }
  return { users: byUser.size, notifications: out }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))

    if (body.action === 'run') {
      const { data: cfg } = await admin.from('push_config').select('cron_secret').eq('id', 1).single()
      if (!cfg?.cron_secret || req.headers.get('x-cron-secret') !== cfg.cron_secret) return json({ error: 'unauthorized' }, 401)
      // A dry run reports what would be sent and checks the signing keys load, without sending anything.
      if (body.dry) return json({ ...(await run(true)), keyLength: (await pushServer()).publicKey.length })
      return json(await run(false))
    }

    // Everything else needs a signed-in user.
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: req.headers.get('Authorization') || '',
        apikey: req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '',
      },
    })
    if (!who.ok) return json({ error: 'unauthorized' }, 401)
    const user = await who.json()

    if (body.action === 'key') return json({ publicKey: (await pushServer()).publicKey })

    if (body.action === 'test') {
      const { data: phones } = await admin.from('push_subscriptions').select('*').eq('user_id', user.id)
      const results = await Promise.all(
        ((phones || []) as Sub[]).map((p) =>
          send(p, { title: 'Reminders are on', body: 'This is how a dose reminder will look.', tag: 'dose-test', url: './?tab=doses' }),
        ),
      )
      return json({ phones: results.length, delivered: results.filter((s) => s >= 200 && s < 300).length, results })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (err) {
    console.error('dose-reminders failed', String((err as Error)?.message || err))
    return json({ error: 'failed' }, 500)
  }
})
