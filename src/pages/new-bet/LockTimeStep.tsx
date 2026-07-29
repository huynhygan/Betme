import { useEffect, useState } from 'react';
import { LOCK_OPTION_LABELS, computeQuickLocksAt, type LockOption } from '../../lib/lockTime';
import type { NewBetDraft } from './draft';

type Props = {
  draft: NewBetDraft;
  onChange: (patch: Partial<NewBetDraft>) => void;
};

const QUICK_OPTIONS: Exclude<LockOption, 'custom'>[] = ['1_hour', 'tonight', 'tomorrow'];

function formatPreview(option: Exclude<LockOption, 'custom'>): string {
  return computeQuickLocksAt(option).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function LockTimeStep({ draft, onChange }: Props) {
  // Date.now() can't be read directly during render (impure) — resolve the
  // native datetime-local picker's floor in an effect instead.
  const [nowLocalMin, setNowLocalMin] = useState('');
  useEffect(() => {
    setNowLocalMin(new Date(Date.now() + 60_000).toISOString().slice(0, 16));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {QUICK_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange({ lockOption: option })}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
            draft.lockOption === option
              ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
        >
          <span className="font-medium">{LOCK_OPTION_LABELS[option]}</span>
          <span className="text-sm text-neutral-500">{formatPreview(option)}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange({ lockOption: 'custom' })}
        className={`rounded-xl border px-4 py-3 text-left font-medium transition-colors ${
          draft.lockOption === 'custom'
            ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
            : 'border-neutral-300 dark:border-neutral-700'
        }`}
      >
        {LOCK_OPTION_LABELS.custom}
      </button>

      {draft.lockOption === 'custom' && (
        <input
          type="datetime-local"
          aria-label="Custom lock time"
          min={nowLocalMin}
          value={draft.customLocksAt}
          onChange={(e) => onChange({ customLocksAt: e.target.value })}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      )}

      <p className="mt-1 text-sm text-neutral-500">
        Entries close at this time — nobody can join or change their stake after.
      </p>
    </div>
  );
}
