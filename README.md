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

## ⚠️ Licensing note on the exercise data
The dataset (`hasaneyldrm/exercises-dataset`, originally ExerciseDB / AscendAPI) is provided
for **educational, non-commercial** use, and the media has contested ownership — which is why
images are loaded from the original CDN at runtime rather than bundled. A private group of
friends is squarely the intended use. **Do not** ship this commercially without sorting out
the media rights first.

---

## Sensible next steps
- **Weight trend chart** on Profile (log a weight per day, sparkline).
- **Photo check-ins** via Supabase Storage (also free-tier).
- **Realtime leaderboard** using Supabase Realtime so ranks update live.
- **Weekly recap**: a scheduled function that posts each Monday's winner.
- **Unit tests** for `streak.js` (the logic is already pure and isolated for exactly this).

To swap to the newer (paid) frontier model, change one line in `api/coach.js`:
`const MODEL = "gemini-3.5-flash";`
