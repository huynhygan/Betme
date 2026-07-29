import { useEffect, useRef } from 'react';
import { useTimeline } from '../../hooks/useTimeline';
import type { Profile } from '../../lib/queries/profiles';
import { Skeleton } from '../ui/Skeleton';
import { EventRow } from './EventRow';
import { MessageComposer } from './MessageComposer';

type Props = {
  betId: string;
  currentUserId: string | undefined;
  canMessage: boolean;
  profilesById: Record<string, Profile>;
};

export function Timeline({ betId, currentUserId, canMessage, profilesById }: Props) {
  const { events, reactions, loading, sendMessage, toggleReaction } = useTimeline(
    betId,
    currentUserId,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [events.length]);

  return (
    <div className="flex flex-col">
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Timeline"
        className="flex flex-col gap-3 py-4"
      >
        {loading && (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="mx-auto h-3 w-40" />
            <Skeleton className="h-10 w-3/4 self-start rounded-2xl" />
            <Skeleton className="h-10 w-2/3 self-end rounded-2xl" />
          </div>
        )}
        {!loading && events.length === 0 && (
          <p className="text-center text-sm text-neutral-400">
            Nothing yet — be the first to say something.
          </p>
        )}
        {events.map((event) => (
          <div key={event.id} className="group">
            <EventRow
              event={event}
              reactions={reactions}
              profilesById={profilesById}
              currentUserId={currentUserId}
              onToggleReaction={toggleReaction}
            />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canMessage && currentUserId && <MessageComposer onSend={(body) => void sendMessage(body)} />}
    </div>
  );
}
