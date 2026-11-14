# Changelog

## Landing page (2026-11-13)

Checked on a computer against the cloud-mode dev server while signed out, at desktop and phone widths, plus a production build. Phone width was confirmed by measuring the page (no sideways scrolling); it has not been looked at on a real phone.

- A signed-out visitor in a browser now sees a landing page first: what the app tracks, a sample of the weekly dashboard, and how to put it on the home screen. The numbers in the previews are sample data and are labelled that way.
- "Create account" and "Sign in" open the sign-in screen on the matching tab. That screen has a Back link to the landing page.
- The installed app skips the landing page and opens sign-in directly. Signed-in use is unchanged.
- New file `src/Landing.jsx`; its styles are the `.lp` rules at the end of `src/styles.css`.

## Restyle: light Apple-style look (2026-11-13)

Checked on a computer at phone size in local-only mode: Home, Train, a logged workout, Food, Doses, Progress and Settings, plus a production build. Sign-in, add food, barcode, recipes, targets, the calculator, body, photos, the week view, the program library and the confirmation sheet were not looked at; they use the same styles.

- The app is now light: grey page, white cards without outlines, and one blue for everything that can be tapped.
- Bars, trend lines and days that hit target are black. Red is kept for warnings, missed doses, over-target bars and delete actions.
- Section headings are larger and no longer small capitals. Body text is 17px.
- Buttons are pills, set check buttons are round and fill blue when logged, and switches between views look like iPhone segmented controls.
- Each tab in the bottom bar has an icon above its name.
- The browser bar colour and the home screen manifest are light to match. A phone that already has the app on its home screen may show the old dark colour while opening until the app is added again.
- No data, logic or database changes. The landing page is not restyled yet.

## Phase 8: Offline logging and sync (2026-11-13)

Tested on a computer with a production build and its server switched off. Replaying queued changes to the live database after reconnecting was not re-tested here (the test preview was signed out); that path is unchanged from earlier phases, where it was tested.

- The phone's copy of the data moved from localStorage to IndexedDB. Only the rows that changed are written, together with the list of changes waiting to sync. Existing data is carried across automatically the first time the new version opens.
- The app opens with no signal, including after only one previous visit: the offline helper now saves the page and its files as soon as it starts, and falls back to the saved copy if the network does not answer within 4 seconds.
- Changes made offline are queued on the phone and replayed when the connection returns. Rows keep their phone-made ids, so a replay never creates a duplicate; the newest write wins.
- An "Offline" bar appears at the top with the number of changes waiting to sync. If the cloud cannot be reached while online, a bar says so and the app retries every 30 seconds. Settings shows the same status.
- Presets, favourite foods, dose items and everything else already logged are available offline because they are part of the phone's copy.
- Developer note: `npm run preview:local` builds and serves the production app with no cloud connection, which is how offline behaviour is tested.

Still needs a connection: food search, barcode lookup, progress photos, and turning reminders on.

## Phase 7: Weekly dashboard (2026-11-13)

Tested in local-only mode on a computer. Not yet confirmed on a phone.

- The app now opens on a Home screen showing the week (Monday to Sunday), with arrows to look back at earlier weeks.
- At a glance: workouts done (of 6 planned when following a program), volume lifted with an 8-week trend line, average daily calories and protein against target, average sleep against target, and water as a percent of target.
- Dosing: what is still due today and anything missed this week.
- Body trend: current weight with a trend line, change over 7 and 30 days, and the date of the last measurements.
- Lifts: personal records set this week (a best set heavier than anything logged before).
- Nutrition adherence: the seven-day strip; tap a day to open it.
- Quick actions pinned above the tabs: log a workout, food, weight or a dose. Food opens the add screen for the meal that fits the time of day.
- Each card opens the screen behind it. "Export week (CSV)" saves one row per day.
- Tabs are now Home, Train, Food, Doses, Progress. Settings opens from the Home screen.
- No database changes.

Not built: PDF export (the spec lists export as a nice-to-have; CSV is included).

## Phase 6: Water and sleep (2026-11-13)

Tested in local-only mode on a computer. Saving to the live database is untested because the test preview was signed out.

- Water card on the day view: quick-add buttons (8 and 16 oz, or 250 and 500 ml for people who use kilograms), a custom amount, undo for the last entry, and a daily total with a progress bar against the water target.
- Sleep card on the day view: bedtime and wake time with the hours worked out (including across midnight), optional quality from 1 to 5, and a bar against the sleep target. One entry per night, filed under the day the person woke up.
- Water and sleep targets can be changed on the targets page without switching off the calculator; only changing calories or macros by hand does that. A rest day without its own water or sleep target uses the main one.
- Migration: `supabase/migrations/0009_water_sleep.sql` (water_logs, sleep_logs). Applied to the live database on 2026-11-13.

