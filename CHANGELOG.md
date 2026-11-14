# Changelog

## Phase 2: Progressive overload display (2026-11-13)

Tested in local-only mode on a computer. Not yet confirmed on a phone.

- While logging, each set shows the same set from the last session in grey above the input row ("Last time 100 × 10"). Works for presets, program days and free-form exercises with the same name.
- A logged set is highlighted when it beats last time: heavier weight, or the same weight for more reps. A set heavier than anything logged before is marked "personal best".
- Progress tab, per lift: history table (date, best set, total volume) and personal records (heaviest set, highest volume session, most reps at each weight).
- Sets logged in kg and lb are converted to the person's default unit before comparing.
- No database changes.
- Developer note: `npm run dev:local` runs the app with no cloud connection, for testing without touching real accounts.

## Optional programs and program library (2026-11-13)

- Following a program is now optional. Without one, the home screen leads with "Log a workout" and a "Follow a program" card.
- New program library: a card per program, opening a detail page (what it does, what you need, phases, exercises) with "Start this program".
- The three books are now the three phases of one program, "12-Week Periodized Plan". You can start at any phase, switch phase, or stop following it; history is kept.
- Home shows a "Your program" card with phase, week and sessions done this week.
- Sign-up asks "Follow a program" or "Log my own workouts" in place of forcing a program.
- Confirmation prompts are now drawn by the app; the browser's own pop-up was silently blocked in some browsers.
- Migration: `supabase/migrations/0002_optional_program.sql` (adds `profiles.program_id`). Applied to the live database on 2026-11-13.

## Program picker (2026-11-13)

- New accounts choose which program to start with (Hypertrophy, Hypertrophy and Strength, or Strength).
- "Change program" on the home screen switches at any time; the chosen program starts at week 1 and earlier history is kept.
- When a program's four weeks are done, the home screen offers all three programs, with the next one in the plan marked.
- Replaces the phase selector that was in Settings.

## Program: Books 2 and 3 (2026-11-13)

- The program is now the full 12-week plan from the "2024 Periodization with Mods" workbook: Hypertrophy, then Hypertrophy and Strength, then Strength. Four weeks each, same 38 lifts.
- Phase 2: 5x8 at 75%, 6x6 at 85%, 5x7 at 80%, 5x6 at 90%. Phase 3: 5x4 at 85%, 6x4 at 90%, 7x3 at 95%, 5x2 at 100%.
- Phases advance on their own after four weeks; Settings has a manual phase switch.
- Phases 2 and 3 show the workbook's Group B, Group C and other activities lists in place of Queenax.
- Target weights now round up to the next 5 lb, matching the workbook (previously nearest 5 lb).

## Unreleased: Foundation and Phase 1 (2026-11-13)

Built and checked on a computer in a phone-sized preview. Not yet deployed, and cloud sync has not been run against a real Supabase project.

### Foundation (needed before the spec's phases could start)

- Replaced the shared household sync with per-user accounts: email and password sign-in through Supabase Auth.
- Data moved from one document per person to relational tables with Row Level Security, so each person can read and write only their own rows.
- New local-first data layer: every change saves on the phone first and queues for the cloud, keyed by client-made ids so replays never duplicate. Soft deletes, newest write wins.
- Removed the "view your partner's log" switch, because the spec rules out shared household data.
- Without Supabase settings the app still runs in "this phone only" mode, and that data moves to the first account that signs in.

### Kept from the first build

- 4-week hypertrophy block: pick a body part, the date is stamped, weeks advance after all six parts.
- One-rep maxes and automatic weekly target weights, with estimates for lifts that have no max.
- Rest timer, Cardio and Queenax ticks, per-lift history and chart.

### Phase 1: Free-form workouts and saved presets

- New workout screen: name, date (not in the future), optional body parts.
- Add exercises freehand. Each set has weight, reps, optional RPE 1 to 10, unit (lb or kg) and notes.
- Add set, duplicate last set, remove set, remove exercise.
- "Save as preset" on finish. Presets appear under "My workouts" and can be started, edited and deleted by their owner.
- Default weight unit per person in Settings.

### Notes

- Weight may be 0 for bodyweight exercises (the spec says positive; reps must still be 1 or more).
- Migration: `supabase/migrations/0001_accounts_and_phase1.sql`.
