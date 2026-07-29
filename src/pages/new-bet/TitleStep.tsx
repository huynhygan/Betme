import type { NewBetDraft } from './draft';

type Props = {
  draft: NewBetDraft;
  onChange: (patch: Partial<NewBetDraft>) => void;
};

export function TitleStep({ draft, onChange }: Props) {
  return (
    <div>
      <textarea
        autoFocus
        rows={3}
        maxLength={200}
        placeholder="Who gets the fastest Paladin time?"
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        className="w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-lg outline-none focus:border-accent-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <p className="mt-2 text-right text-sm text-neutral-400">{draft.title.length}/200</p>
    </div>
  );
}
