import { supabase } from '../supabase';
import type { Enums, Tables } from '../../types/database';

export type Clause = Tables<'clauses'>;

export async function getClausesForPositions(positionIds: string[]): Promise<Clause[]> {
  if (positionIds.length === 0) return [];
  const { data, error } = await supabase.from('clauses').select().in('position_id', positionIds);
  if (error) throw error;
  return data;
}

export async function addClause(input: {
  positionId: string;
  conditionText: string;
  effectKind: Enums<'stake_kind'>;
  effectLabel: string;
}): Promise<Clause> {
  const { data, error } = await supabase
    .from('clauses')
    .insert({
      position_id: input.positionId,
      condition_text: input.conditionText,
      effect_kind: input.effectKind,
      effect_label: input.effectLabel,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
