# FitArena 🥊

A mobile-first, gamified fitness-challenge app for a small crew of friends running a
2-month body transformation that ends **August 31**. Show up, log it, out-train each
other, get roasted (or toasted) by an AI coach.

Built to cost **$0** to host and run.

---

## The blueprint (how it fits together)

```
                 ┌─────────────────────────────────────────────┐
                 │  Phone-shaped React app (Vite + Tailwind)    │
                 │  4 tabs: Arena · Coach · Playbook · Profile  │
                 └───────────────┬─────────────────┬───────────┘
        anon key (RLS-protected) │                 │ POST stats only
                                 ▼                 ▼
                 ┌───────────────────────┐  ┌───────────────────────────┐
                 │ Supabase               │  │ /api/coach.js (Vercel fn)  │
                 │  • Auth (email/magic)  │  │  • holds GEMINI_API_KEY    │
                 │  • Postgres + RLS      │  │  • builds Roast/Toast prompt│
                 │  • join_challenge RPC  │  │  • calls Gemini 2.5 Flash  │
                 └───────────────────────┘  └────────────┬──────────────┘
                                                          ▼
                                            Google AI Studio · Gemini 2.5 Flash
                                                  (free tier)

        Exercise data: /public/exercises.json (static, 1,324 moves, ~150KB gzipped)
        Thumbnails:    static.exercisedb.dev/media/{mediaId}.gif (lazy-loaded)
```

**Why the tiny serverless function exists.** A pure static site can't hide an API key —
anything in the browser bundle is readable. So the one job of `/api/coach.js` is to keep
`GEMINI_API_KEY` server-side. The browser sends only a compact stats payload; the function
writes the prompt and talks to Gemini. Everything else (auth, data, leaderboard math) runs
client-side against Supabase, protected by Row-Level Security.

### The two-metric scoring model (the fun part)

| Metric | Drives | Rewards | Lives in |
|---|---|---|---|
| **Consistency score** | Leaderboard rank | Actually training (gym days ÷ weekly goal, capped 100%) | `src/lib/streak.js` |
| **Streak** | "Don't break the chain" flair | Showing up daily; **rest days keep it alive**, a missed day breaks it | `src/lib/streak.js` |

The tension is deliberate: you *can* rest to protect your streak, but resting doesn't move
your rank — only real sessions do. So nobody coasts to the top. The logic is pure functions
(no React), so it's trivial to unit-test and tweak.

---

## File map

```
api/coach.js              Vercel serverless fn → Gemini (key never hits the client)
supabase/schema.sql       Tables + RLS + recursion-safe membership fn + join RPC + auto-profile
scripts/build-exercises.mjs  Regenerates the trimmed exercise file (npm run data)
public/exercises.json     Pre-built, English-only, trimmed dataset (ships in the repo)
src/lib/streak.js         Consistency + streak + leaderboard engine (pure, tested)
src/lib/supabase.js       Supabase client
src/lib/exercises.js      Load/filter exercises + thumbnail URL helper
src/context/AuthContext   Session + profile + active challenge
src/components/           BottomNav · CountdownBell · CheckInCard · ContenderCard · Loader
src/screens/              AuthScreen · Arena · Coach · Playbook · Profile
```

---

## Setup (≈15 minutes)

### 1. Supabase (database + auth) — free tier
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query →** paste all of `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
4. (Optional) **Authentication → Providers → Email**: turn off "Confirm email" while testing
   so sign-ups work instantly.

### 2. Gemini key — free tier
- Grab a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### 3. Local env
```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, GEMINI_API_KEY
npm install
npm run dev          # app only (Coach tab needs the function — see note)
```
> The Coach tab calls `/api/coach`, which doesn't run under plain `vite dev`. Either run
> `npx vercel dev` (serves the app **and** the function together), or just test Coach on the
> deployed URL.

### 4. Deploy to Vercel — free (Hobby) tier
1. Push this folder to a GitHub repo.
2. Import it at [vercel.com](https://vercel.com). Framework preset: **Vite**.
3. **Settings → Environment Variables**: add all three from your `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
4. Deploy. Vercel auto-detects `/api/*.js` as serverless functions. Done.

