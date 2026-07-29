import { supabase } from '../supabase';
import type { Tables, TablesInsert } from '../../types/database';

export type Profile = Tables<'profiles'>;

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select().eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw error;
  return data === null;
}

export async function createProfile(input: TablesInsert<'profiles'>): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').insert(input).select().single();
  if (error) throw error;
  return data;
}
