import { useState } from 'react'
import { supabase } from './supa'
import { write, sync, signOut } from './db'
import { askConfirm } from './confirm'
import { latestTarget } from './nutrition'
import Calculator from './Calculator'

const STATUS = {
  off: 'Cloud accounts are not connected yet. Everything is saved on this phone only.',
  idle: 'Waiting to sync.',
  syncing: 'Syncing',
  ok: 'Everything is synced.',
  error: 'Could not reach the cloud. Changes are saved on this phone and will sync later.',
}

// The profile: who you are, how the app behaves for you, and your calculated targets.
// `welcome` shows the first-time greeting; `intent.calculator` opens the calculator directly.
export default function Settings({ v, snap, onClose, intent, welcome, onWelcomed }) {
  const { db, session, status, online } = snap
  const [calculating, setCalculating] = useState(Boolean(intent?.calculator))
  const waiting = Object.keys(db.pending).length
  const save = (patch) => write([['profiles', { id: v.uid, ...patch }]])

  if (calculating) return <Calculator v={v} onClose={() => setCalculating(false)} />

  const calculated = Boolean(v.metrics?.auto && v.metrics?.birth_date)
  const target = latestTarget(v, 'training')
  const num = (n) => Number(n).toLocaleString()

  const backup = () => {
    const blob = new Blob([JSON.stringify(db.tables, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const leave = async () => {
    const warning = waiting
      ? `${waiting} ${waiting === 1 ? 'change has' : 'changes have'} not synced yet and will be lost. Sign out anyway?`
      : 'Sign out on this phone?'
    if (await askConfirm(warning, { ok: 'Sign out', danger: waiting > 0 })) signOut()
  }

  return (
    <section>
      <button className="back" onClick={onClose}>
        ‹ Back
      </button>
      <div className="weekhead">
        <p className="eyebrow">Settings</p>
        <h2>Profile</h2>
      </div>

      <div className="card">
        <label>
          Your name
          <input value={v.profile.display_name} onChange={(e) => save({ display_name: e.target.value })} autoComplete="given-name" />
        </label>
        <label>
          Weight unit for new sets
          <select value={v.profile.default_unit} onChange={(e) => save({ default_unit: e.target.value })}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </label>
        <label>
          Rest timer after each set
          <select value={v.profile.rest_seconds} onChange={(e) => save({ rest_seconds: Number(e.target.value) })}>
            <option value={0}>Off</option>
            <option value={30}>30 seconds</option>
            <option value={45}>45 seconds</option>
            <option value={60}>60 seconds</option>
            <option value={90}>90 seconds</option>
            <option value={120}>2 minutes</option>
          </select>
        </label>
      </div>

      <h3>Calories and macros</h3>
      <button className="card libcard" onClick={() => setCalculating(true)}>
        <span className="programhead">
          <strong>Calculate my targets</strong>
          {calculated && <em>In use</em>}
        </span>
        <span className="phasenote">
          {calculated && target?.calories
            ? `${num(target.calories)} calories · ${num(target.protein)} g protein · ${num(target.carbs)} g carbs · ${num(target.fat)} g fat`
            : 'Work out your calories and macros from your height, weight, activity and goal.'}
        </span>
        <span className="go">{calculated ? 'Update my numbers ›' : 'Open the calculator ›'}</span>
      </button>

      <h3>Account and sync</h3>
      <div className="card">
        {session && <p>{session.user.email}</p>}
        <p className="muted" role="status">
          {supabase && !online ? 'Offline. Changes are saved on this phone and will sync when you are back online.' : STATUS[status]}
          {supabase && waiting > 0 ? ` ${waiting} waiting.` : ''}
        </p>
        {supabase && (
          <>
            <button className="secondary" onClick={sync}>
              Sync now
            </button>
            <button className="danger" onClick={leave}>
              Sign out
            </button>
          </>
        )}
      </div>

      <h3>Backup</h3>
      <div className="card">
        <button className="secondary" onClick={backup}>
          Download a backup file
        </button>
      </div>

      {welcome && (
        <div className="scrim" onClick={onWelcomed}>
          <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="welcome-title" onClick={(e) => e.stopPropagation()}>
            <p id="welcome-title">
              <strong>Welcome to the app.</strong>
            </p>
            <p>Make sure to fill in your profile to get things started.</p>
            <button className="primary" onClick={onWelcomed}>
              Set up my profile
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
