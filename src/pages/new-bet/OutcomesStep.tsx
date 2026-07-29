import type { NewBetDraft } from './draft';

type Props = {
  draft: NewBetDraft;
  onChange: (patch: Partial<NewBetDraft>) => void;
};

const MAX_OUTCOMES = 8;
const MIN_OUTCOMES = 2;

export function OutcomesStep({ draft, onChange }: Props) {
  function updateOutcome(index: number, value: string) {
    const next = [...draft.outcomes];
    next[index] = value;
    onChange({ outcomes: next });
  }

  function addOutcome() {
    if (draft.outcomes.length >= MAX_OUTCOMES) return;
    onChange({ outcomes: [...draft.outcomes, ''] });
  }

  function removeOutcome(index: number) {
    if (draft.outcomes.length <= MIN_OUTCOMES) return;
    onChange({ outcomes: draft.outcomes.filter((_, i) => i !== index) });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.outcomes.length) return;
    const next = [...draft.outcomes];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ outcomes: next });
  }

  return (
    <div className="flex flex-col gap-3">
      {draft.outcomes.map((outcome, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex flex-col">
            <button
              type="button"
              aria-label={`Move outcome ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="text-neutral-400 hover:text-neutral-700 disabled:opacity-25 dark:hover:text-neutral-200"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={`Move outcome ${index + 1} down`}
              disabled={index === draft.outcomes.length - 1}
              onClick={() => move(index, 1)}
              className="text-neutral-400 hover:text-neutral-700 disabled:opacity-25 dark:hover:text-neutral-200"
            >
              ▼
            </button>
          </div>
          <input
            aria-label={`Outcome ${index + 1}`}
            value={outcome}
            maxLength={100}
            placeholder={`Outcome ${index + 1}`}
            onChange={(e) => updateOutcome(index, e.target.value)}
            className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="button"
            aria-label={`Remove outcome ${index + 1}`}
            disabled={draft.outcomes.length <= MIN_OUTCOMES}
            onClick={() => removeOutcome(index)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-red-500 disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        disabled={draft.outcomes.length >= MAX_OUTCOMES}
        onClick={addOutcome}
        className="mt-1 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-500 hover:border-accent-400 hover:text-accent-600 disabled:opacity-40 dark:border-neutral-700"
      >
        + Add outcome
      </button>
      <p className="text-sm text-neutral-400">{draft.outcomes.length}/8 outcomes</p>
    </div>
  );
}
