// The built-in exercise list, used for the type-to-search picker when adding an exercise.
// It ships with the app (no network needed, so it works offline in the gym) and is
// merged with the names each person has already used. Typing a name that is not here
// still works: the list is a shortcut, not a restriction.
//
// Keys are the body part ids from BODY_PARTS in logic.js. An exercise may appear under
// more than one body part.

const LIST = {
  chest: [
    'Barbell Bench Press',
    'Incline Barbell Bench Press',
    'Decline Barbell Bench Press',
    'Dumbbell Bench Press',
    'Incline Dumbbell Press',
    'Decline Dumbbell Press',
    'Dumbbell Fly',
    'Incline Dumbbell Fly',
    'Cable Fly',
    'Low to High Cable Fly',
    'High to Low Cable Fly',
    'Cable Chest Press',
    'Machine Chest Press',
    'Incline Machine Press',
    'Pec Deck Fly',
    'Smith Machine Bench Press',
    'Incline Smith Machine Press',
    'Push Up',
    'Incline Push Up',
    'Decline Push Up',
    'Chest Dip',
    'Dumbbell Pullover',
    'Landmine Press',
    'Floor Press',
    'Svend Press',
  ],
  back: [
    'Pull Up',
    'Chin Up',
    'Assisted Pull Up',
    'Lat Pulldown',
    'Close Grip Lat Pulldown',
    'Reverse Grip Lat Pulldown',
    'Straight Arm Pulldown',
    'Bent Over Barbell Row',
    'Pendlay Row',
    'T-Bar Row',
    'One Arm Dumbbell Row',
    'Chest Supported Dumbbell Row',
    'Seated Cable Row',
    'Single Arm Cable Row',
    'Machine Row',
    'Inverted Row',
    'Landmine Row',
    'Meadows Row',
    'Barbell Deadlift',
    'Rack Pull',
    'Back Extension',
    'Good Morning',
    'Barbell Shrug',
    'Dumbbell Shrug',
    'Trap Bar Shrug',
    'Face Pull',
    'Renegade Row',
  ],
  shoulders: [
    'Barbell Overhead Press',
    'Seated Dumbbell Shoulder Press',
    'Standing Dumbbell Shoulder Press',
    'Arnold Press',
    'Machine Shoulder Press',
    'Smith Machine Shoulder Press',
    'Push Press',
    'Landmine Press',
    'Dumbbell Lateral Raise',
    'Cable Lateral Raise',
    'Machine Lateral Raise',
    'Dumbbell Front Raise',
    'Plate Front Raise',
    'Cable Front Raise',
    'Rear Delt Dumbbell Fly',
    'Reverse Pec Deck Fly',
    'Cable Rear Delt Fly',
    'Face Pull',
    'Upright Row',
    'Barbell Shrug',
    'Dumbbell Shrug',
    'Pike Push Up',
    'Handstand Push Up',
  ],
  biceps: [
    'Barbell Curl',
    'EZ Bar Curl',
    'Reverse EZ Bar Curl',
    'Dumbbell Curl',
    'Alternating Dumbbell Curl',
    'Hammer Curl',
    'Cross Body Hammer Curl',
    'Incline Dumbbell Curl',
    'Concentration Curl',
    'Preacher Curl',
    'Machine Preacher Curl',
    'Spider Curl',
    'Cable Curl',
    'Rope Hammer Curl',
    'Bayesian Cable Curl',
    'Zottman Curl',
    'Drag Curl',
    '21s',
    'Chin Up',
    'Wrist Curl',
    'Reverse Wrist Curl',
    'Farmers Carry',
  ],
  triceps: [
    'Close Grip Bench Press',
    'Skull Crusher',
    'Dumbbell Skull Crusher',
    'Rope Pushdown',
    'Straight Bar Pushdown',
    'EZ Bar Pushdown',
    'Single Arm Cable Pushdown',
    'Overhead Rope Extension',
    'Overhead Dumbbell Extension',
    'Single Arm Overhead Dumbbell Extension',
    'Single Arm Overhead Cable Extension',
    'Dumbbell Kickback',
    'Cable Kickback (Triceps)',
    'Triceps Dip',
    'Bench Dip',
    'Machine Dip',
    'Diamond Push Up',
    'JM Press',
    'Tate Press',
  ],
  legs: [
    'Barbell Back Squat',
    'Barbell Front Squat',
    'Goblet Squat',
    'Smith Machine Squat',
    'Hack Squat',
    'Leg Press',
    'Single Leg Press',
    'Bulgarian Split Squat',
    'Split Squat',
    'Walking Lunge',
    'Reverse Lunge',
    'Forward Lunge',
    'Lateral Lunge',
    'Step Up',
    'Box Jump',
    'Jump Squat',
    'Pistol Squat',
    'Sissy Squat',
    'Landmine Squat',
    'Leg Extension',
    'Lying Leg Curl',
    'Seated Leg Curl',
    'Nordic Hamstring Curl',
    'Barbell Deadlift',
    'Sumo Deadlift',
    'Trap Bar Deadlift',
    'Romanian Deadlift',
    'Dumbbell Romanian Deadlift',
    'Single Leg Romanian Deadlift',
    'Stiff Leg Deadlift',
    'Good Morning',
    'Standing Calf Raise',
    'Seated Calf Raise',
    'Leg Press Calf Raise',
    'Single Leg Calf Raise',
    'Hip Adduction Machine',
    'Hip Abduction Machine',
    'Wall Sit',
    'Sled Push',
  ],
  glutes: [
    'Barbell Hip Thrust',
    'Dumbbell Hip Thrust',
    'Machine Hip Thrust',
    'Single Leg Hip Thrust',
    'Glute Bridge',
    'Single Leg Glute Bridge',
    'Cable Kickback (Glutes)',
    'Machine Glute Kickback',
    'Cable Pull Through',
    'Romanian Deadlift',
    'Sumo Deadlift',
    'Bulgarian Split Squat',
    'Reverse Lunge',
    'Curtsy Lunge',
    'Step Up',
    'Hip Abduction Machine',
    'Banded Lateral Walk',
    'Clamshell',
    'Donkey Kick',
    'Fire Hydrant',
    'Frog Pump',
    'Kettlebell Swing',
    'Back Extension',
    'Sumo Squat',
  ],
  core: [
    'Plank',
    'Side Plank',
    'Crunch',
    'Bicycle Crunch',
    'Reverse Crunch',
    'Cable Crunch',
    'Machine Crunch',
    'Sit Up',
    'Decline Sit Up',
    'V-Up',
    'Hanging Leg Raise',
    'Hanging Knee Raise',
    'Lying Leg Raise',
    'Captain\'s Chair Leg Raise',
    'Toes to Bar',
    'Russian Twist',
    'Cable Woodchopper',
    'Pallof Press',
    'Landmine Twist',
    'Ab Wheel Rollout',
    'Stability Ball Rollout',
    'Stability Ball Knee Tuck',
    'Mountain Climber',
    'Dead Bug',
    'Bird Dog',
    'Hollow Hold',
    'Flutter Kick',
    'Oblique Side Bend',
    'Farmers Carry',
    'Suitcase Carry',
  ],
  cardio: [
    'Treadmill Run',
    'Treadmill Incline Walk',
    'Outdoor Run',
    'Walk',
    'Stationary Bike',
    'Spin Bike',
    'Assault Bike',
    'Rowing Machine',
    'Elliptical',
    'Stair Climber',
    'Ski Erg',
    'Jump Rope',
    'Sprint',
    'Shuttle Run',
    'Battle Ropes',
    'Sled Push',
    'Sled Pull',
    'Swimming',
    'Hike',
    'Burpee',
    'Jumping Jack',
    'High Knees',
  ],
  'full body': [
    'Burpee',
    'Kettlebell Swing',
    'Thruster',
    'Clean and Press',
    'Power Clean',
    'Hang Clean',
    'Clean and Jerk',
    'Snatch',
    'Dumbbell Snatch',
    'Turkish Get Up',
    'Man Maker',
    'Devil Press',
    'Wall Ball',
    'Ball Slam',
    'Farmers Carry',
    'Sled Push',
    'Bear Crawl',
    'Battle Ropes',
    'Barbell Deadlift',
    'Trap Bar Deadlift',
    'Renegade Row',
  ],
}

