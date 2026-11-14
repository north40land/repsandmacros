import { BOOKS } from './program'

const summary = (book) =>
  book.weeks.map((w, i) => `Week ${i + 1}: ${w.sets} × ${w.reps} at ${Math.round(w.pct * 100)}%`)

// The phases of a program as tappable cards. `current` is the phase running now,
// `suggested` the next one in the plan, `selected` the one picked on this screen.
export default function PhasePicker({ current, suggested, selected, notes, onPick }) {
  return (
    <div className="programs">
      {BOOKS.map((book) => (
        <button
          type="button"
          key={book.id}
          className={selected === book.id ? 'program picked' : 'program'}
          aria-pressed={selected === book.id}
          onClick={() => onPick(book.id)}
        >
          <span className="programhead">
            <strong>
              Phase {book.id}: {book.name}
            </strong>
            {current === book.id && <em>Current</em>}
            {current !== book.id && suggested === book.id && <em>Next in plan</em>}
          </span>
          {notes?.[book.id] && <span className="phasenote">{notes[book.id]}</span>}
          {summary(book).map((line) => (
            <small key={line}>{line}</small>
          ))}
        </button>
      ))}
    </div>
  )
}
