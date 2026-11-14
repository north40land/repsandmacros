import { useEffect, useState } from 'react'
import { supabase } from './supa'
import { useDB, write, sync } from './db'
import { view } from './logic'
import Auth from './Auth'
import { ConfirmHost } from './confirm'
import Today from './Today'
import Food from './Food'
import Progress from './Progress'
import Doses from './Doses'
import { missedOps, dueToday, missedOn, logKey } from './dosing'
import { localDate } from './logic'
import { addDays } from './calc'
import Settings from './Settings'

const TABS = [
  ['today', 'Today'],
  ['food', 'Food'],
  ['doses', 'Doses'],
  ['progress', 'Progress'],
  ['settings', 'Settings'],
]

export default function App() {
  const snap = useDB()
  const { db, session, ready, status } = snap
  const [tab, setTab] = useState('today')
  const [firstScreen, setFirstScreen] = useState(null)
  const v = view(db)
  const waiting = Object.keys(db.pending).length
  const loaded = !supabase || db.pulledFor === db.uid

  // Turn yesterday's unlogged doses into "missed" entries, once the latest data is in.
  useEffect(() => {
    if (!loaded) return
    const ops = missedOps(v)
    if (ops.length) write(ops)
  }, [loaded, v])

  const today = localDate()
  const doseAlert =
    dueToday(v, today).some((i) => !v.doseLogs[logKey(i.id, today)]) || missedOn(v, addDays(today, -1)).length > 0

  if (supabase && !ready) return <Splash text="Loading" />
  if (supabase && !session) return <Auth />
  if (supabase && db.pulledFor !== db.uid) {
    return <Splash text={status === 'error' ? 'Could not reach the cloud.' : 'Getting your data'} retry={status === 'error'} />
  }
  if (!v.hasProfile) {
    return (
      <Welcome
        uid={db.uid}
        suggested={session?.user?.user_metadata?.display_name || ''}
        onDone={(browse) => setFirstScreen(browse ? { type: 'library' } : null)}
      />
    )
  }

  return (
    <div className="app">
      {supabase && status === 'error' && (
        <p className="statusbar" role="status">
          No connection to the cloud. {waiting} {waiting === 1 ? 'change is' : 'changes are'} saved on this phone and
          will sync later.
        </p>
      )}

      <main>
        {tab === 'today' && <Today v={v} firstScreen={firstScreen} clearFirstScreen={() => setFirstScreen(null)} />}
        {tab === 'food' && <Food v={v} />}
        {tab === 'progress' && <Progress v={v} />}
        {tab === 'doses' && <Doses v={v} />}
        {tab === 'settings' && <Settings v={v} snap={snap} />}
      </main>

      <ConfirmHost />

      <nav className="tabs">
        {TABS.map(([id, name]) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            {name}
            {id === 'doses' && doseAlert && <span className="dot" aria-label="something is due" />}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Splash({ text, retry }) {
  return (
    <div className="app onboarding center">
      <h1>Workout</h1>
      <p className="muted" role="status">
        {text}
      </p>
      {retry && (
        <button className="primary" onClick={sync}>
          Try again
        </button>
      )}
    </div>
  )
}

function Welcome({ uid, suggested, onDone }) {
  const [name, setName] = useState(suggested)
  // Everyone starts with no program; "Browse programs" opens the library straight away.
  const create = (browse) => {
    if (!name.trim()) return
    write([['profiles', { id: uid, display_name: name.trim(), program_id: null }]])
    onDone(browse)
  }
  return (
    <div className="app onboarding">
      <h1>Workout</h1>
      <p className="muted">Your own log, targets and progress.</p>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          create(true)
        }}
      >
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </label>
        <p className="fieldname">How do you want to train?</p>
        <button className="primary" disabled={!name.trim()}>
          Follow a program
          <small className="sub">Browse plans that set your sessions and weights</small>
        </button>
        <button type="button" className="secondary" disabled={!name.trim()} onClick={() => create(false)}>
          Log my own workouts
        </button>
        <p className="muted small">You can start or stop a program at any time.</p>
      </form>
    </div>
  )
}
