import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type BetEvent = Tables<'bet_events'>;
export type Reaction = Tables<'reactions'>;

export async function getEvents(betId: string): Promise<BetEvent[]> {
  const { data, error } = await supabase
    .from('bet_events')
    .select()
    .eq('bet_id', betId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function getReactionsForEvents(eventIds: string[]): Promise<Reaction[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase.from('reactions').select().in('event_id', eventIds);
  if (error) throw error;
  return data;
}

export async function insertMessage(
  betId: string,
  actorId: string,
  body: string,
): Promise<BetEvent> {
  const { data, error } = await supabase
    .from('bet_events')
    .insert({ bet_id: betId, kind: 'message', actor_id: actorId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addReaction(
  eventId: string,
  userId: string,
  emoji: string,
): Promise<Reaction> {
  const { data, error } = await supabase
    .from('reactions')
    .insert({ event_id: eventId, user_id: userId, emoji })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeReaction(
  eventId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .match({ event_id: eventId, user_id: userId, emoji });
  if (error) throw error;
}
