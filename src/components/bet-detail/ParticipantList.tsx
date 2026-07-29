import type { Outcome, Position } from '../../lib/queries/bets';
import type { Profile } from '../../lib/queries/profiles';

type Props = {
  positions: Position[];
  outcomesById: Record<string, Outcome>;
  profilesById: Record<string, Profile>;
};

export function ParticipantList({ positions, outcomesById, profilesById }: Props) {
  if (positions.length === 0) {
    return <p className="text-sm text-neutral-500">Nobody's joined yet — be the first.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {positions.map((position) => {
        const profile = profilesById[position.user_id];
        const outcome = outcomesById[position.outcome_id];
        return (
          <li
            key={position.id}
            className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
          >
            <span className="font-medium text-neutral-900 dark:text-neutral-50">
              {profile?.display_name ?? 'Someone'}
            </span>
            <span className="text-neutral-500">{outcome?.label ?? '—'}</span>
          </li>
        );
      })}
    </ul>
  );
}
