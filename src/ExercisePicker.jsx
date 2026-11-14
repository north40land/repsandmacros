import { useEffect, useRef, useState } from 'react'
import { BODY_PARTS } from './logic'
import { suggestExercises } from './exercises'

const partName = (id) => BODY_PARTS.find(([p]) => p === id)?.[1] || id

// A name box with a quick list under it. Typing narrows the list; tapping a row picks
// it. Anything can still be typed and used as is.
//   parts:   body parts of the workout, so matching exercises come first
//   exclude: names already in the workout
//   onPick:  called with the chosen name
export default function ExercisePicker({ v, value, onChange, onPick, parts = [], exclude = [], ...rest }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const closing = useRef(null)
  const matches = open ? suggestExercises(v, value, { parts, exclude }) : []
  const exact = matches.length === 1 && matches[0].name.toLowerCase() === value.trim().toLowerCase()
  const show = matches.length > 0 && !exact

  // Bring the box to the top of the screen so the list is not hidden by the keyboard.
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => box.current?.scrollIntoView({ block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [show])
  useEffect(() => () => clearTimeout(closing.current), [])

  const pick = (name) => {
    clearTimeout(closing.current)
    setOpen(false)
    onPick(name)
  }

  return (
    <div className="picker" ref={box}>
      <input
        {...rest}
        value={value}
        autoComplete="off"
        autoCorrect="off"
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        onChange={(e) => {
          setOpen(true)
          onChange(e.target.value)
        }}
        onFocus={() => {
          clearTimeout(closing.current)
          setOpen(true)
        }}
        // A short wait, so a tap on a row lands before the list goes away.
        onBlur={() => (closing.current = setTimeout(() => setOpen(false), 250))}
      />
      {show && (
        <ul className="suggest" role="listbox" aria-label="Matching exercises">
          {matches.map((m) => (
            <li key={m.name} role="option" aria-selected="false">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m.name)}>
                <span>{m.name}</span>
                <small>{m.own ? 'Used before' : m.parts.map(partName).join(', ')}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
