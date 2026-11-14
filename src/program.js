// The 12-week periodized program: three 4-week phases ("books") that run in order,
// transcribed from the "2024 Periodization with Mods" workbook. All three phases use
// the same 38 lifts; only the sets, reps and percentage of one-rep max change.
// The workbook's pre-filled weights are intentionally left out: the app works them
// out from each person's own maxes.

export const BOOKS = [
  {
    id: 1,
    name: 'Hypertrophy',
    weeks: [
      { sets: 4, reps: 15, pct: 0.6 },
      { sets: 3, reps: 16, pct: 0.65 },
      { sets: 2, reps: 18, pct: 0.55 },
      { sets: 4, reps: 12, pct: 0.7 },
    ],
  },
  {
    id: 2,
    name: 'Hypertrophy and Strength',
    weeks: [
      { sets: 5, reps: 8, pct: 0.75 },
      { sets: 6, reps: 6, pct: 0.85 },
      { sets: 5, reps: 7, pct: 0.8 },
      { sets: 5, reps: 6, pct: 0.9 },
    ],
  },
  {
    id: 3,
    name: 'Strength',
    weeks: [
      { sets: 5, reps: 4, pct: 0.85 },
      { sets: 6, reps: 4, pct: 0.9 },
      { sets: 7, reps: 3, pct: 0.95 },
      { sets: 5, reps: 2, pct: 1 },
    ],
  },
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

// Phases 2 and 3 replace the Queenax list with these add-on groups.
export const GROUP_B = [
  'Cable Flies',
  'Bosu Pushups',
  'Skull Crushers',
  'DB Kickbacks',
  'Hyperextension',
  'Cable Pulls',
  'Box Step Up Variations',
  'BB Thrusters',
  'Goblet Squats',
  'Reverse Lunges',
  'Queenax / TRX',
  'Wobble',
  'Inverted Toe Touches',
  'Slide Out/Hold',
  'Oblique Bends',
  'Knee Tucks',
  'Lateral Lunges',
  'Hamstring Curls',
  'Bulgarian Squat',
  'Pistol Squat',
]

export const GROUP_C = [
  'Farmers Carry',
  '20 sec Burpees',
  'Ball Slams',
  'Jump Rope',
  'Battle Ropes',
  'Sled Push',
  'Ball Throw',
  'Shuttle Run',
  '30 Sec Sprint',
  'Plate Press',
  'TB Jump Squats',
]

export const UNLISTED = [
  'Jump Squats',
  'Push Ups',
  'Off Set Push ups',
  'Row Prone/Sup.',
  'Curls',
  'Pull Up',
  'Jump Pull Ups',
  'Swing',
  'Landmine Squat',
  'Landmine Twist',
  'Rope Pull',
  'V-Ups',
  'Mario Jumps',
  'Dips',
]

// The tick lists shown under a program day, by phase.
export const extrasFor = (bookId) =>
  bookId === 1
    ? [{ title: 'Queenax', items: QUEENAX }]
    : [
        { title: 'Group B', items: GROUP_B },
        { title: 'Group C', items: GROUP_C },
        { title: 'Other activities', items: UNLISTED },
      ]

// The program library. One entry for now; the three "books" are its phases.
// Adding a program here is all the app needs to list it.
export const PROGRAMS = [
  {
    id: 'periodization-12',
    name: '12-Week Periodized Plan',
    goal: 'Build muscle first, then turn it into strength.',
    length: '12 weeks',
    frequency: '6 sessions a week',
    level: 'Best with some barbell experience',
    description:
      'Three 4-week phases that move from high reps at lighter weights to low reps at heavy weights. Each week you train six body parts, one per session, on whatever days suit you. Target weights are worked out from your one-rep max for each lift, so they fit you.',
    equipment: ['Barbell and rack', 'Dumbbells', 'Cable machine', 'EZ bar', 'Trap bar', 'Landmine', 'Leg press'],
    needs: 'A one-rep max for each lift. Enter the ones you know; the app estimates the rest from your first session.',
    phaseNotes: {
      1: 'High reps at 55 to 70% to build muscle and work capacity.',
      2: 'Moderate reps at 75 to 90% as the weight climbs.',
      3: 'Low reps at 85 to 100% to peak strength.',
    },
  },
]

export const programById = (id) => PROGRAMS.find((p) => p.id === id) || PROGRAMS[0]
