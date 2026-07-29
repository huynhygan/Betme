import { StakeKindPicker } from '../../components/StakeKindPicker';
import { TextInput } from '../../components/ui/TextInput';
import { resolveLocksAt } from '../../lib/lockTime';
import { RESOLUTION_METHOD_LABELS, VISIBILITY_LABELS } from '../../lib/vocabulary';
import type { NewBetDraft } from './draft';

type Props = {
  draft: NewBetDraft;
  onChange: (patch: Partial<NewBetDraft>) => void;
};

export function ReviewStep({ draft, onChange }: Props) {
  const locksAt = draft.lockOption ? resolveLocksAt(draft.lockOption, draft.customLocksAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <p className="font-medium text-neutral-900 dark:text-neutral-50">{draft.title}</p>
        <dl className="mt-3 space-y-1.5 text-neutral-500">
          <div className="flex justify-between">
            <dt>Outcomes</dt>
            <dd>{draft.outcomes.filter((o) => o.trim()).join(', ')}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Closes</dt>
            <dd>{locksAt ? locksAt.toLocaleString() : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Visibility</dt>
            <dd>{draft.visibility ? VISIBILITY_LABELS[draft.visibility] : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Resolution</dt>
            <dd>{RESOLUTION_METHOD_LABELS[draft.resolutionMethod]}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="mb-2 font-medium text-neutral-900 dark:text-neutral-50">
          Now put yourself in it
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Your outcome">
          {draft.outcomes.map((outcome, index) => (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={draft.stakeOutcomeIndex === index}
              onClick={() => onChange({ stakeOutcomeIndex: index })}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                draft.stakeOutcomeIndex === index
                  ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {outcome || `Outcome ${index + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          What are you staking?
        </p>
        <StakeKindPicker
          value={draft.stakeKind}
          onChange={(kind) => onChange({ stakeKind: kind })}
        />
      </div>

      <TextInput
        label="Describe your stake"
        placeholder="Loser buys dinner"
        maxLength={200}
        value={draft.stakeLabel}
        onChange={(e) => onChange({ stakeLabel: e.target.value })}
      />
    </div>
  );
}
