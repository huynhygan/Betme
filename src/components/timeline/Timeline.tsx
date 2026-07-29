import { useEffect, useRef } from 'react';
import { useTimeline } from '../../hooks/useTimeline';
import type { Profile } from '../../lib/queries/profiles';
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
      <div className="flex flex-col gap-3 py-4">
        {loading && <p className="text-center text-sm text-neutral-400">Loading timeline…</p>}
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
