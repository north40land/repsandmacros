// The public page a signed-out visitor sees in a browser. The installed app skips it and opens sign-in.
// Every figure in the previews is sample data and is labelled as such on the page.

const FEATURES = [
  {
    title: 'Train',
    icon: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
    text: "Run the programmed block or type in your own workout and save it as a preset. Last session's numbers sit next to today's set.",
  },
  {
    title: 'Fuel',
    icon: 'M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 2c-2 2-3 5-3 8h3v12',
    text: 'Search a food or scan a barcode and the calories, protein, carbs and fat fill in. Daily targets are calculated from your own numbers.',
  },
  {
    title: 'Body',
    icon: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
    text: 'Weight with a 7-day average, tape measurements and progress photos you can compare side by side.',
  },
  {
    title: 'Schedule',
    icon: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18M9 16l2 2 4-4',
    text: 'Anything you take on set days shows up as due today. One tap logs the amount and the time, and a missed day is flagged.',
  },
  {
    title: 'Sleep and water',
    icon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    text: 'Two quick daily entries that feed the weekly picture, each measured against your own target.',
  },
  {
    title: 'Works offline',
    icon: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
    text: 'Log in the gym with no signal. Entries are saved on the phone and sync when you are back online.',
  },
]

// Sample week for the adherence preview: percent of the calorie target, or null for a day not yet logged.
const WEEK = [
  ['Mon', 98, true],
  ['Tue', 103, true],
  ['Wed', 84, false],
  ['Thu', 101, true],
  ['Fri', 96, true],
  ['Sat', null],
  ['Sun', null],
]

const STEPS = [
  ['Open this site on your phone', "Use the phone's own browser and sign in to your account."],
  ['Add to Home Screen', 'It is in the Share menu on iPhone and the browser menu on Android.'],
  ['Launch it like any app', 'It opens full screen, straight to your dashboard.'],
]

const mark = (hit) => (hit == null ? undefined : hit ? 'on' : 'off')

export default function Landing({ onStart }) {
  const actions = (
    <div className="lp-actions">
      <button className="lp-cta" onClick={() => onStart('up')}>
        Create account
      </button>
      <button className="lp-textlink" onClick={() => onStart('in')}>
        Sign in ›
      </button>
    </div>
  )

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap">
          <span className="lp-brand">Workout</span>
          <nav className="lp-links" aria-label="Site">
            <a href="#tracks">What it tracks</a>
            <a href="#install">Install</a>
            <button onClick={() => onStart('in')}>Sign in</button>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-band lp-grey">
          <div className="lp-wrap lp-center">
            <p className="lp-kicker">Private training log</p>
            <h1 className="lp-hero">Every rep, meal and weigh-in. One screen.</h1>
            <p className="lp-lead">
              Lifting, food, body metrics and your weekly schedule in one place. Each person signs in to their own
              account and sees their own week.
            </p>
            {actions}
            <ul className="lp-points">
              <li>One account per person</li>
              <li>Logs without signal</li>
              <li>Installs to your home screen</li>
            </ul>

            <div className="lp-preview">
              <div className="lp-preview-head">
                <strong>This week</strong>
                <span className="lp-note">Week 1 of 4 · Sample data</span>
              </div>
              <div className="lp-stats">
                <div>
                  <span>Workouts</span>
                  <strong>
                    3 <em>of 5</em>
                  </strong>
                </div>
                <div>
                  <span>Avg protein</span>
                  <strong>
                    182 <em>g</em>
                  </strong>
                </div>
                <div>
                  <span>Avg sleep</span>
                  <strong>
                    7.1 <em>h</em>
                  </strong>
                </div>
                <div>
                  <span>Weight, 7 days</span>
                  <strong>
                    1.2 <em>lb down</em>
                  </strong>
                </div>
              </div>
              <div className="lp-preview-foot">
                <div className="lp-due">
                  <div>
                    <span className="lp-note">Due today</span>
                    <br />
                    <strong>1 scheduled item</strong>
                  </div>
                  <span className="lp-pill">Log</span>
                </div>
                <div>
                  <span className="lp-note">Nutrition, last 7 days</span>
                  <div
                    className="lp-dots"
                    role="img"
                    aria-label="Five days logged: four within tolerance, one outside, two still open"
                  >
                    {WEEK.map(([day, , hit]) => (
                      <i key={day} className={mark(hit)} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-band lp-dark" id="tracks">
          <div className="lp-wrap">
            <div className="lp-head">
              <p className="lp-kicker">What it tracks</p>
              <h2 className="lp-title">Built for a real prep, not a step count.</h2>
            </div>
            <ul className="lp-cards">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-band">
          <div className="lp-wrap lp-split">
            <div className="lp-copy">
              <p className="lp-kicker">Weekly dashboard</p>
              <h2 className="lp-title">Open the app, see the week.</h2>
              <p>
                The dashboard is the first thing you see every time. Workouts done against the plan, how close each day
                landed to your calorie and macro targets, what is due today and where your weight is heading.
              </p>
              <ul className="lp-rules">
                <li>Each day is judged against the target that applied that day</li>
                <li>Targets recalculate when a new weigh-in lands</li>
                <li>Scroll back through past weeks</li>
              </ul>
            </div>
            <div className="lp-chart">
              <div className="lp-chart-head">
                <h3>Nutrition adherence</h3>
                <span className="lp-note">Sample data</span>
              </div>
              <div className="lp-week">
                {WEEK.map(([day, pct, hit]) => (
                  <div key={day}>
                    <i className={mark(hit)} />
                    <span>{day}</span>
                    {pct == null ? <span>Open</span> : <b>{pct}%</b>}
                  </div>
                ))}
              </div>
              <div className="lp-key">
                <span>
                  <i />
                  Within tolerance
                </span>
                <span>
                  <i className="off" />
                  Outside tolerance
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-band lp-grey" id="install">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2 className="lp-title">Put it on your home screen.</h2>
            </div>
            <ol className="lp-steps">
              {STEPS.map(([title, text], i) => (
                <li key={title}>
                  <span aria-hidden="true">{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-band lp-black">
          <div className="lp-wrap lp-center">
            <h2 className="lp-hero">Log today's session.</h2>
            <p className="lp-lead">Each person signs in to their own account.</p>
            {actions}
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap">
          Calorie and macro targets are general estimates, not medical, nutrition or coaching advice.
        </div>
      </footer>
    </div>
  )
}
