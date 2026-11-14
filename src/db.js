import { useSyncExternalStore } from 'react'
import { supabase } from './supa'
import { openStorage } from './storage'

// Local-first data layer.
//
// Every change is written to this phone first, then copied to Supabase when there
// is a connection. Rows carry a client-made id, so replaying a queued change never
// creates a duplicate. Deletes are soft (deleted_at) so other devices hear about them.
// The newest write wins.
//
// The phone's copy lives in IndexedDB (see storage.js). Only rows that changed are
// written, in the same step as the list of changes still waiting to sync, so a change
// made with no signal survives closing the app and is replayed when a connection returns.

// Order matters when pushing: parents before children.
export const TABLES = [
  { name: 'profiles', pk: ['id'] },
  { name: 'user_presets', pk: ['id'] },
  { name: 'workouts', pk: ['id'] },
  { name: 'workout_exercises', pk: ['id'] },
  { name: 'workout_sets', pk: ['id'] },
  { name: 'one_rep_maxes', pk: ['user_id', 'exercise_key'] },
  { name: 'foods', pk: ['id'] },
  { name: 'food_logs', pk: ['id'] },
  { name: 'user_targets', pk: ['id'] },
  { name: 'user_profile_metrics', pk: ['user_id'] },
  { name: 'body_metrics', pk: ['id'] },
  { name: 'dose_items', pk: ['id'] },
  { name: 'dose_logs', pk: ['dose_item_id', 'scheduled_on'] },
  { name: 'progress_photos', pk: ['id'] },
  { name: 'water_logs', pk: ['id'] },
  { name: 'sleep_logs', pk: ['user_id', 'slept_on'] },
]

const pkOf = (table) => TABLES.find((t) => t.name === table).pk
const keyOf = (table, row) => pkOf(table).map((c) => row[c]).join('|')

const blank = (uid = 'local') => ({
  uid,
  pulledFor: null,
  tables: Object.fromEntries(TABLES.map((t) => [t.name, {}])),
  pending: {},
  cursors: {},
})

let db = blank()
let store = null
let meta = { status: supabase ? 'idle' : 'off', session: null, ready: false, online: navigator.onLine !== false }
let snapshot = { db, ...meta }
const listeners = new Set()

function emit() {
  snapshot = { db, ...meta }
  listeners.forEach((l) => l())
}
// What differs between two versions of the database, as rows to write and rows to remove.
function changes(prev, next) {
  const puts = []
  const dels = []
  for (const { name } of TABLES) {
    const before = prev.tables[name]
    const after = next.tables[name]
    if (before === after) continue
    for (const key in after) if (after[key] !== before[key]) puts.push([`${name}/${key}`, after[key]])
    for (const key in before) if (!(key in after)) dels.push(`${name}/${key}`)
  }
  const { tables: _tables, ...state } = next
  return { puts, dels, meta: state }
}

function commit(next) {
  const prev = db
  db = next
  store?.save(changes(prev, next), next)
  emit()
}
function setMeta(patch) {
  meta = { ...meta, ...patch }
  emit()
}

export function useDB() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}

export const uuid = () => crypto.randomUUID()
export const nowISO = () => new Date().toISOString()

// Insert or change rows. Each op is [table, row]; the row must include its key
// (id, or exercise_key for one_rep_maxes) and only the fields being changed.
export function write(ops) {
  const tables = { ...db.tables }
  const pending = { ...db.pending }
  const stamp = nowISO()
  for (const [table, patch] of ops) {
    const base = table === 'profiles' ? patch : { user_id: db.uid, ...patch }
    const key = keyOf(table, base)
    tables[table] = { ...tables[table], [key]: { ...tables[table][key], ...base, updated_at: stamp } }
    pending[`${table}/${key}`] = stamp
  }
  commit({ ...db, tables, pending })
  schedule()
}

let timer
let retry
let running = false
function schedule() {
  clearTimeout(timer)
  timer = setTimeout(sync, 1000)
}

