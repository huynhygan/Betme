import { useState } from 'react';
import { Button } from '../ui/Button';
import { markPaid, confirmSettlement, type Settlement } from '../../lib/queries/settlements';
import type { Profile } from '../../lib/queries/profiles';

type Props = {
  settlements: Settlement[];
  currentUserId: string | undefined;
  profilesById: Record<string, Profile>;
  onChanged: () => void;
};

export function SettlementPanel({ settlements, currentUserId, profilesById, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!currentUserId) return null;
  const mine = settlements.filter(
    (s) => s.owed_by === currentUserId || s.owed_to === currentUserId,
  );
  if (mine.length === 0) return null;

  async function handleMarkPaid(id: string) {
    setBusyId(id);
    try {
      await markPaid(id);
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirm(id: string) {
    setBusyId(id);
    try {
      await confirmSettlement(id);
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="font-medium text-neutral-900 dark:text-neutral-50">Settling up</p>
      {mine.map((s) => {
        const iOwe = s.owed_by === currentUserId;
        const counterpart = profilesById[iOwe ? s.owed_to : s.owed_by]?.display_name ?? 'Someone';
        const done = Boolean(s.confirmed_at);
        return (
          <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-600 dark:text-neutral-300">
              {iOwe ? `You owe ${counterpart}` : `${counterpart} owes you`}: {s.stake_label}
            </span>
            {done ? (
              <span className="shrink-0 text-xs font-medium text-green-600 dark:text-green-400">
                Settled
              </span>
            ) : iOwe ? (
              s.paid_at ? (
                <span className="shrink-0 text-xs text-neutral-400">Waiting on confirmation</span>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => void handleMarkPaid(s.id)}
                  disabled={busyId === s.id}
                >
                  Mark paid
                </Button>
              )
            ) : s.paid_at ? (
              <Button onClick={() => void handleConfirm(s.id)} disabled={busyId === s.id}>
                Confirm received
              </Button>
            ) : (
              <span className="shrink-0 text-xs text-neutral-400">Not paid yet</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
