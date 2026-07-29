import { Link } from 'react-router-dom';
import type { Settlement } from '../../lib/queries/settlements';
import type { Profile } from '../../lib/queries/profiles';

type Props = {
  obligations: Settlement[];
  currentUserId: string;
  profilesById: Record<string, Profile>;
};

export function ObligationsList({ obligations, currentUserId, profilesById }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {obligations.map((s) => {
        const iOwe = s.owed_by === currentUserId;
        const counterpart = profilesById[iOwe ? s.owed_to : s.owed_by]?.display_name ?? 'Someone';
        return (
          <li key={s.id}>
            <Link
              to={`/bet/${s.bet_id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm transition-colors hover:border-accent-300 dark:border-neutral-800 dark:hover:border-accent-700"
            >
              <span className="text-neutral-700 dark:text-neutral-300">
                {iOwe ? (
                  <>
                    You owe <span className="font-medium">{counterpart}</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{counterpart}</span> owes you
                  </>
                )}
              </span>
              <span className="text-neutral-500">{s.stake_label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
