import { useState } from 'react';
import type { Reaction } from '../../lib/queries/events';

const QUICK_EMOJI = ['👍', '😂', '🔥', '😮', '❤️'];

type Props = {
  eventId: string;
  reactions: Reaction[];
  currentUserId: string | undefined;
  onToggle: (eventId: string, emoji: string) => void;
};

export function ReactionBar({ eventId, reactions, currentUserId, onToggle }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const eventReactions = reactions.filter((r) => r.event_id === eventId);
  const counts = new Map<string, number>();
  for (const r of eventReactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);

  if (!currentUserId) {
    if (counts.size === 0) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {[...counts.entries()].map(([emoji, count]) => (
          <span
            key={emoji}
            className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs dark:border-neutral-700"
          >
            {emoji} {count}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {[...counts.entries()].map(([emoji, count]) => {
        const iReacted = eventReactions.some(
          (r) => r.emoji === emoji && r.user_id === currentUserId,
        );
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(eventId, emoji)}
            aria-pressed={iReacted}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              iReacted
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
                : 'border-neutral-200 dark:border-neutral-700'
            }`}
          >
            {emoji} {count}
          </button>
        );
      })}

      {pickerOpen ? (
        <div className="flex items-center gap-1 rounded-full border border-neutral-200 px-1 dark:border-neutral-700">
          {QUICK_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onToggle(eventId, emoji);
                setPickerOpen(false);
              }}
              aria-label={`React with ${emoji}`}
              className="rounded-full px-1 py-0.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`rounded-full px-1.5 py-0.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ${
            counts.size === 0
              ? 'opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100'
              : ''
          }`}
        >
          {counts.size === 0 ? 'React' : '+'}
        </button>
      )}
    </div>
  );
}
