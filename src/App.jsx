import { useEffect, useState } from 'react'
import { supabase } from './supa'
import { useDB, write, sync } from './db'
import { view } from './logic'
import Auth from './Auth'
import Landing from './Landing'
import { ConfirmHost } from './confirm'
import Dashboard from './Dashboard'
import Today from './Today'
import Food from './Food'
import Progress from './Progress'
import Doses from './Doses'
import { missedOps, dueToday, missedOn, logKey } from './dosing'
import { localDate } from './logic'
import { addDays } from './calc'
import Settings from './Settings'

// Settings is opened from the Home screen, so it has no tab of its own.
const TABS = [
  ['home', 'Home'],
  ['today', 'Train'],
  ['food', 'Food'],
  ['doses', 'Doses'],
  ['progress', 'Progress'],
]

export default function App() {
  const snap = useDB()
  const { db, session, ready, status, online } = snap
  const [tab, setTab] = useState(() => (new URLSearchParams(location.search).get('tab') === 'doses' ? 'doses' : 'home'))
  // Where a dashboard shortcut wants a tab to open: a date, a form, a view. `n` forces a fresh start.
  const [intent, setIntent] = useState({ n: 0 })
  const go = (to, detail = {}) => {
    setIntent((i) => ({ ...detail, n: i.n + 1 }))
    setTab(to)
  }
  const [welcome, setWelcome] = useState(false)
  const v = view(db)
  const waiting = Object.keys(db.pending).length
  const loaded = !supabase || db.pulledFor === db.uid

  // Turn yesterday's unlogged doses into "missed" entries, once the latest data is in.
  useEffect(() => {
    if (!loaded) return
    const ops = missedOps(v)
    if (ops.length) write(ops)
  }, [loaded, v])

  // A tapped reminder asks the already-open app to show the Doses tab.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e) => e.data?.type === 'open' && e.data.tab === 'doses' && setTab('doses')
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // Only mention changes waiting to sync if they have been waiting a few seconds.
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (!waiting) return setStuck(false)
    const t = setTimeout(() => setStuck(true), 4000)
    return () => clearTimeout(t)
  }, [waiting > 0])

  // First time in: start a profile (using the name given at sign-up, if any), open it,
  // and greet the person there. The profile row is what marks the account as set up.
  const signedIn = !supabase || Boolean(session)
  useEffect(() => {
    if (!ready || !loaded || !signedIn || v.hasProfile) return
    write([['profiles', { id: db.uid, display_name: session?.user?.user_metadata?.display_name || '', program_id: null }]])
    setTab('settings')
    setWelcome(true)
  }, [ready, loaded, signedIn, v.hasProfile])

  const today = localDate()
  const doseAlert =
    dueToday(v, today).some((i) => !v.doseLogs[logKey(i.id, today)]) || missedOn(v, addDays(today, -1)).length > 0

  if (!ready) return <Splash text="Loading" />
  if (supabase && !session) return <SignedOut />
  if (supabase && db.pulledFor !== db.uid) {
    return <Splash text={status === 'error' ? 'Could not reach the cloud.' : 'Getting your data'} retry={status === 'error'} />
  }
  if (!v.hasProfile) return <Splash text="Setting up" />

  return (
    <div className="app">
      {supabase && !online && (
        <p className="statusbar" role="status">
          <strong>Offline.</strong>{' '}
          {waiting
            ? `${waiting} ${waiting === 1 ? 'change is' : 'changes are'} saved on this phone and will sync when you are back online.`
            : 'What you log is saved on this phone and will sync when you are back online.'}
        </p>
      )}
      {supabase && online && status === 'error' && (
        <p className="statusbar" role="status">
          Cannot reach the cloud right now. {waiting} {waiting === 1 ? 'change is' : 'changes are'} saved on this phone
          and will sync soon.
        </p>
      )}
      {supabase && online && status !== 'error' && stuck && (
        <p className="statusbar quiet" role="status">
          Syncing {waiting} {waiting === 1 ? 'change' : 'changes'}
        </p>
      )}

      <main>
        {tab === 'home' && <Dashboard v={v} go={go} />}
        {tab === 'today' && <Today key={intent.n} v={v} />}
        {tab === 'food' && <Food key={intent.n} v={v} intent={intent} go={go} />}
        {tab === 'progress' && <Progress key={intent.n} v={v} intent={intent} />}
        {tab === 'doses' && <Doses key={intent.n} v={v} />}
        {tab === 'settings' && (
          <Settings key={intent.n} v={v} snap={snap} intent={intent} onClose={() => setTab('home')} welcome={welcome} onWelcomed={() => setWelcome(false)} />
        )}
      </main>

      <ConfirmHost />

      <nav className="tabs">
        {TABS.map(([id, name]) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
            <TabIcon id={id} />
            {name}
            {id === 'doses' && doseAlert && <span className="dot" aria-label="something is due" />}
          </button>
        ))}
      </nav>
    </div>
  )
}

// A visitor in a browser sees the landing page first. The installed app goes straight to sign-in.
function SignedOut() {
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  const [mode, setMode] = useState(installed ? 'in' : null)
  if (!mode) return <Landing onStart={setMode} />
  return <Auth initialMode={mode} onBack={installed ? null : () => setMode(null)} />
}

const TAB_ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  today: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  food: 'M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 2c-2 2-3 5-3 8h3v12',
  doses: 'M10.5 20.5a4.95 4.95 0 0 1-7-7l9-9a4.95 4.95 0 0 1 7 7zM8.5 8.5l7 7',
  progress: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
}

function TabIcon({ id }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={TAB_ICONS[id]} />
    </svg>
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
