// Handles every resolution state transition (declare / confirm / dispute).
// This is the ONLY place that writes to resolutions, resolution_responses,
// settlements, or finalizes clauses — never the client directly. RLS grants
// the client no insert/update path on resolutions or resolution_responses
// at all, and no insert path on settlements, specifically so that's true.
//
// States: pending -> declared -> confirmed | disputed | void
// (void is set by the scheduled void_expired_resolutions() job, not here)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

type DeclareBody = { action: 'declare'; betId: string; outcomeId: string };
type ConfirmBody = { action: 'confirm'; betId: string };
type DisputeBody = { action: 'dispute'; betId: string; reason: string };
type RequestBody = DeclareBody | ConfirmBody | DisputeBody;

type Bet = {
  id: string;
  creator_id: string;
  status: string;
  locks_at: string;
  resolution_method: 'unanimous' | 'creator' | 'majority';
};

type Resolution = {
  id: string;
  bet_id: string;
  status: string;
  declared_outcome_id: string | null;
  declared_by: string | null;
};

const AUTO_VOID_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing authorization' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the caller from their own JWT before touching anything
  // privileged.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'not authenticated' }, 401);
  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  if (!body.betId || !body.action) return json({ error: 'betId and action are required' }, 400);

  // Service role from here on. RLS is still what constrains the client
  // directly; this function is the one place allowed to bypass it, and only
  // after the participant check below.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: participant } = await admin
    .from('positions')
    .select('id')
    .eq('bet_id', body.betId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!participant) return json({ error: 'only participants can resolve a bet' }, 403);

  const { data: bet } = await admin.from('bets').select().eq('id', body.betId).maybeSingle();
  if (!bet) return json({ error: 'bet not found' }, 404);

  switch (body.action) {
    case 'declare':
      return await handleDeclare(admin, bet as Bet, userId, body.outcomeId);
    case 'confirm':
      return await handleConfirm(admin, bet as Bet, userId);
    case 'dispute':
      return await handleDispute(admin, bet as Bet, userId, body.reason);
    default:
      return json({ error: 'unknown action' }, 400);
  }
});

async function handleDeclare(
  admin: SupabaseClient,
  bet: Bet,
  userId: string,
  outcomeId: string | undefined,
): Promise<Response> {
  if (!outcomeId) return json({ error: 'outcomeId is required to declare' }, 400);
  if (new Date(bet.locks_at).getTime() > Date.now()) {
    return json({ error: 'entries are still open — wait until locks_at to declare' }, 400);
  }
  if (bet.status === 'resolved' || bet.status === 'voided') {
    return json({ error: 'this bet is no longer open for resolution' }, 400);
  }

  const { data: outcome } = await admin
    .from('outcomes')
    .select('id')
    .eq('id', outcomeId)
    .eq('bet_id', bet.id)
    .maybeSingle();
  if (!outcome) return json({ error: 'outcome does not belong to this bet' }, 400);

  const { data: existing } = await admin
    .from('resolutions')
    .select('id')
    .eq('bet_id', bet.id)
    .maybeSingle();
  const autoVoidAt = new Date(Date.now() + AUTO_VOID_MS).toISOString();
  const nowIso = new Date().toISOString();

  let resolutionId: string;
  if (existing) {
    // Re-declaring (typically after a dispute) resets the confirmation
    // round — a stale confirm from before the re-declare must not count
    // toward the new outcome.
    await admin.from('resolution_responses').delete().eq('resolution_id', existing.id);
    const { error } = await admin
      .from('resolutions')
      .update({
        status: 'declared',
        declared_outcome_id: outcomeId,
        declared_by: userId,
        declared_at: nowIso,
        confirmed_at: null,
        auto_void_at: autoVoidAt,
      })
      .eq('id', existing.id);
    if (error) return json({ error: error.message }, 500);
    resolutionId = existing.id;
  } else {
    const { data: inserted, error } = await admin
      .from('resolutions')
      .insert({
        bet_id: bet.id,
        status: 'declared',
        declared_outcome_id: outcomeId,
        declared_by: userId,
        declared_at: nowIso,
        auto_void_at: autoVoidAt,
      })
      .select('id')
      .single();
    if (error || !inserted) return json({ error: error?.message ?? 'insert failed' }, 500);
    resolutionId = inserted.id;
  }

  // The declarer implicitly agrees with their own call.
  await admin
    .from('resolution_responses')
    .upsert(
      { resolution_id: resolutionId, user_id: userId, response: 'confirm', reason: null },
      { onConflict: 'resolution_id,user_id' },
    );

  if (bet.resolution_method === 'creator' && userId === bet.creator_id) {
    return await finalizeConfirmed(admin, bet);
  }

  const outcome_ = await evaluate(admin, bet, resolutionId);
  if (outcome_ === 'confirmed') return await finalizeConfirmed(admin, bet);
  if (outcome_ === 'disputed') {
    await admin.from('resolutions').update({ status: 'disputed' }).eq('id', resolutionId);
    return json({ status: 'disputed' });
  }
  return json({ status: 'declared' });
}

