# Security

## Why the Supabase anon key is in the code

It is meant to be. The anon key ships inside the browser bundle of every Supabase web app,
so anyone can read it with devtools on any deployed site. It identifies the project, it
does not grant access.

What actually protects the data is Row-Level Security. Every table has RLS enabled and
policies that scope rows to the signed-in user or their challenge group. A stranger with
the anon key and no session can read nothing.

The same goes for `VITE_VAPID_PUBLIC_KEY`. Public is the point.

## Keys that must never be public

These live in Vercel environment variables and GitHub Actions secrets. They are never
committed, and `.env` is gitignored.

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely
- `VAPID_PRIVATE_KEY` signs push messages
- `NOTIFY_SECRET` guards the push endpoint
- `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`

If one of these is ever exposed, rotate it. Rotating takes a minute. Scrubbing git history
is slow and unreliable, and anything already pushed should be considered compromised.

## Endpoints that use the service role

Two functions use the admin client, and both are guarded:

- `/api/notify.js` requires `NOTIFY_SECRET` and returns 401 without it
- `/api/test-push.js` checks the request against a hardcoded owner email

## Forking this

If you fork and deploy your own copy, create your own Supabase project and your own keys.
Do not reuse the ones in any deployment you did not set up.

## Reporting something

Open an issue, or contact the repository owner directly if the issue is sensitive.