Difference from the spec: `sleep_logs` is keyed by person and night (no separate id), so two phones cannot create two entries for the same night.

## Phase 5: Body metrics and progress photos (2026-11-13)

Body metrics tested in local-only mode on a computer. Photo upload and viewing are untested: they need a signed-in account, and the test preview was signed out.

- Progress tab now has three views: Lifts, Body and Photos.
- Body: log a check-in with date, weight, optional body fat and optional measurements (neck, shoulders, chest, waist, hips, left and right arm, left and right thigh, calves). One check-in per date; saving the same date replaces it.
- Current weight with the change over 7 and 30 days.
- Weight chart with every weigh-in and a 7-day rolling average, and a chart for body fat or any measurement. Range: 4 weeks, 12 weeks, 6 months, all. Touching the chart shows the values for that date.
- Logging a new most-recent weight recalculates calculator targets when automatic targets are on, keeping any overrides.
- Photos: front, side and back per date, shrunk on the phone to 1600 px before upload, stored in a private bucket under the person's own folder. A gallery by date, and a side-by-side compare of any two dates per pose.
- Migration: `supabase/migrations/0008_progress_photos.sql` (progress_photos table, private `progress-photos` bucket with a 10 MB limit, and four storage policies). Applied to the live project on 2026-11-13. `body_metrics` was created earlier in 0005.

Notes: measurements are stored with their unit (inches or centimetres) and converted for display. Photos need a connection; they are not queued offline.

## Dose reminders as phone notifications (2026-11-13)

The server side is tested. The phone side (permission prompt, receiving and tapping a notification) cannot be tested from a computer and is unconfirmed.

- Doses tab has a Reminders card: "Turn on reminders" subscribes this phone, after the phone's own permission prompt. On iPhone this is only offered in the Home Screen app.
- A notification is sent at each item's time of day if it is due and not yet logged. Items with no time are grouped into one reminder at a daily time the person chooses (default 8:00 AM).
- One follow-up nudge two hours later for anything still unlogged; it can be switched off.
- Tapping a notification opens the Doses tab. "Send a test notification" checks the phone is reachable.
- Times use the phone's time zone, refreshed whenever the app opens. Signing out removes the phone's subscription.
- Edge function `supabase/functions/dose-reminders` (actions: key, test, run), deployed with "Verify JWT with legacy secret" off. Web Push is sent with `jsr:@negrel/webpush`.
- Migration `supabase/migrations/0007_reminders.sql`: push_subscriptions, push_config, push_sent, two profile columns, the pg_cron and pg_net extensions, and a schedule that calls the function every 5 minutes. Applied to the live project on 2026-11-13.
- The notification signing keys are generated by the function on first use and stored in `push_config`, which only the service role can read. The schedule authenticates with a secret kept in the same table.

## Phase 4: Scheduled dosing log (2026-11-13)

Tested in local-only mode and with one save-and-delete against the live database, on a computer. Not yet confirmed on a phone.

- New Doses tab. Items have a name, dose amount, unit, days of the week, optional time of day, notes and an active switch.
- "Due today" list with a one-tap Log button that records the scheduled amount and the time. Tap the name to skip, or to enter a different amount or time.
- Missed doses: a scheduled day that ends with nothing logged becomes a "missed" entry the next time the app opens. A red dot shows on the Doses tab and a "Missed yesterday" card appears on the screen.
- History by week: every item against every day, marked taken, missed or skipped. Tap a mark to correct it.
- Pausing an item stops it being due; switching it back on does not count the paused days as missed.
- One-rep maxes moved from their own tab to a "Maxes" link on the "Your program" card, to make room for the Doses tab.
- Migration: `supabase/migrations/0006_dosing.sql` (dose_items, dose_logs). Applied to the live database on 2026-11-13.

Differences from the spec: `dose_logs` is keyed by item and day (no separate id), so two phones cannot create two entries for the same dose, and a database rule stops an automatic "missed" from replacing a real entry. `dose_items` also stores the start date and how far missed doses have been checked.

Not built yet: reminder notifications. On iPhone these need the app on the Home Screen and a push service on the server.

## Phase 3b: Target calculator and weekly adherence (2026-11-13)

Tested in local-only mode on a computer, plus one write to the live database. Not yet confirmed on a phone.

