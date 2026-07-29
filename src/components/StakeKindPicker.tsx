import { STAKE_KIND_LABELS, STAKE_KIND_ORDER } from '../lib/vocabulary';
import type { Enums } from '../types/database';

type Props = {
  value: Enums<'stake_kind'> | null;
  onChange: (kind: Enums<'stake_kind'>) => void;
};

export function StakeKindPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stake kind">
      {STAKE_KIND_ORDER.map((kind) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          onClick={() => onChange(kind)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            value === kind
              ? 'border-accent-500 bg-accent-600 text-white'
              : 'border-neutral-300 text-neutral-600 hover:border-accent-400 dark:border-neutral-700 dark:text-neutral-300'
          }`}
        >
          {STAKE_KIND_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}
