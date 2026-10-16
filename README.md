# FitArena

A fitness challenge app for a small group of friends. Log your workouts, track what you
eat, climb a shared leaderboard, and get encouraged or roasted by an AI coach.

Installs to your phone home screen as a PWA. Runs entirely on free tiers, so hosting costs
nothing.

**Live:** [fitarena-crew.vercel.app](https://fitarena-crew.vercel.app)

---

## What it does

**Arena** is the home screen. Today's status, your streak, where you sit against everyone
else, and quick actions to log a session.

**Grind** is the workout side. Pick from 1,324 exercises or your own custom ones, plan a
session or log as you go, edit each set, and run rest timers between sets and exercises
with a session timer ticking in the background. Past performance shows up next to each
exercise so you know what to beat, and progression charts show how a lift has moved over
time. Every exercise has an info button with photos, target muscle, equipment, and how-to
steps.

**Count** is the nutrition side. Scan a barcode, search Open Food Facts, search the Indian
food database (IFCT 2017), describe a meal in plain words and let AI estimate it, or
photograph a nutrition label and have it read. Save meals you eat often, duplicate them to
make variations, favourite the foods you repeat, and track water alongside calories and
macros.

**Coach** is a Gemini-backed coach that sees your real numbers and reacts to them. Two
moods: Roast or Toast.

**Playbook** is the searchable exercise library.

**Leaderboard** ranks the crew on a permanent score that survives challenge resets.

Plus push notifications for daily check-in and hydration reminders, three themes (dark,
light, and a soft daylight theme called Bloom), and challenges with flexible end dates you
can extend or complete.

---

## How it fits together

```
          ┌──────────────────────────────────────────────┐
          │  React PWA (Vite + Tailwind, HashRouter)     │
          │  Arena · Grind · Count · Coach · Playbook    │
          └──────────┬────────────────────────┬──────────┘
   anon key, RLS     │                        │  stats payload only
                     ▼                        ▼
      ┌──────────────────────────┐   ┌─────────────────────────────┐
      │ Supabase                 │   │ Vercel serverless functions │
      │  • Auth                  │   │  /api/coach.js              │
      │  • Postgres + RLS        │   │  /api/nutrition.js          │
      │  • 21 tables, 38 policies│   │  /api/notify.js  (push)     │
      └──────────────────────────┘   └──────────────┬──────────────┘
                                                     ▼
                                      ┌─────────────────────────────┐
                                      │ AI fallback chain (_ai.js)  │
                                      │  text  → Gemini → Groq →    │
                                      │          OpenRouter         │
                                      │  image → Gemini →           │
                                      │          OpenRouter         │
                                      └─────────────────────────────┘

  Exercise data:  public/exercises.json (1,324 moves, static, ~150KB gzipped)
  Food data:      Open Food Facts API + bundled IFCT 2017 Indian food dataset
  Push cron:      GitHub Actions on a schedule → /api/notify.js
```

### Why there are serverless functions at all

A static site cannot hide an API key. Anything in the browser bundle is readable by anyone
who opens devtools. So the functions exist to hold keys server-side. The browser sends a
compact stats payload and gets an answer back. Everything else runs client-side against
Supabase, protected by Row-Level Security.

### Why the AI chain has three providers

Gemini's free quota is per-project, not per-model. When the key gets rate-limited, every
Gemini model is limited at the same moment, so retrying a different Gemini model does not
help. A second provider on a separate key does.

Groq handles text and is skipped for images, because it retired both of its vision models
during 2026 and the replacements are text-only. OpenRouter goes last because its free tier
is 50 requests a day, which is too thin to lead with but fine as a backstop. It uses
`openrouter/free`, a router that picks a free model and filters for the capabilities the
request needs, image understanding included.

With no fallback keys set, the app behaves exactly as it did before: Gemini only.

### Scoring

| Metric | Drives | Rewards |
|---|---|---|
| Consistency score | Leaderboard rank | Actually training (gym days ÷ weekly goal, capped at 100%) |
| Streak | Don't-break-the-chain flair | Showing up daily. Rest days keep it alive, a missed day breaks it |

The tension is deliberate. You can rest to protect your streak, but resting does not move
your rank. Only real sessions do, so nobody coasts to the top.

The global score is permanent and can be recomputed from history, so starting a new
challenge does not wipe what you earned.

Logic lives in `src/lib/streak.js` and `src/lib/globalScore.js` as pure functions, no
React, so it is easy to test and change.

---

## Running it yourself

### 1. Install

```bash
git clone https://github.com/sohambanarase/fitarena.git
cd fitarena
npm install
```

### 2. Supabase

Create a project at [supabase.com](https://supabase.com), then in the SQL editor run
`supabase/schema.sql` first, then each `supabase/migration_v*.sql` in number order.

### 3. Environment

```bash
cp .env.example .env
```

Fill in your Supabase URL and anon key. See the table below for the rest.

### 4. Run

```bash
npm run dev      # local dev server
npm run build    # production build
npm run data     # regenerate public/exercises.json
```

### 5. Deploy

Import the repo into [Vercel](https://vercel.com). Add the environment variables under
Settings → Environment Variables, then redeploy. Functions only pick up new variables on a
fresh deploy.

For push notifications, add the same values as GitHub Actions secrets so the cron in
`.github/workflows/notify.yml` can call `/api/notify.js`.

---

## Environment variables

Client variables need the `VITE_` prefix and ship inside the browser bundle. That is fine
and by design, see [SECURITY.md](SECURITY.md).

| Variable | Where | Required | What it is |
|---|---|---|---|
| `VITE_SUPABASE_URL` | client | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | yes | Supabase anon key, protected by RLS |
| `VITE_VAPID_PUBLIC_KEY` | client | for push | Public half of the VAPID pair |
| `GEMINI_API_KEY` | server | for AI | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | server | optional | [console.groq.com/keys](https://console.groq.com/keys), text fallback |
| `OPENROUTER_API_KEY` | server | optional | [openrouter.ai/keys](https://openrouter.ai/keys), text and image backstop |
| `SUPABASE_URL` | server | for push | Same URL, used by the admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | server | for push | Admin key. Never expose this one |
| `VAPID_PRIVATE_KEY` | server | for push | Private half of the VAPID pair |
| `VAPID_PUBLIC_KEY` | server | for push | Public half again, server-side |
| `VAPID_SUBJECT` | server | for push | `mailto:you@example.com` |
| `NOTIFY_SECRET` | server | for push | Long random string guarding `/api/notify.js` |
| `REMINDER_HOUR_UTC` | server | optional | Hour to send the daily reminder, default 16 |

Optional model pins: `GEMINI_MODEL`, `GROQ_MODEL`, `GROQ_VISION_MODEL`, `OPENROUTER_MODEL`.
Set `GROQ_VISION_MODEL` only if Groq ships a new multimodal model, which puts it back into
the image chain automatically.

### Checking the AI chain

Open `/api/ai-status` on your deployment. It reports which providers have a key, the
resolved chain, and anything currently rate-limited. It never returns key values.

```json
{ "ok": true,
  "configured": { "gemini": true, "groq": true, "openrouter": true },
  "chain": { "text": ["gemini","groq","openrouter"], "images": ["gemini","openrouter"] },
  "benched": [] }
```

---

## Project layout

```
api/
  _ai.js              Provider chain: Gemini → Groq → OpenRouter
  _gemini.js          Gemini provider, model ranking and discovery
  _openai_compat.js   Adapter so Groq and OpenRouter can stand in for Gemini
  ai-status.js        Diagnostic endpoint
  coach.js            AI coach
  nutrition.js        Meal estimates, label scanning, calorie burn
  notify.js           Push sender, guarded by NOTIFY_SECRET
src/
  screens/            Arena, Grind, Count, Coach, Playbook, Profile, GlobalBoard
  components/         Shared UI
  lib/                Scoring, nutrition, exercises, themes, push
supabase/
  schema.sql          Tables, RLS policies, membership function, join RPC
  migration_v*.sql    Run in number order after schema.sql
public/
  exercises.json      Pre-built trimmed exercise dataset
.github/workflows/
  notify.yml          Push notification cron
```

---

## Notes if you are hacking on it

- **GitHub's web uploader skips `.github/`.** If you upload files through the browser
  rather than git, workflow files will silently not appear. Create them directly on GitHub.
- **A clean Vite build does not mean a working app.** Missing imports and undefined
  components build fine and fail at runtime. Load the built app in a browser and click
  through the screens before shipping.
- **Images are URL strings, never blobs in the database.**
- **Supabase free tier** keeps email templates behind custom SMTP, and the default sender
  only delivers to addresses in your project team. Password sign-in avoids this entirely.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Security

See [SECURITY.md](SECURITY.md).

## Licence

MIT. See [LICENSE](LICENSE).
