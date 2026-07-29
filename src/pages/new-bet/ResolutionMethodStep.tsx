import { RESOLUTION_METHOD_DESCRIPTIONS, RESOLUTION_METHOD_LABELS } from '../../lib/vocabulary';
import type { Enums } from '../../types/database';
import type { NewBetDraft } from './draft';

type Props = {
  draft: NewBetDraft;
  onChange: (patch: Partial<NewBetDraft>) => void;
};

const OPTIONS: Enums<'resolution_method'>[] = ['unanimous', 'creator', 'majority'];

export function ResolutionMethodStep({ draft, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange({ resolutionMethod: option })}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            draft.resolutionMethod === option
              ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="font-medium">{RESOLUTION_METHOD_LABELS[option]}</p>
            {option === 'unanimous' && (
              <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-900 dark:text-accent-300">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            {RESOLUTION_METHOD_DESCRIPTIONS[option]}
          </p>
        </button>
      ))}
    </div>
  );
}
