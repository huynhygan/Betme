import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type Resolution = Tables<'resolutions'>;
export type ResolutionResponse = Tables<'resolution_responses'>;

export async function getResolution(betId: string): Promise<Resolution | null> {
  const { data, error } = await supabase
    .from('resolutions')
    .select()
    .eq('bet_id', betId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getResolutionResponses(resolutionId: string): Promise<ResolutionResponse[]> {
  const { data, error } = await supabase
    .from('resolution_responses')
    .select()
    .eq('resolution_id', resolutionId);
  if (error) throw error;
  return data;
}

type ResolveAction =
  | { action: 'declare'; betId: string; outcomeId: string }
  | { action: 'confirm'; betId: string }
  | { action: 'dispute'; betId: string; reason: string };

// The only client-side write path onto resolutions/resolution_responses —
// RLS grants the authenticated role no direct insert/update on either
// table, by design. See supabase/functions/resolve-bet.
export async function callResolveBet(payload: ResolveAction): Promise<{ status: string }> {
  const { data, error } = await supabase.functions.invoke<{ status: string }>('resolve-bet', {
    body: payload,
  });
  if (error) throw error;
  if (!data) throw new Error('resolve-bet returned no data');
  return data;
}