async function handleConfirm(admin: SupabaseClient, bet: Bet, userId: string): Promise<Response> {
  const { data: resolution } = await admin
    .from('resolutions')
    .select()
    .eq('bet_id', bet.id)
    .maybeSingle<Resolution>();
  if (!resolution || resolution.status !== 'declared') {
    return json({ error: 'no outcome has been declared yet' }, 400);
  }

  await admin
    .from('resolution_responses')
    .upsert(
      { resolution_id: resolution.id, user_id: userId, response: 'confirm', reason: null },
      { onConflict: 'resolution_id,user_id' },
    );

  if (bet.resolution_method === 'creator') {
    if (userId !== bet.creator_id) {
      return json({ status: 'declared', note: 'only the creator confirming finalizes this bet' });
    }
    return await finalizeConfirmed(admin, bet);
  }

  const outcome = await evaluate(admin, bet, resolution.id);
  if (outcome === 'confirmed') return await finalizeConfirmed(admin, bet);
  if (outcome === 'disputed') {
    await admin.from('resolutions').update({ status: 'disputed' }).eq('id', resolution.id);
    return json({ status: 'disputed' });
  }
  return json({ status: 'declared' });
}

async function handleDispute(
  admin: SupabaseClient,
  bet: Bet,
  userId: string,
  reason: string | undefined,
): Promise<Response> {
  if (!reason || !reason.trim()) return json({ error: 'a reason is required to dispute' }, 400);

  const { data: resolution } = await admin
    .from('resolutions')
    .select()
    .eq('bet_id', bet.id)
    .maybeSingle<Resolution>();
  if (!resolution || resolution.status !== 'declared') {
    return json({ error: 'no outcome has been declared yet' }, 400);
  }

  await admin
    .from('resolution_responses')
    .upsert(
      { resolution_id: resolution.id, user_id: userId, response: 'dispute', reason: reason.trim() },
      { onConflict: 'resolution_id,user_id' },
    );

  if (bet.resolution_method === 'unanimous') {
    // Full agreement is now impossible without a re-declare.
    await admin.from('resolutions').update({ status: 'disputed' }).eq('id', resolution.id);
    return json({ status: 'disputed' });
  }

  if (bet.resolution_method === 'creator') {
    // Only the creator's own word can move a creator-resolved bet.
    if (userId === bet.creator_id) {
      await admin.from('resolutions').update({ status: 'disputed' }).eq('id', resolution.id);
      return json({ status: 'disputed' });
    }
    return json({ status: 'declared', note: "only the creator's response affects this bet" });
  }

  // majority: a dispute is just a "no" — Prompt 8's own copy says majority
  // can resolve "even if a few disagree", so only flip to disputed once a
  // confirming majority becomes mathematically impossible.
  const outcome = await evaluate(admin, bet, resolution.id);
  if (outcome === 'disputed') {
    await admin.from('resolutions').update({ status: 'disputed' }).eq('id', resolution.id);
    return json({ status: 'disputed' });
  }
  return json({ status: 'declared' });
}

async function evaluate(
  admin: SupabaseClient,
  bet: Bet,
  resolutionId: string,
): Promise<'confirmed' | 'disputed' | 'declared'> {
  const { count: total } = await admin
    .from('positions')
    .select('id', { count: 'exact', head: true })
    .eq('bet_id', bet.id);
  const totalCount = total ?? 0;

  const { data: responses } = await admin
    .from('resolution_responses')
    .select('response')
    .eq('resolution_id', resolutionId);
  const confirmCount = (responses ?? []).filter((r) => r.response === 'confirm').length;
  const disputeCount = (responses ?? []).filter((r) => r.response === 'dispute').length;

  if (bet.resolution_method === 'unanimous') {
    if (disputeCount > 0) return 'disputed';
    if (totalCount > 0 && confirmCount === totalCount) return 'confirmed';
    return 'declared';
  }

  if (bet.resolution_method === 'majority') {
    if (confirmCount > totalCount / 2) return 'confirmed';
    if (disputeCount > totalCount / 2) return 'disputed';
    return 'declared';
  }

  // 'creator' is always resolved inline by its callers.
  return 'declared';
}

async function finalizeConfirmed(admin: SupabaseClient, bet: Bet): Promise<Response> {
  const { data: resolution } = await admin
    .from('resolutions')
    .select()
    .eq('bet_id', bet.id)
    .single<Resolution>();
  if (!resolution) return json({ error: 'resolution not found' }, 500);
  const declaredOutcomeId = resolution.declared_outcome_id;

  const { data: positions } = await admin.from('positions').select().eq('bet_id', bet.id);
  const allPositions = positions ?? [];
  const positionIds = allPositions.map((p) => p.id);

  // Clauses are free-text conditions the system can't adjudicate — anything
  // the owner never self-attested defaults to not-triggered rather than
  // staying ambiguously null forever.
  if (positionIds.length > 0) {
    await admin
      .from('clauses')
      .update({ triggered: false })
      .in('position_id', positionIds)
      .is('triggered', null);
  }

  const winners = allPositions.filter((p) => p.outcome_id === declaredOutcomeId);
  const losers = allPositions.filter((p) => p.outcome_id !== declaredOutcomeId);
  if (winners.length > 0 && losers.length > 0) {
    const rows = losers.flatMap((loser) =>
      winners.map((winner) => ({
        bet_id: bet.id,
        losing_position_id: loser.id,
        winning_position_id: winner.id,
        owed_by: loser.user_id,
        owed_to: winner.user_id,
        stake_label: loser.stake_label,
      })),
    );
    await admin
      .from('settlements')
      .upsert(rows, { onConflict: 'losing_position_id,winning_position_id' });
  }

  await admin.rpc('award_prediction_points', { p_bet_id: bet.id });

  await admin.from('bets').update({ status: 'resolved' }).eq('id', bet.id);
  await admin
    .from('resolutions')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', resolution.id);

  return json({ status: 'confirmed' });
}
