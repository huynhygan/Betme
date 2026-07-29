-- Core tables. See CLAUDE.md 'Data model' for the shape and the
-- reasoning behind the non-obvious choices (settlements pairing,
-- resolutions being one row per bet, etc).

-- ============================================================================
-- Tables
-- ============================================================================

-- One row per authenticated user. Created by the client right after the user
-- picks a handle during onboarding (never auto-created by a trigger, since we
-- need the uniqueness check to happen client-side first).
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- The challenge itself. A side bet is a bet with parent_bet_id set — it has
-- its own outcomes, positions and resolution, entirely independent of the
-- parent other than the link for display grouping.
create table bets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles (id),
  parent_bet_id uuid references bets (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 1000),
  status bet_status not null default 'draft',
  visibility bet_visibility not null default 'private',
  resolution_method resolution_method not null default 'unanimous',
  locks_at timestamptz not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (parent_bet_id is null or parent_bet_id != id)
);

create index bets_creator_id_idx on bets (creator_id);
create index bets_parent_bet_id_idx on bets (parent_bet_id);
create index bets_status_locks_at_idx on bets (status, locks_at);

-- 2 to 8 per bet, enforced by trigger since check constraints can't count
-- sibling rows.
create table outcomes (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  sort_order int not null check (sort_order >= 0),
  unique (bet_id, sort_order)
);

create index outcomes_bet_id_idx on outcomes (bet_id);

-- One user's stake on one outcome of a bet. accepted_at is null for the
-- creator's own position only for the instant between insert and the review
-- screen confirming it — in practice it is set at insert time for everyone.
create table positions (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets (id) on delete cascade,
  user_id uuid not null references profiles (id),
  outcome_id uuid not null references outcomes (id),
  stake_kind stake_kind not null,
  stake_label text not null check (char_length(stake_label) between 1 and 200),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bet_id, user_id)
);

create index positions_bet_id_idx on positions (bet_id);
create index positions_user_id_idx on positions (user_id);
create index positions_outcome_id_idx on positions (outcome_id);

-- A conditional modifier on ONE participant's own stake. NOT a bet: no
-- independent outcome, cannot resolve on its own, always tied to exactly one
-- position.
create table clauses (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references positions (id) on delete cascade,
  condition_text text not null check (char_length(condition_text) between 1 and 300),
  effect_kind stake_kind not null,
  effect_label text not null check (char_length(effect_label) between 1 and 200),
  triggered boolean,
  created_at timestamptz not null default now()
);

create index clauses_position_id_idx on clauses (position_id);

-- A spectator's non-staked call on a bet's outcome. Earns points, never a
-- stake. A participant (someone with a position) may not also predict on the
-- same bet — enforced by trigger and RLS.
create table predictions (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets (id) on delete cascade,
  user_id uuid not null references profiles (id),
  outcome_id uuid not null references outcomes (id),
  created_at timestamptz not null default now(),
  unique (bet_id, user_id)
);

create index predictions_bet_id_idx on predictions (bet_id);

-- The settlement record for a bet. One row per bet; re-declaring after a
-- dispute updates the same row rather than creating a new one, so history of
-- who-declared-what lives in bet_events, not here.
create table resolutions (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null unique references bets (id) on delete cascade,
  status resolution_status not null default 'pending',
  declared_outcome_id uuid references outcomes (id),
  declared_by uuid references profiles (id),
  declared_at timestamptz,
  confirmed_at timestamptz,
  auto_void_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resolutions_status_auto_void_idx on resolutions (status, auto_void_at);

-- Per-participant confirm/dispute against the currently declared outcome.
-- Cleared (deleted) by the resolve-bet edge function whenever the outcome is
-- re-declared, so a stale confirmation from a previous round never counts.
create table resolution_responses (
  id uuid primary key default gen_random_uuid(),
  resolution_id uuid not null references resolutions (id) on delete cascade,
  user_id uuid not null references profiles (id),
  response resolution_response_kind not null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (resolution_id, user_id),
  check (response = 'confirm' or reason is not null)
);

-- Once a bet resolves, every losing position owes every winning position.
-- For the common 1v1 two-outcome bet that's a single row; for group bets with
-- several people per side it's the full pairwise ledger, which is the only
-- allocation that doesn't require doing money math the app has no business
-- doing.
create table settlements (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets (id) on delete cascade,
  losing_position_id uuid not null references positions (id) on delete cascade,
  winning_position_id uuid not null references positions (id) on delete cascade,
  owed_by uuid not null references profiles (id),
  owed_to uuid not null references profiles (id),
  stake_label text not null,
  paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (losing_position_id, winning_position_id)
);

create index settlements_owed_by_idx on settlements (owed_by);
create index settlements_owed_to_idx on settlements (owed_to);
create index settlements_bet_id_idx on settlements (bet_id);

-- Append-only, chronologically ordered stream of everything that happens on
-- a bet. System events are written exclusively by triggers so the timeline
-- can never drift from actual state; user messages are written by the client.
create table bet_events (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets (id) on delete cascade,
  kind bet_event_kind not null,
  actor_id uuid references profiles (id),
  body text check (char_length(body) <= 500),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (kind != 'message' or body is not null)
);

create index bet_events_bet_id_created_at_idx on bet_events (bet_id, created_at);

create table reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bet_events (id) on delete cascade,
  user_id uuid not null references profiles (id),
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (event_id, user_id, emoji)
);

create index reactions_event_id_idx on reactions (event_id);

-- Points are non-purchasable, non-transferable, non-redeemable. Written only
-- by the SECURITY DEFINER award_prediction_points() function — there is no
-- RLS insert policy for the authenticated role at all.
create table point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id),
  bet_id uuid not null references bets (id) on delete cascade,
  points int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index point_ledger_user_id_idx on point_ledger (user_id);
