import { supabase } from './supa'

// Phone notifications (Web Push). A phone subscribes once; the server then sends
// dose reminders to it. On iPhone this only exists for the Home Screen app.

export const pushSupported = () =>
  Boolean(supabase) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function keyBytes(base64url) {
  const text = atob(base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '='))
  return Uint8Array.from(text, (c) => c.charCodeAt(0))
}

// The helper that shows notifications. Before subscribing, make sure the phone is running
// the newest copy of it: an older copy would receive reminders but not know how to show them.
async function registration() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('no-worker')
  await reg.update().catch(() => {})
  const incoming = reg.installing || reg.waiting
  if (incoming) {
    await new Promise((resolve) => {
      const done = () => (incoming.state === 'activated' || incoming.state === 'redundant') && resolve()
      incoming.addEventListener('statechange', done)
      done()
      setTimeout(resolve, 8000)
    })
  }
  return reg
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

// Tell the server about this phone (also keeps its time zone up to date).
export async function saveSubscription(sub, userId) {
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: j.endpoint, user_id: userId, p256dh: j.keys.p256dh, auth: j.keys.auth, tz: timeZone(), updated_at: new Date().toISOString() },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

// Must be called straight from a tap: the permission prompt has to come first.
export async function enablePush(userId) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')
  const reg = await registration()
  const { data, error } = await supabase.functions.invoke('dose-reminders', { body: { action: 'key' } })
  if (error || !data?.publicKey) throw new Error('no-key')
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) }))
  await saveSubscription(sub, userId)
  return sub
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTest() {
  const { data, error } = await supabase.functions.invoke('dose-reminders', { body: { action: 'test' } })
  if (error) throw error
  return data
}
