# supabase/

- `schema.sql` — canonical schema, kept for reference. `migrations/` is the
  source of truth for what actually gets applied.
- `migrations/` — ordered, forward-only. Applied in filename order: enums and
  extensions, then tables, then functions and triggers, then RLS policies,
  then the leaderboard view and scoring function.
- `seed.sql` — idempotent local dev fixtures (3 participants + 5 spectators on
  one bet, one clause). Safe to re-run.
- `functions/resolve-bet/` — the edge function that owns every resolution
  state transition (declare/confirm/dispute). This is the only thing allowed
  to write to `resolutions`, `resolution_responses`, or `settlements` — RLS
  grants the client no direct path onto any of them. Deploy with
  `supabase functions deploy resolve-bet`; it reads `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from the function
  environment (set automatically by Supabase for deployed functions).
- `tests/rls.test.ts` — the RLS policy test suite. Requires a running
  Supabase instance.

Migrations 7 and 8 depend on extensions that must be enabled on the Supabase
project (both are on by default on hosted projects, enable via
Database → Extensions if not): `pg_cron`, for the scheduled jobs that flip
`open` bets to `locked` past `locks_at` and void resolutions nobody
confirmed/disputed within `auto_void_at`.

## Running locally

```bash
supabase start
supabase db reset   # applies migrations/*.sql, then seed.sql
supabase functions serve resolve-bet

# copy the URL / anon key / service_role key supabase start printed
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
npm run test:rls
```

After changing any migration, regenerate types:

```bash
supabase gen types typescript --local > src/types/database.ts
```
