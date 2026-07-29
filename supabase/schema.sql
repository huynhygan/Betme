-- Betme schema
-- A social betting app for friend groups. See CLAUDE.md for product context
-- and vocabulary. This file is the canonical schema; supabase/migrations/
-- splits it into ordered, forward-only migration files.
--
-- Hard constraints encoded here:
--   * no monetary columns anywhere — stakes are always free text
--   * point_ledger is never writable by the authenticated role
--   * every table has RLS enabled

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- Enums
-- ============================================================================

create type bet_status as enum ('draft', 'open', 'locked', 'resolved', 'voided');
create type bet_visibility as enum ('private', 'invite', 'public');
create type resolution_method as enum ('unanimous', 'creator', 'majority');
create type stake_kind as enum ('cash_offline', 'food_drink', 'favour', 'item', 'bragging_rights');
create type resolution_status as enum ('pending', 'declared', 'confirmed', 'disputed', 'void');
create type resolution_response_kind as enum ('confirm', 'dispute');
create type bet_event_kind as enum (
  'bet_created',
  'position_accepted',
  'clause_added',
  'bet_locked',
  'outcome_declared',
  'resolution_confirmed',
  'resolution_disputed',
  'stake_settled',
  'message'
);

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

-- ============================================================================
-- Functions
-- ============================================================================

-- Central visibility check, reused by RLS policies on every bet-scoped table.
-- SECURITY DEFINER so it can read `bets` and `positions` internally without
-- itself being subject to the RLS policies that call it (which would recurse).
create or replace function can_view_bet(p_bet_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from bets b
    where b.id = p_bet_id
      and (
        b.visibility in ('public', 'invite')
        or (p_user_id is not null and b.creator_id = p_user_id)
        or (p_user_id is not null and exists (
          select 1 from positions p where p.bet_id = b.id and p.user_id = p_user_id
        ))
        or (p_user_id is not null and exists (
          select 1 from predictions pr where pr.bet_id = b.id and pr.user_id = p_user_id
        ))
      )
  );
$$;

create or replace function is_bet_participant(p_bet_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from positions p where p.bet_id = p_bet_id and p.user_id = p_user_id
  );
$$;

-- Called by the resolve-bet edge function once a resolution is confirmed.
-- Awards a flat 10 points per correct prediction. SECURITY DEFINER is what
-- makes point_ledger writable at all, since no RLS policy grants insert.
create or replace function award_prediction_points(p_bet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_declared_outcome_id uuid;
begin
  select declared_outcome_id into v_declared_outcome_id
  from resolutions where bet_id = p_bet_id and status = 'confirmed';

  if v_declared_outcome_id is null then
    return;
  end if;

  insert into point_ledger (user_id, bet_id, points, reason)
  select pr.user_id, p_bet_id, 10, 'correct_prediction'
  from predictions pr
  where pr.bet_id = p_bet_id
    and pr.outcome_id = v_declared_outcome_id
  on conflict do nothing;
end;
$$;

-- Flips bets from 'open' to 'locked' once locks_at has passed. Invoked on a
-- schedule (pg_cron / a scheduled edge function), never by client code.
create or replace function lock_expired_bets()
returns void
language sql
security definer
set search_path = public
as $$
  update bets set status = 'locked'
  where status = 'open' and locks_at <= now();
$$;

-- Voids any resolution still pending confirmation past its auto_void_at.
-- Invoked on the same schedule as lock_expired_bets().
create or replace function void_expired_resolutions()
returns void
language sql
security definer
set search_path = public
as $$
  update resolutions set status = 'void', updated_at = now()
  where status in ('pending', 'declared')
    and auto_void_at is not null
    and auto_void_at <= now();
$$;

-- ============================================================================
-- Validation triggers
-- ============================================================================

create or replace function validate_outcome_count()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count from outcomes where bet_id = coalesce(new.bet_id, old.bet_id);
  if tg_op in ('INSERT') and v_count > 8 then
    raise exception 'a bet may have at most 8 outcomes';
  end if;
  if tg_op = 'DELETE' and v_count < 2 then
    raise exception 'a bet must have at least 2 outcomes';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_validate_outcome_count
  after insert or delete on outcomes
  for each row execute function validate_outcome_count();

create or replace function validate_position_outcome()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from outcomes where id = new.outcome_id and bet_id = new.bet_id
  ) then
    raise exception 'outcome % does not belong to bet %', new.outcome_id, new.bet_id;
  end if;
  return new;
end;
$$;

create trigger trg_validate_position_outcome
  before insert or update on positions
  for each row execute function validate_position_outcome();

-- A participant cannot also be a spectator predicting on their own bet.
create or replace function validate_prediction_not_participant()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from positions where bet_id = new.bet_id and user_id = new.user_id) then
    raise exception 'a participant cannot submit a prediction on the same bet';
  end if;
  if not exists (
    select 1 from outcomes where id = new.outcome_id and bet_id = new.bet_id
  ) then
    raise exception 'outcome % does not belong to bet %', new.outcome_id, new.bet_id;
  end if;
  return new;
