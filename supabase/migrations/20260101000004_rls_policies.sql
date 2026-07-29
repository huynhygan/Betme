-- Row Level Security. Every table gets RLS enabled here; see the
-- RLS test suite at supabase/tests/rls.test.ts for what these
-- policies are asserted to actually hold.

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

