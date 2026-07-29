-- Support for resolution and settlement (Prompt 8). resolve-bet edge
-- function owns all resolution state transitions; this migration covers
-- what's left for the database itself:
--   * clause self-attestation (RLS only, no trigger fires on it)
--   * two-sided settlement confirmation (RLS + a validating trigger, since
--     RLS alone can't express "only this column, only this direction")
--   * attributing the resolution_disputed timeline event to whoever
--     disputed, instead of leaving it anonymous
--   * void_expired_resolutions() also flips the bet itself to 'voided'

-- Clause owners can self-report whether their own condition triggered —
-- there's no way for the system to adjudicate free-text conditions like
-- "if I finish under 4:30", only the owner is in a position to say. Locked
-- out once the resolution actually confirms, at which point
-- resolve-bet's finalize step settles any still-null clause to `false`.
create policy clauses_update_own_position on clauses
  for update to authenticated
  using (
    exists (select 1 from positions p where p.id = position_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from positions p where p.id = position_id and p.user_id = auth.uid())
    and not exists (
      select 1 from positions p2
      join resolutions r on r.bet_id = p2.bet_id
      where p2.id = position_id and r.status = 'confirmed'
    )
  );

create policy settlements_update_involved on settlements
  for update to authenticated
  using (owed_by = auth.uid() or owed_to = auth.uid())
  with check (owed_by = auth.uid() or owed_to = auth.uid());

create or replace function validate_settlement_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.owed_by then
    if new.owed_to is distinct from old.owed_to
      or new.stake_label is distinct from old.stake_label
      or new.bet_id is distinct from old.bet_id
      or new.losing_position_id is distinct from old.losing_position_id
      or new.winning_position_id is distinct from old.winning_position_id
      or new.owed_by is distinct from old.owed_by
      or new.confirmed_at is distinct from old.confirmed_at
    then
      raise exception 'the person who owes can only mark it paid';
    end if;
    if old.paid_at is not null then
      raise exception 'already marked paid';
    end if;
  elsif auth.uid() = old.owed_to then
    if new.owed_to is distinct from old.owed_to
      or new.stake_label is distinct from old.stake_label
      or new.bet_id is distinct from old.bet_id
      or new.losing_position_id is distinct from old.losing_position_id
      or new.winning_position_id is distinct from old.winning_position_id
      or new.owed_by is distinct from old.owed_by
      or new.paid_at is distinct from old.paid_at
    then
      raise exception 'the person owed can only confirm it';
    end if;
    if old.paid_at is null then
      raise exception 'cannot confirm before it is marked paid';
    end if;
    if old.confirmed_at is not null then
      raise exception 'already confirmed';
    end if;
  else
    raise exception 'not authorized to update this settlement';
  end if;
  return new;
end;
$$;

create trigger trg_validate_settlement_update
  before update on settlements
  for each row execute function validate_settlement_update();

create or replace function emit_resolution_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome_label text;
  v_disputer_id uuid;
  v_dispute_reason text;
begin
  if new.status = 'declared' and (tg_op = 'INSERT' or old.status is distinct from 'declared' or old.declared_outcome_id is distinct from new.declared_outcome_id) then
    select label into v_outcome_label from outcomes where id = new.declared_outcome_id;
    insert into bet_events (bet_id, kind, actor_id, payload)
    values (new.bet_id, 'outcome_declared', new.declared_by, jsonb_build_object('outcome_label', v_outcome_label));
  elsif new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    insert into bet_events (bet_id, kind, payload)
    values (new.bet_id, 'resolution_confirmed', '{}'::jsonb);
  elsif new.status = 'disputed' and old.status is distinct from 'disputed' then
    select user_id, reason into v_disputer_id, v_dispute_reason
    from resolution_responses
    where resolution_id = new.id and response = 'dispute'
    order by created_at desc
    limit 1;
    insert into bet_events (bet_id, kind, actor_id, payload)
    values (new.bet_id, 'resolution_disputed', v_disputer_id, jsonb_build_object('reason', v_dispute_reason));
  end if;
  return new;
end;
$$;

create or replace function void_expired_resolutions()
returns void
language sql
security definer
set search_path = public
as $$
  with voided as (
    update resolutions set status = 'void', updated_at = now()
    where status in ('pending', 'declared')
      and auto_void_at is not null
      and auto_void_at <= now()
    returning bet_id
  )
  update bets set status = 'voided' where id in (select bet_id from voided);
$$;