end;
$$;

create trigger trg_validate_prediction
  before insert on predictions
  for each row execute function validate_prediction_not_participant();

-- ============================================================================
-- Timeline (bet_events) triggers — system events are never written by the
-- client, only by these.
-- ============================================================================

create or replace function emit_bet_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'open' and (old is null or old.status is distinct from 'open') then
    insert into bet_events (bet_id, kind, actor_id, payload)
    values (new.id, 'bet_created', new.creator_id, jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;

create trigger trg_emit_bet_created
  after insert or update of status on bets
  for each row execute function emit_bet_created_event();

create or replace function emit_bet_locked_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'locked' and old.status is distinct from 'locked' then
    insert into bet_events (bet_id, kind, payload)
    values (new.id, 'bet_locked', jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;

create trigger trg_emit_bet_locked
  after update of status on bets
  for each row execute function emit_bet_locked_event();

create or replace function emit_position_accepted_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome_label text;
begin
  if new.accepted_at is not null and (tg_op = 'INSERT' or old.accepted_at is null) then
    select label into v_outcome_label from outcomes where id = new.outcome_id;
    insert into bet_events (bet_id, kind, actor_id, payload)
    values (
      new.bet_id, 'position_accepted', new.user_id,
      jsonb_build_object('outcome_label', v_outcome_label, 'stake_kind', new.stake_kind, 'stake_label', new.stake_label)
    );
  end if;
  return new;
end;
$$;

create trigger trg_emit_position_accepted
  after insert or update of accepted_at on positions
  for each row execute function emit_position_accepted_event();

create or replace function emit_clause_added_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bet_id uuid;
  v_user_id uuid;
begin
  select bet_id, user_id into v_bet_id, v_user_id from positions where id = new.position_id;
  insert into bet_events (bet_id, kind, actor_id, payload)
  values (
    v_bet_id, 'clause_added', v_user_id,
    jsonb_build_object('condition_text', new.condition_text, 'effect_label', new.effect_label)
  );
  return new;
end;
$$;

create trigger trg_emit_clause_added
  after insert on clauses
  for each row execute function emit_clause_added_event();

create or replace function emit_resolution_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome_label text;
begin
  if new.status = 'declared' and (tg_op = 'INSERT' or old.status is distinct from 'declared' or old.declared_outcome_id is distinct from new.declared_outcome_id) then
    select label into v_outcome_label from outcomes where id = new.declared_outcome_id;
    insert into bet_events (bet_id, kind, actor_id, payload)
    values (new.bet_id, 'outcome_declared', new.declared_by, jsonb_build_object('outcome_label', v_outcome_label));
  elsif new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    insert into bet_events (bet_id, kind, payload)
    values (new.bet_id, 'resolution_confirmed', '{}'::jsonb);
  elsif new.status = 'disputed' and old.status is distinct from 'disputed' then
    insert into bet_events (bet_id, kind, payload)
    values (new.bet_id, 'resolution_disputed', '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger trg_emit_resolution_events
  after insert or update of status on resolutions
  for each row execute function emit_resolution_events();

create or replace function emit_stake_settled_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.confirmed_at is not null and old.confirmed_at is null then
    insert into bet_events (bet_id, kind, actor_id, payload)
    values (new.bet_id, 'stake_settled', new.owed_to, jsonb_build_object('owed_by', new.owed_by, 'owed_to', new.owed_to, 'stake_label', new.stake_label));
  end if;
  return new;
end;
$$;

create trigger trg_emit_stake_settled
  after update of confirmed_at on settlements
  for each row execute function emit_stake_settled_event();

create or replace function touch_resolution_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_resolution_updated_at
  before update on resolutions
  for each row execute function touch_resolution_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table profiles enable row level security;
alter table bets enable row level security;
alter table outcomes enable row level security;
alter table positions enable row level security;
alter table clauses enable row level security;
alter table predictions enable row level security;
alter table resolutions enable row level security;
alter table resolution_responses enable row level security;
alter table settlements enable row level security;
alter table bet_events enable row level security;
alter table reactions enable row level security;
alter table point_ledger enable row level security;

-- profiles: readable by anyone authenticated (needed to render names across
-- bets); writable only by the owner.
create policy profiles_select_authenticated on profiles
  for select to authenticated using (true);

create policy profiles_insert_own on profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_own on profiles
  for update to authenticated using (id = auth.uid());

-- bets
create policy bets_select_visible on bets
  for select using (can_view_bet(id, auth.uid()));

create policy bets_insert_own on bets
  for insert to authenticated with check (creator_id = auth.uid());

-- with check restricts the creator to draft-editing and publishing only —
-- the transitions to 'locked'/'resolved'/'voided' happen exclusively via
-- lock_expired_bets() and the resolve-bet edge function, both of which run
-- as the service role and so bypass RLS entirely. Without this check a
-- client could set status = 'resolved' directly and skip resolution.
create policy bets_update_creator on bets
  for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid() and status in ('draft', 'open'));

-- outcomes: same visibility as the parent bet; only the creator can add them
-- (only while the bet is still a draft, enforced by the with check subquery).
create policy outcomes_select_visible on outcomes
  for select using (can_view_bet(bet_id, auth.uid()));

create policy outcomes_insert_creator on outcomes
  for insert to authenticated with check (
    exists (select 1 from bets b where b.id = bet_id and b.creator_id = auth.uid() and b.status = 'draft')
  );

create policy outcomes_delete_creator on outcomes
  for delete to authenticated using (
    exists (select 1 from bets b where b.id = bet_id and b.creator_id = auth.uid() and b.status = 'draft')
  );

-- positions: visible to anyone who can view the bet; a user may only ever
-- insert/update their own position, and only before locks_at.
create policy positions_select_visible on positions
  for select using (can_view_bet(bet_id, auth.uid()));

create policy positions_insert_own on positions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from bets b where b.id = bet_id and b.locks_at > now() and b.status in ('draft', 'open'))
  );

