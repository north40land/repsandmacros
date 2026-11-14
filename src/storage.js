// Where the phone keeps its copy of the data.
//
// IndexedDB is used because it has room to grow (food logs, weigh-ins, years of sets) and
// only the rows that changed are written each time. If a browser has no IndexedDB, the
// older whole-document copy in localStorage is used instead.
//
//   rows  one record per database row, keyed "table/rowKey"
//   meta  one record: who is signed in, what is waiting to sync, how far each table has been pulled

const NAME = 'workout'
const OLD_KEY = 'wk.db.v2' // the localStorage copy used before this

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('rows')
      req.result.createObjectStore('meta')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('blocked'))
  })
}
const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
const ask = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

function readOld() {
  try {
    const raw = localStorage.getItem(OLD_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Returns { kind, saved, save(change, whole) }.
//   saved   the stored database ({ uid, pulledFor, pending, cursors, tables }) or null
//   save    change = { puts: [[key, row]], dels: [key], meta } ; whole = the full database
export async function openStorage() {
  let idb
  try {
    idb = await open()
  } catch {
    // No IndexedDB here: keep the single-document copy.
    return {
      kind: 'localStorage',
      saved: readOld(),
      save(_change, whole) {
        try {
          localStorage.setItem(OLD_KEY, JSON.stringify(whole))
        } catch {
          /* storage unavailable: keep working in memory */
        }
      },
    }
  }

  const save = (change) => {
    try {
      const tx = idb.transaction(['rows', 'meta'], 'readwrite')
      const rows = tx.objectStore('rows')
      for (const [key, row] of change.puts) rows.put(row, key)
      for (const key of change.dels) rows.delete(key)
      if (change.meta) tx.objectStore('meta').put(change.meta, 'state')
      return done(tx).catch((err) => console.error('saving to the phone failed', err))
    } catch (err) {
      console.error('saving to the phone failed', err)
      return Promise.resolve()
    }
  }

  const tx = idb.transaction(['rows', 'meta'], 'readonly')
  const [keys, rows, state] = await Promise.all([ask(tx.objectStore('rows').getAllKeys()), ask(tx.objectStore('rows').getAll()), ask(tx.objectStore('meta').get('state'))])

  let saved = null
  if (state) {
    const tables = {}
    keys.forEach((key, i) => {
      const cut = key.indexOf('/')
      ;(tables[key.slice(0, cut)] ||= {})[key.slice(cut + 1)] = rows[i]
    })
    saved = { ...state, tables }
  } else {
    // First run on the new store: bring the old copy across, then retire it.
    const old = readOld()
    if (old) {
      const puts = []
      for (const [table, byKey] of Object.entries(old.tables || {})) for (const [key, row] of Object.entries(byKey)) puts.push([`${table}/${key}`, row])
      const { tables: _tables, ...meta } = old
      await save({ puts, dels: [], meta })
      const check = await ask(idb.transaction('meta', 'readonly').objectStore('meta').get('state'))
      if (check) {
        try {
          localStorage.removeItem(OLD_KEY)
        } catch {
          /* leaving it behind is harmless */
        }
      }
      saved = old
    }
  }

  // Ask the browser not to clear this data when space runs low. It may say no; that is fine.
  navigator.storage?.persist?.().catch(() => {})

  return { kind: 'indexedDB', saved, save }
}
