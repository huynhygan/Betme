import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getBet,
  getOutcomes,
  getPositions,
  type Bet,
  type Outcome,
  type Position,
} from '../lib/queries/bets';
import { getProfilesByIds, type Profile } from '../lib/queries/profiles';
import { getClausesForPositions, type Clause } from '../lib/queries/clauses';
import { VISIBILITY_LABELS } from '../lib/vocabulary';
import { Screen, ScreenTitle, ScreenSubtitle } from '../components/ui/Screen';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { JoinForm } from '../components/bet-detail/JoinForm';
import { ShareButton } from '../components/bet-detail/ShareButton';
import { ParticipantList } from '../components/bet-detail/ParticipantList';
import { AddClauseForm } from '../components/bet-detail/AddClauseForm';
import { Timeline } from '../components/timeline/Timeline';

type LoadState = 'loading' | 'not-found' | 'loaded';

export default function BetDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const [state, setState] = useState<LoadState>('loading');
  const [bet, setBet] = useState<Bet | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [clausesByPositionId, setClausesByPositionId] = useState<Record<string, Clause[]>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const betRow = await getBet(id!);
        if (!betRow) {
          if (!cancelled) setState('not-found');
          return;
        }
        const [outcomeRows, positionRows] = await Promise.all([
          getOutcomes(id!),
          getPositions(id!),
        ]);
        const [profiles, clauseRows] = await Promise.all([
          getProfilesByIds(positionRows.map((p) => p.user_id)),
          getClausesForPositions(positionRows.map((p) => p.id)),
        ]);
        if (cancelled) return;
        setBet(betRow);
        setOutcomes(outcomeRows);
        setPositions(positionRows);
        setProfilesById(Object.fromEntries(profiles.map((p) => [p.id, p])));
        const grouped: Record<string, Clause[]> = {};
        for (const clause of clauseRows) {
          (grouped[clause.position_id] ??= []).push(clause);
        }
        setClausesByPositionId(grouped);
        setState('loaded');
      } catch {
        if (!cancelled) setState('not-found');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  if (state === 'loading' || authLoading) {
    return (
      <Screen>
        <div className="flex justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </Screen>
    );
  }

  if (state === 'not-found' || !bet) {
    return (
      <Screen>
        <ScreenTitle>Not found</ScreenTitle>
        <ScreenSubtitle>
          This challenge doesn't exist, or you don't have access to it.
        </ScreenSubtitle>
        <Link to="/">
          <Button variant="secondary">Back home</Button>
        </Link>
      </Screen>
    );
  }

  const outcomesById = Object.fromEntries(outcomes.map((o) => [o.id, o]));
  const myPosition = user ? positions.find((p) => p.user_id === user.id) : undefined;
  const isCreator = user?.id === bet.creator_id;
  const isLocked = bet.status !== 'open' || new Date(bet.locks_at).getTime() <= Date.now();
  const canShare = bet.visibility !== 'private';

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <p className="text-sm font-medium text-accent-600">{VISIBILITY_LABELS[bet.visibility]}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        {bet.title}
      </h1>
      {bet.description && (
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">{bet.description}</p>
      )}
      <p className="mt-3 text-sm text-neutral-500">
        {isLocked ? 'Entries closed' : 'Entries close'} {new Date(bet.locks_at).toLocaleString()}
      </p>

      <div className="mt-6 flex gap-2">
        {canShare && <ShareButton betId={bet.id} />}
        {isCreator && (
          <span className="flex items-center text-sm text-neutral-500">You created this</span>
        )}
      </div>

      <div className="mt-8">
        <p className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">
          Who's in ({positions.length})
        </p>
        <ParticipantList
          positions={positions}
          outcomesById={outcomesById}
          profilesById={profilesById}
          clausesByPositionId={clausesByPositionId}
        />
      </div>

      <div className="mt-8">
        {!user ? (
          <div className="rounded-2xl border border-neutral-200 p-4 text-center dark:border-neutral-800">
            <p className="mb-3 text-neutral-600 dark:text-neutral-300">
              Sign in to join this challenge.
            </p>
            <Link to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}>
              <Button>Sign in to join</Button>
            </Link>
          </div>
        ) : myPosition ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-accent-300 bg-accent-50 p-4 dark:border-accent-800 dark:bg-accent-950/40">
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-50">You're in</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                Staked on {outcomesById[myPosition.outcome_id]?.label}: {myPosition.stake_label}
              </p>
            </div>
            {!isLocked && (
              <AddClauseForm
                positionId={myPosition.id}
                onAdded={() => setRefreshKey((k) => k + 1)}
              />
            )}
          </div>
        ) : isLocked ? (
          <p className="rounded-2xl border border-neutral-200 p-4 text-center text-neutral-500 dark:border-neutral-800">
            Entries are closed for this challenge.
          </p>
        ) : (
          <JoinForm
            betId={bet.id}
            userId={user.id}
            outcomes={outcomes}
            onJoined={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </div>

      <div className="mt-8 border-t border-neutral-200 dark:border-neutral-800">
        <Timeline
          betId={bet.id}
          currentUserId={user?.id}
          canMessage={Boolean(myPosition)}
          profilesById={profilesById}
        />
      </div>
    </div>
  );
}
