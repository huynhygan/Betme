# supabase/

- `schema.sql` — canonical schema, kept for reference. `migrations/` is the
  source of truth for what actually gets applied.
- `migrations/` — ordered, forward-only. Applied in filename order: enums and
  extensions, then tables, then functions and triggers, then RLS policies,
  then the leaderboard view and scoring function.
- `seed.sql` — idempotent local dev fixtures (3 participants + 5 spectators on
  one bet, one clause). Safe to re-run.
- `tests/rls.test.ts` — the RLS policy test suite. Requires a running
  Supabase instance.

## Running locally

```bash
supabase start
supabase db reset   # applies migrations/*.sql, then seed.sql

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
