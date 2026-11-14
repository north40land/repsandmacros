// The 4-week hypertrophy block, transcribed from the paper sheet.
// The sheet's pre-filled weights are intentionally left out.

export const WEEKS = [
  { week: 1, sets: 4, reps: 15, pct: 0.6 },
  { week: 2, sets: 3, reps: 16, pct: 0.65 },
  { week: 3, sets: 2, reps: 18, pct: 0.55 },
  { week: 4, sets: 4, reps: 12, pct: 0.7 },
]

const part = (id, name, names) => ({
  id,
  name,
  exercises: names.map((n, i) => ({ id: `${id}-${i + 1}`, name: n })),
})

export const PARTS = [
  part('chest', 'Chest', [
    'BB Bench Press',
    'BB Incline Bench Press',
    'DB Parallel / Incline Press on Bench',
    'DB Fly on Bench',
    'Cable Fly',
    'Cable Press',
  ]),
  part('back', 'Back', [
    'Upright BB Row',
    'Bent Over BB Row',
    'T-Bar Row',
    'Lateral Pull Down',
    'One Arm DB Row on Bench',
    'Seated Row',
  ]),
  part('shoulders', 'Shoulders', [
    'Overhead DB Press',
    'Trap Bar Shrug',
    'Anterior / Lateral DB Raise',
    'Lying Rear Delt Raise',
    'Landmine Press',
  ]),
  part('legs', 'Legs', [
    'BB Squats',
    'BB Deadlift',
    'Landmine Squat',
    'BB / TB Straight Legged Dead Lift',
    'Trap Bar Deadlift',
    'DB Goblet Squat',
    'Leg Press',
    'DB RDL',
    'Lat. DB Lunges Box/Flat',
  ]),
  part('biceps', 'Biceps / Forearms', [
    'Standing EZ BB Curl',
    'Reverse Grip Standing EZ BB Curl',
    'DB Cons. Curl',
    'Hammer DB Curl',
    'Alternating DB Curl',
    'DB Bi. Lat Curl',
  ]),
  part('triceps', 'Triceps', [
    'BB Skull Crushers',
    'Narrow BB Bench Press',
    'DB Tricep Kickbacks',
    'Straight / EZ Bar Cable Pushdowns',
    'Rope Pushdowns',
    'Single Overhead Cable Ext.',
  ]),
]

export const CARDIO = ['Super Set', 'Queenax HIIT Circuit', 'Lift-Flow', 'Cardio Circuit', 'Other Cardio']

export const QUEENAX = [
  'Off Center Push-Up',
  'Stable Bar Push-Up',
  'SF Push-Up',
  'Skull Crushers',
  'Dips',
  'Landmine Press',
  'Pro-Row',
  'Sup-Row',
  'Pull-Up',
  'Jump Pull-Up',
  'Bi Curls',
  'Matrix Pull',
  'Rev. Lunge',
  'Squat',
  'Landmine Squat',
  'SF Lat. Lunge',
  'Bulg. Squat',
  'Ham Curl',
  'Split Squats',
  'Jump. Squats',
  'Pigeons',
  'F/R Pistols',
  'Mario Jumps',
  'Wobble',
  'Inv. Toe Touch',
  'Slide Out / Hold',
  'Side Bends',
  'Knee Tucks',
  'Landmine Twists',
  '"V" Ups',
  'Sled Push',
  'Ball Slams',
  'KB Swings',
  'Lat. Box Lunge Steps',
  'Rev. Toe Touches',
]
