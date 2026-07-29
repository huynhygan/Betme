import type { BetEvent } from './queries/events';
import type { Profile } from './queries/profiles';

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function describeSystemEvent(
  event: BetEvent,
  profilesById: Record<string, Profile>,
): { icon: string; text: string } {
  const actorName = event.actor_id
    ? (profilesById[event.actor_id]?.display_name ?? 'Someone')
    : 'Someone';
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  switch (event.kind) {
    case 'bet_created':
      return { icon: '🎬', text: `${str(payload.title, 'This challenge')} is live` };
    case 'position_accepted':
      return {
        icon: '🤝',
        text: `${actorName} staked ${str(payload.stake_label, 'something')} on ${str(payload.outcome_label, 'an outcome')}`,
      };
    case 'clause_added':
      return {
        icon: '🛡️',
        text: `${actorName} added a clause: "${str(payload.condition_text, '')}" → ${str(payload.effect_label, '')}`,
      };
    case 'bet_locked':
      return { icon: '🔒', text: 'Entries closed' };
    case 'outcome_declared':
      return { icon: '📣', text: `${actorName} called it: ${str(payload.outcome_label, '—')}` };
    case 'resolution_confirmed':
      return { icon: '✅', text: 'Resolution confirmed' };
    case 'resolution_disputed':
      return { icon: '⚠️', text: `${actorName} disputed the resolution` };
    case 'stake_settled': {
      const owedByName =
        typeof payload.owed_by === 'string'
          ? (profilesById[payload.owed_by]?.display_name ?? 'Someone')
          : 'Someone';
      const owedToName =
        typeof payload.owed_to === 'string'
          ? (profilesById[payload.owed_to]?.display_name ?? 'someone')
          : 'someone';
      return { icon: '💸', text: `${owedByName} settled up with ${owedToName}` };
    }
    default:
      return { icon: '•', text: 'Something happened' };
  }
}
