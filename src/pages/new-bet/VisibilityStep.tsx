import { VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '../../lib/vocabulary';
import type { Enums } from '../../types/database';
import type { NewBetDraft } from './draft';

type Props = {
  draft: NewBetDraft;
  onChange: (patch: Partial<NewBetDraft>) => void;
};

const OPTIONS: Enums<'bet_visibility'>[] = ['private', 'invite', 'public'];

export function VisibilityStep({ draft, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange({ visibility: option })}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            draft.visibility === option
              ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
        >
          <p className="font-medium">{VISIBILITY_LABELS[option]}</p>
          <p className="mt-0.5 text-sm text-neutral-500">{VISIBILITY_DESCRIPTIONS[option]}</p>
        </button>
      ))}
    </div>
  );
}
