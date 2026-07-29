import { Link } from 'react-router-dom';
import type { HomeBetSummary } from '../../lib/queries/home';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  locked: 'Awaiting resolution',
  resolved: 'Resolved',
  voided: 'Voided',
};

export function BetCard({ summary }: { summary: HomeBetSummary }) {
  const { bet, needsConfirmation, needsSettlement } = summary;
  const attention = needsConfirmation
    ? 'Needs your confirmation'
    : needsSettlement
      ? 'Needs settling up'
      : null;

  return (
    <Link
      to={`/bet/${bet.id}`}
      className="flex flex-col gap-1 rounded-2xl border border-neutral-200 p-4 transition-colors hover:border-accent-300 dark:border-neutral-800 dark:hover:border-accent-700"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-neutral-900 dark:text-neutral-50">{bet.title}</p>
        {attention && (
          <span className="shrink-0 rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-900 dark:text-accent-300">
            {attention}
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-500">{STATUS_LABELS[bet.status] ?? bet.status}</p>
    </Link>
  );
}