export async function sync() {
  if (!supabase || !meta.session || running) return
  running = true
  setMeta({ status: 'syncing' })
  try {
    // Push queued changes.
    for (const { name, pk } of TABLES) {
      const entries = Object.entries(db.pending).filter(([p]) => p.startsWith(`${name}/`))
      if (!entries.length) continue
      const rows = entries
        .map(([p]) => db.tables[name][p.slice(name.length + 1)])
        .filter(Boolean)
        .map(({ synced_at, ...row }) => row)
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from(name).upsert(rows.slice(i, i + 200), { onConflict: pk.join(',') })
        if (error) throw error
      }
      const pending = { ...db.pending }
      // Only clear a change if the row was not edited again while it was in flight.
      for (const [p, stamp] of entries) if (pending[p] === stamp) delete pending[p]
      commit({ ...db, pending })
    }

    // Pull anything newer than what this phone has seen.
    for (const { name } of TABLES) {
      for (;;) {
        const cursor = db.cursors[name] || '1970-01-01T00:00:00Z'
        const { data, error } = await supabase
          .from(name)
          .select('*')
          .gt('synced_at', cursor)
          .order('synced_at')
          .limit(500)
        if (error) throw error
        if (!data.length) break
        const table = { ...db.tables[name] }
        for (const row of data) {
          const key = keyOf(name, row)
          if (!db.pending[`${name}/${key}`]) table[key] = row
        }
        commit({
          ...db,
          tables: { ...db.tables, [name]: table },
          cursors: { ...db.cursors, [name]: data[data.length - 1].synced_at },
        })
        if (data.length < 500) break
      }
    }
    if (db.pulledFor !== db.uid) commit({ ...db, pulledFor: db.uid })
    setMeta({ status: 'ok' })
  } catch (err) {
    console.error('sync failed', err)
    setMeta({ status: 'error' })
  } finally {
    running = false
    if (meta.status === 'ok' && Object.keys(db.pending).length) schedule()
    // After a failure keep trying quietly, so queued changes go up as soon as the connection is back.
    clearTimeout(retry)
    if (meta.status === 'error') retry = setTimeout(sync, 30000)
  }
}

// Work logged before signing in belongs to whoever signs in first on this phone.
function claimLocalRows(uid) {
  const tables = {}
  const pending = {}
  const stamp = nowISO()
  for (const { name } of TABLES) {
    tables[name] = {}
    for (const old of Object.values(db.tables[name])) {
      const row = name === 'profiles' ? { ...old, id: uid } : { ...old, user_id: uid }
      row.updated_at = stamp
      const key = keyOf(name, row)
      tables[name][key] = row
      pending[`${name}/${key}`] = stamp
    }
  }
  commit({ ...blank(uid), tables, pending })
}

function onSession(session) {
  const uid = session?.user?.id
  if (uid && db.uid !== uid) {
    if (db.uid === 'local') claimLocalRows(uid)
    else commit(blank(uid)) // a different person signed in: start from their cloud copy
  }
  setMeta({ session, ready: true })
  if (uid) schedule()
}

export async function signOut() {
  try {
    const { disablePush } = await import('./push')
    await disablePush()
  } catch {
    /* reminders were not on, or the phone is offline */
  }
  await supabase.auth.signOut()
  commit(blank())
}

// Start-up: read the phone's copy first, then find out who is signed in.
async function boot() {
  store = await openStorage()
  if (store.saved) {
    const base = blank()
    db = { ...base, ...store.saved, tables: { ...base.tables, ...store.saved.tables } }
  }
  window.addEventListener('online', () => {
    setMeta({ online: true })
    schedule()
  })
  window.addEventListener('offline', () => setMeta({ online: false }))
  if (!supabase) return setMeta({ ready: true })
  supabase.auth.onAuthStateChange((_event, session) => onSession(session))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule())
}
boot()
