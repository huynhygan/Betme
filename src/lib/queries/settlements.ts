import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type Settlement = Tables<'settlements'>;

export async function getSettlementsForBet(betId: string): Promise<Settlement[]> {
  const { data, error } = await supabase.from('settlements').select().eq('bet_id', betId);
  if (error) throw error;
  return data;
}

export async function getMySettlements(userId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select()
    .or(`owed_by.eq.${userId},owed_to.eq.${userId}`);
  if (error) throw error;
  return data;
}

export async function markPaid(settlementId: string): Promise<Settlement> {
  const { data, error } = await supabase
    .from('settlements')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', settlementId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function confirmSettlement(settlementId: string): Promise<Settlement> {
  const { data, error } = await supabase
    .from('settlements')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('id', settlementId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