Add the deployed URL to Supabase **Authentication → URL Configuration → Site URL** so magic
links and confirmations redirect correctly.

---

## How friends join (no email service needed → stays $0)
Each challenge has a 6-character invite code. Tap **Invite** on the Arena to share it; a
friend taps **Join with a code** after signing up. The `join_challenge` RPC adds them
without exposing challenges they aren't in yet.

---

## Cost
| Piece | Plan | Cost |
|---|---|---|
| Hosting + serverless fn | Vercel Hobby | $0 |
| Auth + Postgres | Supabase Free | $0 |
| AI insights | Gemini 2.5 Flash free tier | $0 |
| Exercise data + media | Static file + public CDN | $0 |

For 4–5 friends checking in once a day and pulling a coach take now and then, you stay
comfortably inside every free tier.

---

## Exercise data & images
The Playbook uses the **yuhonas/free-exercise-db** dataset (873 exercises), which is released
into the **public domain (the Unlicense)** — free for any use, no attribution required. Images
are stable, hotlink-friendly photos served from GitHub via the jsDelivr CDN, with a
raw.githubusercontent fallback and a lettered placeholder if both miss. No API key, $0.

*(Earlier builds used an ExerciseDB CDN whose free image endpoint is rate-limited and
"exploration only"; that's why animated GIFs stopped loading. This source trades animation for
still photos but is reliable and cleanly licensed.)*

---

## Sensible next steps
- **Weight trend chart** on Profile (log a weight per day, sparkline).
- **Photo check-ins** via Supabase Storage (also free-tier).
- **Realtime leaderboard** using Supabase Realtime so ranks update live.
- **Weekly recap**: a scheduled function that posts each Monday's winner.
- **Unit tests** for `streak.js` (the logic is already pure and isolated for exactly this).

To swap to the newer (paid) frontier model, change one line in `api/coach.js`:
`const MODEL = "gemini-3.5-flash";`

---

## v2 update — what changed

**You only need to run one thing to upgrade your live app:** open Supabase → SQL Editor,
paste all of `supabase/migration_v2.sql`, and Run. It only *adds* columns/tables, so your
existing accounts, challenges, and check-ins are untouched. Then push the new code to GitHub
(Vercel redeploys automatically).

New in v2:
- **Multiple challenges.** Each has its own name, end date, and goal. Tap the challenge name
  at the top of the Arena to switch, create, or join another. You only ever see challenges
  you're a member of. *(This also fixes "friends don't show up" — everyone just joins the
  same challenge with one shared code instead of each starting their own.)*
- **Submit button on the daily check-in.** Pick one option, hit Submit — it saves and stays
  put after a refresh.
- **Wins feed (brags + PRs).** Post a quick brag (text + optional photo) or a personal record
  (exercise + weight/reps). Friends in the challenge see them in the Arena feed. Your PR bests
  show on your Profile.
- **Light-touch scoring.** Rank = consistency (0–100) + a capped bonus (+3 per PR, +1 per brag,
  max +15 a week). Training still wins; wins just give a nudge.
- **Multi-select goals** on the Profile.
- **Quota-safe Coach.** It no longer fires on every tab open — it caches the day's take and
  only calls when you tap the button. If Google's free tier is cooling down, you get a friendly
  "catching his breath" message with a countdown instead of a red error.

### About the photo uploads (optional)
The migration auto-creates a public `wins` storage bucket with the right permissions, so brag
photos work out of the box. Text-only brags work regardless — if a photo ever fails to upload,
the brag still posts.

### About the Coach "quota exceeded" error you saw
That was the **free Gemini tier's rate limit**, not a bug and not a charge — it resets on its
own. v2's caching + on-demand calls keep usage tiny for a small group. If you ever outgrow the
free tier, switch one line in `api/coach.js` to a paid model.

---

## v3 update

**One database step:** run `supabase/migration_v3.sql` in the SQL Editor (additive, safe).
Then push the code and let Vercel redeploy.

- **Installable app (PWA).** Manifest, icons, offline support. On Android: Chrome → ⋮ → Add to
  home screen (or use pwabuilder.com to export an actual .apk). iOS: Share → Add to Home Screen.
