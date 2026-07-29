import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomeData, type HomeData } from '../lib/queries/home';
import { getProfilesByIds, type Profile } from '../lib/queries/profiles';
import { Button } from '../components/ui/Button';
import { BetCardSkeleton } from '../components/ui/Skeleton';
import { BetCard } from '../components/home/BetCard';
import { ObligationsList } from '../components/home/ObligationsList';

export default function Home() {
  const { user, profile, signOut } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const homeData = await getHomeData(user.id);
      if (cancelled) return;
      setData(homeData);

      const counterpartIds = new Set<string>();
      for (const s of homeData.obligations) {
        counterpartIds.add(s.owed_by === user.id ? s.owed_to : s.owed_by);
      }
      if (counterpartIds.size > 0) {
        const profiles = await getProfilesByIds([...counterpartIds]);
        if (!cancelled) setProfilesById(Object.fromEntries(profiles.map((p) => [p.id, p])));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Betme
          </h1>
          <p className="text-sm text-neutral-500">
            {profile?.display_name} (@{profile?.handle})
          </p>
        </div>
        {confirmingSignOut ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setConfirmingSignOut(false)}>
              Cancel
            </Button>
            <Button onClick={() => void signOut()}>Sign out</Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingSignOut(true)}
            className="shrink-0 text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            Sign out
          </button>
        )}
      </div>

      <Link to="/new">
        <Button>+ New challenge</Button>
      </Link>

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Your challenges</h2>
        {!data ? (
          <div className="flex flex-col gap-2">
            <BetCardSkeleton />
            <BetCardSkeleton />
          </div>
        ) : data.active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            <p className="mb-3 text-sm text-neutral-500">
              Nothing going yet — challenge a friend to something.
            </p>
            <Link to="/new">
              <Button variant="secondary">Start a challenge</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.active.map((summary) => (
              <BetCard key={summary.bet.id} summary={summary} />
            ))}
          </div>
        )}
      </section>

      {data && data.obligations.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">
            Outstanding obligations
          </h2>
          <ObligationsList
            obligations={data.obligations}
            currentUserId={user?.id ?? ''}
            profilesById={profilesById}
          />
        </section>
      )}

      {data && data.resolvedHistory.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Resolved</h2>
          <div className="flex flex-col gap-2">
            {data.resolvedHistory.map((summary) => (
              <BetCard key={summary.bet.id} summary={summary} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