// One entry per exercise, with every body part it is listed under.
export const EXERCISES = (() => {
  const byName = new Map()
  for (const [part, names] of Object.entries(LIST)) {
    for (const name of names) {
      const entry = byName.get(name) || { name, parts: [] }
      entry.parts.push(part)
      byName.set(name, entry)
    }
  }
  return [...byName.values()]
})()

// Gym shorthand people type, and the full words the list uses.
const SHORT = {
  bb: 'barbell',
  db: 'dumbbell',
  kb: 'kettlebell',
  tb: 'trap bar',
  rdl: 'romanian deadlift',
  ohp: 'overhead press',
  sldl: 'stiff leg deadlift',
  bw: 'bodyweight',
  pullup: 'pull up',
  pullups: 'pull up',
  pushup: 'push up',
  pushups: 'push up',
  chinup: 'chin up',
  situp: 'sit up',
  situps: 'sit up',
}

const words = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .flatMap((w) => (SHORT[w] || w).split(' '))

const key = (name) => name.trim().toLowerCase()

// The exercise names this person has used, most recent first, with the body parts of
// the workouts they were used in. These come ahead of the built-in list.
export function usedExercises(v) {
  const seen = new Map()
  const add = (name, parts) => {
    const k = key(name || '')
    if (!k) return
    if (!seen.has(k)) seen.set(k, { name: name.trim(), parts: [...(parts || [])], own: true })
  }
  for (const w of v.workouts) for (const ex of v.exercises[w.id] || []) add(ex.name, w.body_parts)
  for (const p of v.presets) for (const ex of p.exercises || []) add(ex.name, p.body_parts)
  return [...seen.values()]
}

// Matches for what has been typed so far. Every typed word has to start a word in the
// name, in any order, so "inc db" finds "Incline Dumbbell Press".
//   parts:   body parts of the workout; matches in them come first
//   exclude: names already in the workout
// With nothing typed, it lists the exercises for the workout's body parts.
export function suggestExercises(v, query, { parts = [], exclude = [], limit = 8 } = {}) {
  const typed = words(query)
  const skip = new Set(exclude.map(key))
  const own = usedExercises(v)
  const ownKeys = new Set(own.map((o) => key(o.name)))
  const pool = [...own, ...EXERCISES.filter((e) => !ownKeys.has(key(e.name)))].filter((e) => !skip.has(key(e.name)))
  const inParts = (e) => e.parts.some((p) => parts.includes(p))

  if (!typed.length) {
    if (!parts.length) return own.filter((e) => !skip.has(key(e.name))).slice(0, limit)
    return pool.filter(inParts)
  }

  const scored = []
  pool.forEach((e, i) => {
    const nameWords = words(e.name)
    if (!typed.every((t) => nameWords.some((nw) => nw.startsWith(t)))) return
    // Lower is better: this workout's body parts, then names that start with what was
    // typed, then names used before, then the order of the list.
    const starts = nameWords.join(' ').startsWith(typed.join(' ')) ? 0 : 1
    scored.push([(inParts(e) ? 0 : 4) + starts * 2 + (e.own ? 0 : 1), i, e])
  })
  return scored
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .slice(0, limit)
    .map((s) => s[2])
}