- **New "Grind" tab.** Private personal-goal trackers with progress bars, plus a fast set-by-set
  workout log grouped by day. Separate from the challenge — your own training camp.
- **Per-challenge feeds.** Wins now belong to the challenge you posted them in, so each feed is
  exclusive. (Old wins posted before v3 won't appear in a specific feed — just repost if needed.)
- **Fixes:** duplicate challenges in the switcher (query now filters to your own memberships);
  the AI Coach cutting off after 1–2 words (Gemini 2.5 Flash's "thinking" was eating the token
  budget — now disabled for these one-liners); iPhone header dropdown now a centered, tappable
  glass pill that clears the notch (safe-area insets); Playbook filters now cascade so you never
  hit an empty combination.
- **Sleeker UI.** Liquid-glass surfaces (translucent, blurred) on the nav, sheets, header, and
  stat strips.

---

## v4 update

**Database step:** run `supabase/migration_v4.sql` (additive, safe). Then push the code.

- **Keep-alive (no more Supabase pauses).** A GitHub Action (`.github/workflows/keepalive.yml`)
  pings the database once a day so the project never sleeps. One-time setup: in your GitHub repo,
  **Settings → Secrets and variables → Actions**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
  Free, runs forever.
- **Smarter goals.** "Add goal → Track a lift" lets you search an exercise (e.g. Bench Press) and
  set a target weight. It then **auto-tracks**: log that lift in your workout and the goal fills in;
  hit the target and it flips to "Smashed." A "Custom" tab still covers non-lift goals (e.g. lose 3kg).
- **Redesigned workout log.** Tap **Log workout** → pick a body-part tile (Chest, Back, Shoulders,
  Biceps, Triceps, Legs) or search any exercise → choose set count → enter each set's weight/reps
  one at a time (each set locks as you go). Each exercise shows as a single row; tap it for the
  full set-by-set breakdown.
- **Date navigation.** Arrows for previous/next day, or tap the date to open a calendar and jump to
  any day to review (or backfill) that day's workout.

### Assumptions baked in (easy to change)
- Exercise goals track your **best logged weight** and complete at the target.
- Each set stores **weight + optional reps**.
- Logging the same exercise twice in one day **merges** into one row.

---

## Running it locally in VS Code

You only need this if you want to make changes yourself. If you just use the deployed site, skip it.

1. **Install Node.js** (the LTS version) from nodejs.org — this gives you `npm`.
2. **Open the project** in VS Code: File → Open Folder → the unzipped `fitarena` folder.
3. **Open a terminal** in VS Code (Terminal → New Terminal) and run:
   ```bash
   npm install        # one time — downloads dependencies
   cp .env.example .env   # then paste your 3 keys into .env
   npm run dev        # starts the app at http://localhost:5173
   ```
4. Edit files under `src/` — the browser auto-refreshes on save.
5. **One caveat:** `npm run dev` doesn't run the `/api/coach` function, so the AI Coach tab won't
   work locally. Either test the Coach on the deployed site, or run `npx vercel dev` instead of
   `npm run dev` (that serves the app + the function together).

To ship a change: save your files, upload the changed files to GitHub (or use VS Code's Source
Control panel if you set up git), and Vercel redeploys automatically.

---

## v5 update

**Database step:** run `supabase/migration_v5.sql` (additive, safe). Then push the code.

- **Exercise search inside the log** — after picking a body-part category, a search bar at the top
  filters that list instantly. The main log screen also still has a "search any exercise" box.
- **Exercise thumbnails** — a compact image sits next to each exercise name in the pickers, log
  rows, planner, and goal search, without changing the row size.
- **Workout Planner** — a second tab inside Grind. Build reusable templates ("Push Day", "Leg
  Day") with exercises, sets, reps, and target weights. Edit, duplicate, or delete them, and hit
  **Start** to review/tweak today's weights and log the whole session in one go.

---

## v6 update — Light theme

**No database step** — this is frontend only. Just push the code.

- **Theme toggle** in Profile → Appearance (Dark / Light). Your choice is saved and reloads
  automatically next visit (applied before first paint, so no flash).
- **Light theme** is its own designed experience, not an inversion: soft off-white canvas, clean
  white frosted cards with gentle shadows, spacing over heavy borders, and a **tri-accent** system —
  indigo (primary actions, key stats), emerald (progress, wins), coral (energy, alerts). Smooth
  cross-fade when you switch.
- Under the hood, colours are now CSS variables, so both themes share one codebase and every
  component adapts automatically.

---

## v6 update — Crew members + richer light theme

**Database step:** run `supabase/migration_v6.sql` (adds a creator-only remove function).

- **Crew members view.** The "Crew" stat now shows the real number of *people* in the challenge
  (it used to show total sessions, which was confusing). Tap it to see everyone; the challenge
  **creator** gets a Remove button next to each other member.
- **Fixed** literal `\uXXXX` text that was showing in a few labels (e.g. "Standings · resets Monday").
- **Richer light theme.** Gradient-graded accents (indigo→violet primary, emerald→teal for
  progress/wins, coral→pink for alerts) instead of flat fills, a multi-colour washed canvas, and a
  more genuine frosted liquid-glass treatment on cards, nav, and stats. Dark theme got the same
  subtle sheen. Both were rendered and checked in a real browser.

---

## v7 update — Push notifications

Real notifications for the installed (home-screen) PWA: a daily check-in reminder plus nudges
when someone posts a win, joins, or passes you on the leaderboard. All $0.

**Setup (one time):**

1. **Database:** run `supabase/migration_v7.sql`.
2. **Vercel env vars** (Settings → Environment Variables):
   - `VITE_VAPID_PUBLIC_KEY` — the public key in `.env.example`
   - `VAPID_PUBLIC_KEY` — same public key
   - `VAPID_PRIVATE_KEY` — your private key (kept out of git)
   - `VAPID_SUBJECT` — `mailto:you@example.com`
   - `SUPABASE_URL` — your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → service_role key (server-only!)
   - `NOTIFY_SECRET` — any long random string
   - `REMINDER_HOUR_UTC` — optional, defaults to 16 (~18:00 Berlin in summer)
3. **GitHub repo secrets** (for the scheduler in `.github/workflows/notify.yml`):
   - `NOTIFY_URL` — `https://YOUR-APP.vercel.app/api/notify`
   - `NOTIFY_SECRET` — the same string as in Vercel
4. Push the code. In the app: Profile → **Notifications → Enable**. On iPhone you must open the
   app from the home-screen icon first (Apple's rule).

**How it works:** enabling saves a push subscription to Supabase. A GitHub Action pings
`/api/notify` every ~20 min; that function (using the service-role key) checks for new wins, joins,
and leaderboard overtakes since last run, sends a daily reminder at the set hour, and delivers via
the free web-push service. Dead subscriptions are cleaned up automatically.

**iPhone caveats:** works on iOS 16.4+, home-screen install only, and delivery is reliable-enough
for reminders but not instant/guaranteed like a native app.

---

## How scores are calculated

Each person's leaderboard score has two parts:

**1. Consistency (0–100) — the base of your rank.**
Gym days this week ÷ your weekly goal, capped at 100. A "gym day" is any day you logged as
**Lifted** or **Cardio** (Rest, Skip, and Missed don't count as gym days). The week runs
Monday–Sunday. Example: goal of 4, trained 3 days → 75. Train 4+ → 100.

**2. Bonus (max +15) — a light topping.**
Wins you post this week add points: a **PR** is +3, a regular **brag** is +1. The whole bonus is
capped at +15 — deliberately small, so nobody can brag their way past people who actually show up.

**Total = Consistency + Bonus.** That total sorts the leaderboard.

**Streak** is separate — it's the flair number (and a tiebreaker), not added to your total.
It counts consecutive days of activity: **Lifted, Cardio, or Rest keep it alive; a missed day
breaks it.** So a rest day won't cost you your streak, but skipping will.

**Ties** are broken in this order: total score → raw consistency ratio → longer streak → name.

Everything resets each Monday, so the race restarts weekly.
