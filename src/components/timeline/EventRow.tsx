import type { TimelineEvent } from '../../hooks/useTimeline';
import type { Reaction } from '../../lib/queries/events';
import type { Profile } from '../../lib/queries/profiles';
import { describeSystemEvent } from '../../lib/timelineCopy';
import { ReactionBar } from './ReactionBar';

type Props = {
  event: TimelineEvent;
  reactions: Reaction[];
  profilesById: Record<string, Profile>;
  currentUserId: string | undefined;
  onToggleReaction: (eventId: string, emoji: string) => void;
};

export function EventRow({
  event,
  reactions,
  profilesById,
  currentUserId,
  onToggleReaction,
}: Props) {
  if (event.kind === 'message') {
    const isMine = event.actor_id === currentUserId;
    const author = event.actor_id
      ? (profilesById[event.actor_id]?.display_name ?? 'Someone')
      : 'Someone';

    return (
      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
            isMine ? 'bg-accent-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800'
          } ${event._pending ? 'opacity-60' : ''}`}
        >
          {!isMine && <p className="mb-0.5 text-xs font-medium opacity-70">{author}</p>}
          <p className="whitespace-pre-wrap break-words text-sm">{event.body}</p>
        </div>
        {event._failed && <p className="mt-1 text-xs text-red-500">Failed to send — try again</p>}
        <ReactionBar
          eventId={event.id}
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
        />
      </div>
    );
  }

  const { icon, text } = describeSystemEvent(event, profilesById);
  return (
    <div className="flex flex-col items-center gap-1 py-1 text-center">
      <p className="text-xs text-neutral-500">
        <span className="mr-1" aria-hidden="true">
          {icon}
        </span>
        {text}
      </p>
      <ReactionBar
        eventId={event.id}
        reactions={reactions}
        currentUserId={currentUserId}
        onToggle={onToggleReaction}
      />
    </div>
  );
}
