import { supabase } from './supa'
import { write, sync, signOut } from './db'
import { BOOKS } from './program'
import { bookFor } from './logic'

const STATUS = {
  off: 'Cloud accounts are not connected yet. Everything is saved on this phone only.',
  idle: 'Waiting to sync.',
  syncing: 'Syncing',
  ok: 'Everything is synced.',
  error: 'Could not reach the cloud. Changes are saved on this phone and will sync later.',
}

export default function Settings({ v, snap }) {
  const { db, session, status } = snap
  const waiting = Object.keys(db.pending).length
  const save = (patch) => write([['profiles', { id: v.uid, ...patch }]])

  // Jump to another phase by opening a fresh block for it. Past blocks keep their history.
  const book = bookFor(v.profile.program_block)
  const switchPhase = (bookId) => {
    if (bookId === book.id) return
    const used = Math.max(v.profile.program_block, ...v.workouts.map((w) => w.program_block || 0))
    let block = used + 1
    while (bookFor(block).id !== bookId) block += 1
    save({ program_block: block })
  }

  const backup = () => {
    const blob = new Blob([JSON.stringify(db.tables, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const leave = () => {
    const warning = waiting
      ? `${waiting} ${waiting === 1 ? 'change has' : 'changes have'} not synced yet and will be lost. Sign out anyway?`
      : 'Sign out on this phone?'
    if (confirm(warning)) signOut()
  }

  return (
    <section>
      <div className="weekhead">
        <p className="eyebrow">Settings</p>
        <h2>Profile</h2>
      </div>

      <div className="card">
        <label>
          Your name
          <input value={v.profile.display_name} onChange={(e) => save({ display_name: e.target.value })} />
        </label>
        <label>
          Training phase
          <select value={book.id} onChange={(e) => switchPhase(Number(e.target.value))}>
            {BOOKS.map((b) => (
              <option key={b.id} value={b.id}>
                Phase {b.id}: {b.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">
          Phases move on by themselves after four weeks. Changing this starts the chosen phase at week 1.
        </p>
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

      <h3>Account and sync</h3>
      <div className="card">
        {session && <p>{session.user.email}</p>}
        <p className="muted" role="status">
          {STATUS[status]}
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
    </section>
  )
}
