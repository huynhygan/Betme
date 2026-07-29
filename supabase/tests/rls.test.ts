// RLS policy tests. These are the most important tests in the repo — RLS
// bugs are silent, nothing errors, data just leaks.
//
// Requires a running Supabase instance (local `supabase start`, or a
// disposable hosted project — never run this against production). Set:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// then `npm run test:rls`.
//
// Setup uses the service role client (bypasses RLS) to create fixtures.
// Assertions use normal authenticated clients (real signed-in sessions, so
// auth.uid() resolves exactly as it would for a real user) to verify what
// each policy does and does not allow.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error(
    'RLS tests need SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY set. ' +
      'Run `supabase start` locally and copy the printed values.',
  );
}

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = crypto.randomUUID().slice(0, 8);
const password = 'correct-horse-battery-staple-1!';

async function createUser(name: string) {
  const email = `${name}-${runId}@betme.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('user creation failed');
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, handle: `${name}_${runId}`, display_name: name });
  if (profileError) throw profileError;
  return data.user;
}

async function clientAs(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe('RLS policies', () => {
  let alice: Awaited<ReturnType<typeof createUser>>;
  let bob: Awaited<ReturnType<typeof createUser>>;
  let carol: Awaited<ReturnType<typeof createUser>>;
  let privateBetId: string;
  let outcomeAId: string;
  let outcomeBId: string;
  let aliceClient: SupabaseClient<Database>;
  let bobClient: SupabaseClient<Database>;

  beforeAll(async () => {
    alice = await createUser('alice');
    bob = await createUser('bob');
    carol = await createUser('carol');

    aliceClient = await clientAs(alice.email!);
    bobClient = await clientAs(bob.email!);

    const { data: bet, error: betError } = await admin
      .from('bets')
      .insert({
        creator_id: alice.id,
        title: `RLS test bet ${runId}`,
        status: 'open',
        visibility: 'private',
        locks_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (betError || !bet) throw betError ?? new Error('bet creation failed');
    privateBetId = bet.id;

    const { data: outcomes, error: outcomesError } = await admin
      .from('outcomes')
      .insert([
        { bet_id: privateBetId, label: 'Yes', sort_order: 0 },
        { bet_id: privateBetId, label: 'No', sort_order: 1 },
      ])
      .select();
    if (outcomesError || !outcomes) throw outcomesError ?? new Error('outcome creation failed');
    outcomeAId = outcomes[0].id;
    outcomeBId = outcomes[1].id;

    // Alice is the only participant. Carol is a spectator who predicted.
    const { error: positionError } = await admin.from('positions').insert({
      bet_id: privateBetId,
      user_id: alice.id,
      outcome_id: outcomeAId,
      stake_kind: 'bragging_rights',
      stake_label: 'bragging rights',
      accepted_at: new Date().toISOString(),
    });
    if (positionError) throw positionError;

    const { error: predictionError } = await admin.from('predictions').insert({
      bet_id: privateBetId,
      user_id: carol.id,
      outcome_id: outcomeBId,
    });
    if (predictionError) throw predictionError;
  });

  afterAll(async () => {
    await admin.from('bets').delete().eq('id', privateBetId);
    for (const user of [alice, bob, carol]) {
      if (user) await admin.auth.admin.deleteUser(user.id);
    }
  });

  it('a non-participant cannot select a private bet', async () => {
    const { data, error } = await bobClient.from('bets').select().eq('id', privateBetId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a spectator cannot read another user's prediction before locks_at", async () => {
    const { data, error } = await aliceClient
      .from('predictions')
      .select()
      .eq('bet_id', privateBetId)
      .eq('user_id', carol.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a spectator CAN read it after locks_at', async () => {
    const { error: lockError } = await admin
      .from('bets')
      .update({ locks_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', privateBetId);
    expect(lockError).toBeNull();

    const { data, error } = await aliceClient
      .from('predictions')
      .select()
      .eq('bet_id', privateBetId)
      .eq('user_id', carol.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    // restore for subsequent tests
    await admin
      .from('bets')
      .update({ locks_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
      .eq('id', privateBetId);
  });

  it('an authenticated user cannot insert into point_ledger at all', async () => {
    const { error } = await aliceClient.from('point_ledger').insert({
      user_id: alice.id,
      bet_id: privateBetId,
      points: 999,
      reason: 'cheat',
    });
    expect(error).not.toBeNull();
  });

  it('a participant in a bet cannot insert a prediction on that same bet', async () => {
    const { error } = await aliceClient.from('predictions').insert({
      bet_id: privateBetId,
      user_id: alice.id,
      outcome_id: outcomeBId,
    });
    expect(error).not.toBeNull();
  });
});
