import { useState } from 'react'
import { supabase } from './supa'

export default function Auth() {
  const [mode, setMode] = useState('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const creds = { email: email.trim(), password }
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword(creds)
        : await supabase.auth.signUp({ ...creds, options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) setMessage({ bad: true, text: error.message })
    else if (mode === 'up' && !data.session) {
      setMode('in')
      setMessage({ text: 'Account created. Open the confirmation email, then sign in here.' })
    }
  }

  return (
    <div className="app onboarding">
      <h1>Workout</h1>
      <p className="muted">Each person signs in to their own account.</p>

      <div className="seg">
        <button aria-selected={mode === 'in'} onClick={() => setMode('in')}>
          Sign in
        </button>
        <button aria-selected={mode === 'up'} onClick={() => setMode('up')}>
          Create account
        </button>
      </div>

      <form className="card" onSubmit={submit}>
        {mode === 'up' && (
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'One moment' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        {message && <p className={message.bad ? 'warn' : 'muted'}>{message.text}</p>}
      </form>
    </div>
  )
}
