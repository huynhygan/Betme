import { useState } from 'react';
import { StakeKindPicker } from '../StakeKindPicker';
import { TextInput } from '../ui/TextInput';
import { Button } from '../ui/Button';
import { addClause } from '../../lib/queries/clauses';
import type { Enums } from '../../types/database';

type Props = {
  positionId: string;
  onAdded: () => void;
};

export function AddClauseForm({ positionId, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [conditionText, setConditionText] = useState('');
  const [effectKind, setEffectKind] = useState<Enums<'stake_kind'> | null>(null);
  const [effectLabel, setEffectLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    conditionText.trim().length > 0 && effectKind !== null && effectLabel.trim().length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400"
      >
        + Add a clause
      </button>
    );
  }

  async function handleSubmit() {
    if (!canSubmit || !effectKind) return;
    setSubmitting(true);
    setError(null);
    try {
      await addClause({
        positionId,
        conditionText: conditionText.trim(),
        effectKind,
        effectLabel: effectLabel.trim(),
      });
      setConditionText('');
      setEffectKind(null);
      setEffectLabel('');
      setOpen(false);
      onAdded();
    } catch {
      setError('Entries just closed — clauses can only be added while the bet is still open.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">Hedge your stake</p>
      <p className="text-xs text-neutral-500">
        A condition that changes your stake — visible to everyone, and it'll show up in the
        timeline.
      </p>

      <TextInput
        label="If…"
        placeholder="I finish under 4:30"
        maxLength={300}
        value={conditionText}
        onChange={(e) => setConditionText(e.target.value)}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Then…</p>
        <StakeKindPicker value={effectKind} onChange={setEffectKind} />
      </div>

      <TextInput
        label="Describe the effect"
        placeholder="$300 back from my stake"
        maxLength={200}
        value={effectLabel}
        onChange={(e) => setEffectLabel(e.target.value)}
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button disabled={!canSubmit || submitting} onClick={() => void handleSubmit()}>
          {submitting ? 'Adding…' : 'Add clause'}
        </Button>
      </div>
    </div>
  );
}
