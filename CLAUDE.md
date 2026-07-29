# CLAUDE.md

## What this is

A social betting app for friend groups. Users create friendly bets, invite
each other, stake real-world things (money settled offline, dinner, favours),
and settle them together. The product is the RECORD and the BANTER around it,
not the wagering.

## Hard constraints — never violate these

- The app NEVER holds, transfers, or processes money. There is no payments
  integration and no wallet. Stakes are descriptive text, never numeric
  currency columns. The app never computes a monetary balance.
- Points are non-purchasable, non-transferable, non-redeemable. There is no
  code path that moves points between users or converts them to anything.
- User-facing copy avoids gambling vocabulary. Prefer "challenge", "stake",
  "settle", "call it". Avoid "wager", "odds", "payout", "bookmaker".
- All tables have RLS enabled. No table is ever left unprotected "for now".

## Stack

React + TypeScript, Vite, Tailwind, Supabase (Postgres + Auth + Realtime),
deployed on Vercel. Supabase project region is Sydney.

## Conventions

- Supabase types are generated into src/types/database.ts. Regenerate after
  every migration; never hand-edit that file.
- All DB access goes through typed helpers in src/lib/queries/. Components
  never call supabase.from() directly.
- Migrations live in supabase/migrations/, timestamped, forward-only.
- Prefer server-side enforcement (RLS, constraints, triggers) over client-side
  validation. Client validation is UX, not security.

## Vocabulary — use these terms exactly, in code and UI

- bet: the challenge itself. A side bet is a bet with parent_bet_id set.
- clause: a conditional modifier on one person's stake. NOT a bet. Has no
  independent outcome and cannot resolve on its own.
- position: one user's stake on one outcome of a bet.
- prediction: a spectator's non-staked call on a bet. Earns points.
- resolution: the settlement record for a bet.
- settlement: confirmation that a real-world stake was actually handed over.

## Data model

Core tables: `profiles` (handle + display name, one per auth user) → `bets`
(status: draft/open/locked/resolved/voided; visibility: private/invite/public;
resolution_method: unanimous/creator/majority) → `outcomes` (2–8 per bet) →
`positions` (one row per participant per bet, a stake on one outcome) →
`clauses` (conditional modifier on a single position). Spectators get
`predictions` (a free call on an outcome, mutually exclusive with having a
position on the same bet). `resolutions` holds one row per bet with
per-participant `resolution_responses` (confirm/dispute). `settlements` is the
pairwise ledger of who-owes-whom once a bet resolves. `bet_events` is an
append-only timeline (system events + chat messages) with `reactions`.
`point_ledger` tracks prediction-scoring points, aggregated in the
`leaderboard` view.

Four non-obvious decisions:

1. **`resolutions` is one row per bet, not one per declaration.** Re-declaring
   after a dispute updates the same row rather than inserting a new one — the
   history of who-declared-what-when lives in `bet_events`, so `resolutions`
   only ever needs to represent current state.
2. **`settlements` is fully pairwise** (`losing_position_id` ×
   `winning_position_id`), not one row per losing position. For the common
   1v1 two-outcome bet that's a single row; for group bets with several
   people per side it's the full cross product. This is the only allocation
   that doesn't require the app to do money math it has no business doing —
   stakes are individual descriptive text, not a pooled amount to be split.
3. **System events in `bet_events` are written exclusively by database
   triggers**, never by client code. This is what keeps the timeline
   incapable of drifting from actual state — a client bug can produce a wrong
   UI, but it can't fabricate a `resolution_confirmed` event that didn't
   happen.
4. **`point_ledger` has no insert policy for the `authenticated` role at
   all.** The only way a row is ever created is the `SECURITY DEFINER`
   function `award_prediction_points()`, called by the resolve-bet edge
   function after a resolution is confirmed. This is the enforcement
   mechanism behind "points are non-transferable" — there is no client code
   path that can write to this table, correct or otherwise.

`can_view_bet(bet_id, user_id)` is the single visibility check reused by RLS
policies across every bet-scoped table, so the visibility rules (private /
invite / public, plus creator/participant/spectator overrides) live in one
place instead of being re-derived per policy.
