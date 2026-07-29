import { useState } from 'react';
import { StakeKindPicker } from '../StakeKindPicker';
import { TextInput } from '../ui/TextInput';
import { Button } from '../ui/Button';
import { addPosition, type Outcome } from '../../lib/queries/bets';
import type { Enums } from '../../types/database';

type Props = {
  betId: string;
  userId: string;
  outcomes: Outcome[];
  onJoined: () => void;
};

export function JoinForm({ betId, userId, outcomes, onJoined }: Props) {
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [stakeKind, setStakeKind] = useState<Enums<'stake_kind'> | null>(null);
  const [stakeLabel, setStakeLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = outcomeId !== null && stakeKind !== null && stakeLabel.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || !outcomeId || !stakeKind) return;
    setSubmitting(true);
    setError(null);
    try {
      await addPosition({ betId, userId, outcomeId, stakeKind, stakeLabel: stakeLabel.trim() });
      onJoined();
    } catch {
      setError('Entries just closed — this challenge locked while you were choosing.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="font-medium text-neutral-900 dark:text-neutral-50">Join this challenge</p>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Pick your outcome
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Outcome">
          {outcomes.map((outcome) => (
            <button
              key={outcome.id}
              type="button"
              role="radio"
              aria-checked={outcomeId === outcome.id}
              onClick={() => setOutcomeId(outcome.id)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                outcomeId === outcome.id
                  ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {outcome.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          What are you staking?
        </p>
        <StakeKindPicker value={stakeKind} onChange={setStakeKind} />
      </div>

      <TextInput
        label="Describe your stake"
        placeholder="Loser buys dinner"
        maxLength={200}
        value={stakeLabel}
        onChange={(e) => setStakeLabel(e.target.value)}
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Button disabled={!canSubmit || submitting} onClick={() => void handleSubmit()}>
        {submitting ? 'Joining…' : 'Confirm'}
      </Button>
    </div>
  );
}