- Target calculator (Food tab, Edit targets, Calculate my targets): sex, date of birth, height, current weight, activity level, goal (cut, maintain, build) with an adjustable daily deficit or surplus.
- Macro split in two modes: protein first (grams per pound, fat as a share of calories, carbs fill the rest; the default) or percentages that must total 100.
- Optional separate split and calorie adjustment for rest days.
- The full chain is shown: BMR by Mifflin-St Jeor, maintenance, target calories, grams. Any final number can be typed over; overrides are kept when targets recalculate.
- Saving records the weight as today's weigh-in and writes dated targets, so past days keep the targets they had. Typing targets in by hand on the manual page turns automatic updates off.
- A caution appears when the calorie target is very low (under 1,200 for women, 1,500 for men).
- Weekly adherence (Food tab, See the week): a Monday to Sunday strip coloured by whether each day was within tolerance, the average percent of target for calories, protein, carbs and fat, days within tolerance, and a day by day table. Tolerances default to 5% of calories and 10 g of protein and can be changed.
- Migration: `supabase/migrations/0005_calculator.sql` (user_profile_metrics, body_metrics). Applied to the live database on 2026-11-13.

Notes: `body_metrics` is the Phase 5 table, created early so the calculator has somewhere to record weight. Targets recalculate when the calculator is saved with a new weight; Phase 5's weigh-in screen will trigger the same recalculation. Beyond the spec, user_profile_metrics also stores the rest-day split, overrides, the automatic flag and the tolerances.

## Camera barcode scanning on iPhone (2026-11-13)

Decoding tested on a computer with generated barcode images. Not tested with a real camera on any device.

- The scan screen now reads barcodes with the camera on every browser. Where the browser has its own Barcode Detection API (Chrome on Android) that is used; everywhere else, including iPhone Safari, a bundled reader (`barcode-detector`, built on zxing) takes over.
- The reader and its 0.9 MB decoder file are served from this site and only download the first time the scan screen is opened.
- If the camera is refused or unavailable, the type-in box still works.

## Phase 3, part 2: Recipes and barcodes (2026-11-13)

Tested in local-only mode and against the live database on a computer. Camera scanning has not been tested on any device.

- Recipes: add ingredients with amounts, say how many servings it makes, and the recipe is saved under "My foods" with per-serving numbers. Recipes can be edited and deleted; days already logged keep their numbers.
- Barcode lookup: "Scan or enter a barcode" on the add-food screen. Open Food Facts is checked first, then USDA branded foods.
- Camera scanning uses the browser's Barcode Detection API where it exists, with a type-in box everywhere else. iPhone Safari does not have that API, so iPhones get the type-in box.
- Migration: `supabase/migrations/0004_recipes.sql` (adds `foods.recipe`). Applied to the live database on 2026-11-13.
- Edge function: `supabase/functions/food-barcode`. Deployed on 2026-11-13, "Verify JWT with legacy secret" off.
- The function identifies the app to Open Food Facts as `RepsAndMacros/1.0 (+https://repsandmacros.com)`, as their terms require.

## Phase 3, part 1: Nutrition log (2026-11-13)

Tested in local-only mode and against the live database on a computer. Not yet confirmed on a phone.

- New Food tab: a day view with breakfast, lunch, dinner and snacks, and arrows to move between days (not into the future).
- Food search from USDA FoodData Central through the `food-search` edge function, whole foods listed before packaged products. Pick a result, enter an amount in servings, grams or ounces, and the numbers fill in. Any number can be edited by hand.
- Create your own foods with per-serving numbers; edit and delete them under "My foods".
- Recent and Favorites lists for fast entry.
- Daily totals for calories, protein, carbs, fat and fiber, with progress bars and the amount left against targets.
- Daily targets (calories, protein, carbs, fat, water, sleep), with optional separate rest-day targets. A day counts as a training day when a workout is logged on it. Each change is dated so past days keep their targets.
- Logged entries store their own numbers, so editing a food later does not rewrite history.
- Migration: `supabase/migrations/0003_nutrition.sql` (foods, food_logs, user_targets, food_cache). Applied to the live database on 2026-11-13.
- Edge function: `supabase/functions/food-search`. Deployed on 2026-11-13 with "Verify JWT with legacy secret" off; the function checks the sign-in itself.
- The USDA key is read from the Supabase secret `USDA_API_KEY`. Until it is set, the function uses USDA's public DEMO_KEY, which allows only a few dozen lookups per hour.

Differences from the spec: `foods.user_id` is never null (public results are cached server-side and copied into a person's own foods on first use), and `user_targets` already carries the Phase 3b history columns.

Still to do in Phase 3: recipes (combine foods into a per-serving food) and barcode scanning with the `food-barcode` function.

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
