# Contributing

This is a small app built for one group of friends, so there is no formal process. If you
want to change something, these are the things worth knowing.

## Before you open a PR

1. `npm run build` passing is not enough. Vite happily builds missing imports and
   undefined components, which then fail at runtime. Load the built app and click through
   the screens you touched.
2. If you added a table or column, add a numbered migration in `supabase/`. Do not edit an
   existing migration, since other people have already run it.
3. Add an entry to `CHANGELOG.md` saying what changed and whether a migration is needed.

## House rules

- Keep secrets out of the repo. Everything sensitive is an environment variable.
- Store image URLs, not blobs.
- Scoring logic stays as pure functions in `src/lib/` so it can be tested without React.
- The AI endpoints share one entry point, `api/_ai.js`. Add providers there rather than
  calling a model directly from a handler.

## Reporting a bug

Open an issue with what you did, what happened, and what you expected. A screenshot of the
screen helps more than a description of it.
