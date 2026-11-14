import { useSyncExternalStore } from 'react'

// In-app "are you sure?" sheet. The browser's own confirm() box is unreliable:
// embedded browsers and some installed-app modes silently answer "no".
//
//   if (await askConfirm('Delete this workout?', { ok: 'Delete', danger: true })) { ... }

let current = null
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

export function askConfirm(text, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    current?.resolve(false)
    current = { text, ok, cancel, danger, resolve }
    emit()
  })
}

function answer(value) {
  const asked = current
  current = null
  emit()
  asked?.resolve(value)
}

export function ConfirmHost() {
  const asked = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  if (!asked) return null
  return (
    <div className="scrim" onClick={() => answer(false)}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-label={asked.text} onClick={(e) => e.stopPropagation()}>
        <p>{asked.text}</p>
        <button className={asked.danger ? 'primary destructive' : 'primary'} onClick={() => answer(true)}>
          {asked.ok}
        </button>
        <button className="secondary" onClick={() => answer(false)}>
          {asked.cancel}
        </button>
      </div>
    </div>
  )
}
