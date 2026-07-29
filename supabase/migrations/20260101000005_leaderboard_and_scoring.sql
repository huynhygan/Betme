-- Prediction scoring and the leaderboard view. award_prediction_points()
-- is the only code path that can write to point_ledger — see
-- CLAUDE.md decision #4.

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
