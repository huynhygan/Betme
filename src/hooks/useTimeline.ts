import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  addReaction,
  getEvents,
  getReactionsForEvents,
  insertMessage,
  removeReaction,
  type BetEvent,
  type Reaction,
} from '../lib/queries/events';

export type TimelineEvent = BetEvent & { _pending?: boolean; _failed?: boolean };

function sortByCreatedAt<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function useTimeline(betId: string | undefined, userId: string | undefined) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const eventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    eventIdsRef.current = new Set(events.map((e) => e.id));
  }, [events]);

  const refetch = useCallback(async () => {
    if (!betId) return;
    const eventRows = await getEvents(betId);
    const reactionRows = await getReactionsForEvents(eventRows.map((e) => e.id));
    setEvents(sortByCreatedAt(eventRows));
    setReactions(reactionRows);
    setLoading(false);
  }, [betId]);

  useEffect(() => {
    if (!betId) return;
    let cancelled = false;

    void refetch();

    // Postgres row-level realtime filters can't reach through the
    // reactions -> bet_events -> bets join, so reactions are subscribed
    // unfiltered and dropped client-side against the events we actually
    // know about for this bet.
    const channel = supabase
      .channel(`bet-${betId}-timeline`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bet_events', filter: `bet_id=eq.${betId}` },
        (payload) => {
          const row = payload.new as BetEvent;
          setEvents((prev) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            return sortByCreatedAt([...prev, row]);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions' },
        (payload) => {
          const row = payload.new as Reaction;
          if (!eventIdsRef.current.has(row.event_id)) return;
          setReactions((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reactions' },
        (payload) => {
          const row = payload.old as Reaction;
          setReactions((prev) => prev.filter((r) => r.id !== row.id));
        },
      )
      .subscribe((status) => {
        // Fires on the initial subscribe and again on every automatic
        // reconnect — refetching here catches anything the client missed
        // while disconnected, since postgres_changes never backfills.
        if (status === 'SUBSCRIBED' && !cancelled) {
          void refetch();
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [betId, refetch]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!betId || !userId) return;
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: TimelineEvent = {
        id: tempId,
        bet_id: betId,
        kind: 'message',
        actor_id: userId,
        body,
        payload: {},
        created_at: new Date().toISOString(),
        _pending: true,
      };
      setEvents((prev) => sortByCreatedAt([...prev, optimistic]));

      try {
        const real = await insertMessage(betId, userId, body);
        setEvents((prev) => {
          // Realtime may have already delivered this exact row while the
          // insert's own response was still in flight.
          const alreadyHasReal = prev.some((e) => e.id === real.id);
          const withoutTemp = prev.filter((e) => e.id !== tempId);
          return sortByCreatedAt(alreadyHasReal ? withoutTemp : [...withoutTemp, real]);
        });
      } catch {
        setEvents((prev) =>
          prev.map((e) => (e.id === tempId ? { ...e, _pending: false, _failed: true } : e)),
        );
      }
    },
    [betId, userId],
  );

  const toggleReaction = useCallback(
    async (eventId: string, emoji: string) => {
      if (!userId) return;
      const mine = reactions.find(
        (r) => r.event_id === eventId && r.user_id === userId && r.emoji === emoji,
      );

      if (mine) {
        setReactions((prev) => prev.filter((r) => r.id !== mine.id));
        try {
          await removeReaction(eventId, userId, emoji);
        } catch {
          setReactions((prev) => [...prev, mine]);
        }
        return;
      }

      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: Reaction = {
        id: tempId,
        event_id: eventId,
        user_id: userId,
        emoji,
        created_at: new Date().toISOString(),
      };
      setReactions((prev) => [...prev, optimistic]);
      try {
        const real = await addReaction(eventId, userId, emoji);
        setReactions((prev) => {
          const alreadyHasReal = prev.some((r) => r.id === real.id && r.id !== tempId);
          const withoutTemp = prev.filter((r) => r.id !== tempId);
          return alreadyHasReal ? withoutTemp : [...withoutTemp, real];
        });
      } catch {
        setReactions((prev) => prev.filter((r) => r.id !== tempId));
      }
    },
    [reactions, userId],
  );

  return { events, reactions, loading, sendMessage, toggleReaction };
}
