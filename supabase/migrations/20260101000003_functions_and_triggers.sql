-- Visibility/participation helper functions, scheduled maintenance
-- functions, and the validation + timeline triggers. System events in
-- bet_events are written exclusively by these triggers, never by
-- client code — see CLAUDE.md decision #3.

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