create policy positions_update_own on positions
  for update to authenticated using (
    user_id = auth.uid()
    and exists (select 1 from bets b where b.id = bet_id and b.locks_at > now())
  );

-- clauses: visible to anyone who can view the parent bet; a user may only add
-- a clause to their OWN position, and only before locks_at.
create policy clauses_select_visible on clauses
  for select using (
    exists (
      select 1 from positions p where p.id = position_id and can_view_bet(p.bet_id, auth.uid())
    )
  );

create policy clauses_insert_own_position on clauses
  for insert to authenticated with check (
    exists (
      select 1 from positions p
      join bets b on b.id = p.bet_id
      where p.id = position_id and p.user_id = auth.uid() and b.locks_at > now()
    )
  );

-- predictions: a spectator can read only their own prediction before
-- locks_at; once locked, everyone who can view the bet can read all of them.
-- Insert is limited to non-participants before locks_at (also enforced by
-- the validate_prediction_not_participant trigger).
create policy predictions_select_own_before_lock on predictions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from bets b where b.id = bet_id and b.locks_at <= now() and can_view_bet(b.id, auth.uid())
    )
  );

create policy predictions_insert_non_participant on predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and can_view_bet(bet_id, auth.uid())
    and not is_bet_participant(bet_id, auth.uid())
    and exists (select 1 from bets b where b.id = bet_id and b.locks_at > now())
  );

-- resolutions: visible to anyone who can view the bet; participants declare
-- via the edge function using the service role, so there is no direct client
-- insert/update policy here at all.
create policy resolutions_select_visible on resolutions
  for select using (can_view_bet(bet_id, auth.uid()));

-- resolution_responses: visible to participants of the bet; inserted only by
-- the edge function (service role), not directly by clients.
create policy resolution_responses_select_participant on resolution_responses
  for select using (
    exists (
      select 1 from resolutions r where r.id = resolution_id and is_bet_participant(r.bet_id, auth.uid())
    )
  );

-- settlements: visible only to the two people involved.
create policy settlements_select_involved on settlements
  for select using (owed_by = auth.uid() or owed_to = auth.uid());

-- bet_events: readable by anyone who can view the bet. Messages are
-- insertable only by participants and invited spectators (people with a
-- position or a prediction) — never by a viewer of a public bet who is
-- neither. System events are never client-insertable (no policy grants it).
create policy bet_events_select_visible on bet_events
  for select using (can_view_bet(bet_id, auth.uid()));

create policy bet_events_insert_message on bet_events
  for insert to authenticated with check (
    kind = 'message'
    and actor_id = auth.uid()
    and (
      is_bet_participant(bet_id, auth.uid())
      or exists (select 1 from predictions pr where pr.bet_id = bet_id and pr.user_id = auth.uid())
    )
  );

-- reactions: insertable by anyone who can read the event.
create policy reactions_select_visible on reactions
  for select using (
    exists (select 1 from bet_events e where e.id = event_id and can_view_bet(e.bet_id, auth.uid()))
  );

create policy reactions_insert_own on reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from bet_events e where e.id = event_id and can_view_bet(e.bet_id, auth.uid()))
  );

create policy reactions_delete_own on reactions
  for delete to authenticated using (user_id = auth.uid());

-- point_ledger: a user can read their own rows. No insert/update/delete
-- policy exists for the authenticated role at all — the table is only
-- writable via the SECURITY DEFINER award_prediction_points() function.
create policy point_ledger_select_own on point_ledger
  for select using (user_id = auth.uid());

-- ============================================================================
-- Leaderboard view
-- ============================================================================

create view leaderboard as
select
  p.id as user_id,
  p.handle,
  p.display_name,
  coalesce(sum(pl.points), 0) as total_points,
  count(pl.id) as scored_predictions
from profiles p
left join point_ledger pl on pl.user_id = p.id
group by p.id, p.handle, p.display_name
order by total_points desc;
