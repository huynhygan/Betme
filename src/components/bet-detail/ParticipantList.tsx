import type { Outcome, Position } from '../../lib/queries/bets';
import type { Clause } from '../../lib/queries/clauses';
import type { Profile } from '../../lib/queries/profiles';

type Props = {
  positions: Position[];
  outcomesById: Record<string, Outcome>;
  profilesById: Record<string, Profile>;
  clausesByPositionId: Record<string, Clause[]>;
};

export function ParticipantList({
  positions,
  outcomesById,
  profilesById,
  clausesByPositionId,
}: Props) {
  if (positions.length === 0) {
    return <p className="text-sm text-neutral-500">Nobody's joined yet — be the first.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {positions.map((position) => {
        const profile = profilesById[position.user_id];
        const outcome = outcomesById[position.outcome_id];
        const clauses = clausesByPositionId[position.id] ?? [];
        return (
          <li
            key={position.id}
            className="rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-900 dark:text-neutral-50">
                {profile?.display_name ?? 'Someone'}
              </span>
              <span className="text-neutral-500">{outcome?.label ?? '—'}</span>
            </div>
            {clauses.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                {clauses.map((clause) => (
                  <li key={clause.id} className="text-xs text-neutral-500">
                    <span className="font-medium text-neutral-600 dark:text-neutral-400">
                      If {clause.condition_text}
                    </span>{' '}
                    → {clause.effect_label}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
