import { supabase } from '../supabase';
import type { Bet, Position } from './bets';
import type { Settlement } from './settlements';

export type HomeBetSummary = {
  bet: Bet;
  myPosition: Position;
  needsConfirmation: boolean;
  needsSettlement: boolean;
};

export type HomeData = {
  active: HomeBetSummary[];
  obligations: Settlement[];
  resolvedHistory: HomeBetSummary[];
};

const EMPTY_HOME_DATA: HomeData = { active: [], obligations: [], resolvedHistory: [] };

export async function getHomeData(userId: string): Promise<HomeData> {
  const { data: myPositions, error: positionsError } = await supabase
    .from('positions')
    .select()
    .eq('user_id', userId);
  if (positionsError) throw positionsError;
  if (!myPositions || myPositions.length === 0) return EMPTY_HOME_DATA;

  const betIds = myPositions.map((p) => p.bet_id);
  const positionByBetId = Object.fromEntries(myPositions.map((p) => [p.bet_id, p]));

  const { data: bets, error: betsError } = await supabase.from('bets').select().in('id', betIds);
  if (betsError) throw betsError;
  const betsById = Object.fromEntries((bets ?? []).map((b) => [b.id, b]));

  const { data: resolutions, error: resolutionsError } = await supabase
    .from('resolutions')
    .select()
    .in('bet_id', betIds);
  if (resolutionsError) throw resolutionsError;
  const resolutionsByBetId = Object.fromEntries((resolutions ?? []).map((r) => [r.bet_id, r]));

  const declaredResolutionIds = (resolutions ?? [])
    .filter((r) => r.status === 'declared')
    .map((r) => r.id);
  const { data: myResponses, error: responsesError } =
    declaredResolutionIds.length > 0
      ? await supabase
          .from('resolution_responses')
          .select('resolution_id')
          .in('resolution_id', declaredResolutionIds)
          .eq('user_id', userId)
      : { data: [], error: null };
  if (responsesError) throw responsesError;
  const respondedResolutionIds = new Set((myResponses ?? []).map((r) => r.resolution_id));

  const { data: settlements, error: settlementsError } = await supabase
    .from('settlements')
    .select()
    .or(`owed_by.eq.${userId},owed_to.eq.${userId}`);
  if (settlementsError) throw settlementsError;

  const obligations = (settlements ?? []).filter((s) => !s.confirmed_at);
  const unsettledBetIds = new Set(obligations.map((s) => s.bet_id));

  const active: HomeBetSummary[] = [];
  const resolvedHistory: HomeBetSummary[] = [];

  for (const betId of betIds) {
    const bet = betsById[betId];
    const myPosition = positionByBetId[betId];
    if (!bet || !myPosition) continue;

    const resolution = resolutionsByBetId[betId];
    const needsConfirmation = Boolean(
      resolution && resolution.status === 'declared' && !respondedResolutionIds.has(resolution.id),
    );
    const needsSettlement = unsettledBetIds.has(betId);
    const summary: HomeBetSummary = { bet, myPosition, needsConfirmation, needsSettlement };

    if (bet.status === 'voided' || (bet.status === 'resolved' && !needsSettlement)) {
      resolvedHistory.push(summary);
    } else {
      active.push(summary);
    }
  }

  // awaiting your confirmation, then awaiting settlement, then everything
  // else by recency. ("awaiting your acceptance" from the original spec
  // doesn't apply here — see CLAUDE.md / the Phase 9 report: positions are
  // always self-created by the joining user in this build, so there's no
  // state where someone else adds you to a bet pending your later
  // acceptance.)
  active.sort((a, b) => {
    const rank = (s: HomeBetSummary) => (s.needsConfirmation ? 0 : s.needsSettlement ? 1 : 2);
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return b.bet.created_at.localeCompare(a.bet.created_at);
  });

  resolvedHistory.sort((a, b) => b.bet.created_at.localeCompare(a.bet.created_at));

  return { active, obligations, resolvedHistory };
}
