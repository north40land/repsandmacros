# Changelog

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
