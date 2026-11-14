import { useEffect, useState } from 'react'
import { write } from './db'
import { hhmm } from './dosing'
import { pushSupported, isIOS, isInstalled, currentSubscription, saveSubscription, enablePush, disablePush, sendTest } from './push'

// The reminders card on the Doses screen: switch notifications on for this phone
// and choose how they behave.
export default function Reminders({ v }) {
  const [state, setState] = useState('checking') // checking | off | on
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const supported = pushSupported()

  useEffect(() => {
    if (!supported) return
    let live = true
    currentSubscription()
      .then((sub) => {
        if (!live) return
        setState(sub ? 'on' : 'off')
        // Keep the server's copy fresh, including the time zone after travel.
        if (sub) saveSubscription(sub, v.uid).catch(() => {})
      })
      .catch(() => live && setState('off'))
    return () => {
      live = false
    }
  }, [supported, v.uid])

  const act = async (fn) => {
    setBusy(true)
    setNote(null)
    try {
      await fn()
    } catch (err) {
      const why = String(err?.message || err)
      setNote({
        bad: true,
        text:
          why === 'denied'
            ? "Notifications are blocked for this app. Allow them in the phone's Settings under Notifications, then try again."
            : why === 'no-worker'
              ? 'Reminders are not ready yet. Close the app, open it again, and try once more.'
              : 'That did not work. Check your connection and try again.',
      })
    }
    setBusy(false)
  }

  if (!supported) {
    return (
      <>
        <h3>Reminders</h3>
        <p className="muted small">
          {isIOS() && !isInstalled()
            ? 'On iPhone, reminders work from the Home Screen app. Open the app from your Home Screen and this switch will appear.'
            : 'This browser cannot show reminders.'}
        </p>
      </>
    )
  }

  return (
    <>
      <h3>Reminders</h3>
      <div className="card">
        {state === 'on' ? (
          <>
            <p>
              <strong>On for this phone.</strong> You get a notification when something is due and not yet logged.
            </p>
            <label>
              Remind me about items with no set time at
              <input type="time" value={hhmm(v.profile.reminder_time) || '08:00'} onChange={(e) => e.target.value && write([['profiles', { id: v.uid, reminder_time: e.target.value }]])} />
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={v.profile.reminder_followup !== false}
                onChange={(e) => write([['profiles', { id: v.uid, reminder_followup: e.target.checked }]])}
              />
              Nudge me once if it is still not logged two hours later
            </label>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const r = await sendTest()
                  setNote(
                    r.delivered
                      ? { text: 'Test sent. It should appear on this phone within a few seconds.' }
                      : { bad: true, text: 'The test could not be delivered. Turn reminders off and on again.' },
                  )
                })
              }
            >
              Send a test notification
            </button>
            <button className="danger" disabled={busy} onClick={() => act(async () => { await disablePush(); setState('off') })}>
              Turn off on this phone
            </button>
          </>
        ) : (
          <>
            <p className="muted">Get a notification on this phone when a dose is due and has not been logged.</p>
            <button className="primary" disabled={busy || state === 'checking'} onClick={() => act(async () => { await enablePush(v.uid); setState('on') })}>
              {busy ? 'One moment' : 'Turn on reminders'}
            </button>
          </>
        )}
        {note && <p className={note.bad ? 'warn small' : 'muted small'} role="status">{note.text}</p>}
      </div>
    </>
  )
}
