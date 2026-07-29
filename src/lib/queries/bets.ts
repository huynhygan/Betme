import { supabase } from '../supabase';
import type { Enums, Tables } from '../../types/database';

export type Bet = Tables<'bets'>;
export type Outcome = Tables<'outcomes'>;
export type Position = Tables<'positions'>;

export async function createDraftBet(input: {
  title: string;
  description?: string;
  visibility: Enums<'bet_visibility'>;
  resolutionMethod: Enums<'resolution_method'>;
  locksAt: string;
  creatorId: string;
}): Promise<Bet> {
  const { data, error } = await supabase
    .from('bets')
    .insert({
      title: input.title,
      description: input.description,
      visibility: input.visibility,
      resolution_method: input.resolutionMethod,
      locks_at: input.locksAt,
      creator_id: input.creatorId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addOutcomes(betId: string, labels: string[]): Promise<Outcome[]> {
  const rows = labels.map((label, index) => ({ bet_id: betId, label, sort_order: index }));
  const { data, error } = await supabase.from('outcomes').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function publishBet(betId: string): Promise<Bet> {
  const { data, error } = await supabase
    .from('bets')
    .update({ status: 'open', published_at: new Date().toISOString() })
    .eq('id', betId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addPosition(input: {
  betId: string;
  userId: string;
  outcomeId: string;
  stakeKind: Enums<'stake_kind'>;
  stakeLabel: string;
}): Promise<Position> {
  const { data, error } = await supabase
    .from('positions')
    .insert({
      bet_id: input.betId,
      user_id: input.userId,
      outcome_id: input.outcomeId,
      stake_kind: input.stakeKind,
      stake_label: input.stakeLabel,
      accepted_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getBet(betId: string): Promise<Bet | null> {
  const { data, error } = await supabase.from('bets').select().eq('id', betId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOutcomes(betId: string): Promise<Outcome[]> {
  const { data, error } = await supabase
    .from('outcomes')
    .select()
    .eq('bet_id', betId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getPositions(betId: string): Promise<Position[]> {
  const { data, error } = await supabase.from('positions').select().eq('bet_id', betId);
  if (error) throw error;
  return data;
}
