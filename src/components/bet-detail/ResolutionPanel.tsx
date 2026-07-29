import { useState } from 'react';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/TextInput';
import {
  callResolveBet,
  type Resolution,
  type ResolutionResponse,
} from '../../lib/queries/resolutions';
import type { Bet, Outcome, Position } from '../../lib/queries/bets';
import type { Profile } from '../../lib/queries/profiles';

type Props = {
  bet: Bet;
  outcomes: Outcome[];
  positions: Position[];
  myPosition: Position | undefined;
  resolution: Resolution | null;
  responses: ResolutionResponse[];
  profilesById: Record<string, Profile>;
  currentUserId: string | undefined;
  onChanged: () => void;
};

export function ResolutionPanel({
  bet,
  outcomes,
  positions,
  myPosition,
  resolution,
  responses,
  profilesById,
  currentUserId,
  onChanged,
}: Props) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!myPosition || !currentUserId) return null;

  if (bet.status === 'resolved') {
    const outcome = outcomes.find((o) => o.id === resolution?.declared_outcome_id);
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <p className="font-medium text-neutral-900 dark:text-neutral-50">Resolved</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          Winning outcome: {outcome?.label ?? '—'}
        </p>
      </div>
    );
  }

  if (bet.status === 'voided') {
    return (
      <p className="rounded-2xl border border-neutral-200 p-4 text-center text-sm text-neutral-500 dark:border-neutral-800">
        This challenge voided — nobody resolved it in time.
      </p>
    );
  }

  if (bet.status !== 'locked') return null;

  async function runAction(action: Parameters<typeof callResolveBet>[0]) {
    setSubmitting(true);
    setError(null);
    try {
      await callResolveBet(action);
      setDisputing(false);
      setDisputeReason('');
      setSelectedOutcome(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!resolution || resolution.status === 'disputed' || resolution.status === 'void') {
    const disputes = responses.filter((r) => r.response === 'dispute');
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="font-medium text-neutral-900 dark:text-neutral-50">
          {resolution?.status === 'disputed' ? 'Call it again' : 'Entries are closed — who won?'}
        </p>

        {disputes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {disputes.map((r) => (
              <li key={r.id} className="text-sm text-neutral-500">
                {profilesById[r.user_id]?.display_name ?? 'Someone'}: "{r.reason}"
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Outcome">
          {outcomes.map((outcome) => (
            <button
              key={outcome.id}
              type="button"
              role="radio"
              aria-checked={selectedOutcome === outcome.id}
              onClick={() => setSelectedOutcome(outcome.id)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedOutcome === outcome.id
                  ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {outcome.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button
          disabled={!selectedOutcome || submitting}
          onClick={() =>
            selectedOutcome &&
            void runAction({ action: 'declare', betId: bet.id, outcomeId: selectedOutcome })
          }
        >
          {submitting ? 'Calling it…' : 'Call it'}
        </Button>
      </div>
    );
  }

  const declaredOutcome = outcomes.find((o) => o.id === resolution.declared_outcome_id);
  const myResponse = responses.find((r) => r.user_id === currentUserId);
  const confirmCount = responses.filter((r) => r.response === 'confirm').length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="font-medium text-neutral-900 dark:text-neutral-50">
        {profilesById[resolution.declared_by ?? '']?.display_name ?? 'Someone'} called it:{' '}
        {declaredOutcome?.label}
      </p>
      <p className="text-sm text-neutral-500">
        {confirmCount} of {positions.length} confirmed
      </p>

      {myResponse ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {myResponse.response === 'confirm'
            ? "You've confirmed this."
            : `You disputed this: "${myResponse.reason}"`}
        </p>
      ) : disputing ? (
        <div className="flex flex-col gap-2">
          <TextInput
            label="Why do you disagree?"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setDisputing(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              disabled={!disputeReason.trim() || submitting}
              onClick={() =>
                void runAction({ action: 'dispute', betId: bet.id, reason: disputeReason.trim() })
              }
            >
              Submit dispute
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" disabled={submitting} onClick={() => setDisputing(true)}>
            Dispute
          </Button>
          <Button
            disabled={submitting}
            onClick={() => void runAction({ action: 'confirm', betId: bet.id })}
          >
            Confirm
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
