import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Screen, ScreenTitle, ScreenSubtitle } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

function readLinkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  return hash.get('error_description') ?? search.get('error_description');
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, loading } = useAuth();
  const [linkError, setLinkError] = useState<string | null>(() => readLinkError());

  useEffect(() => {
    if (linkError || loading) return;

    // Give supabase-js a tick to finish parsing the URL into a session on
    // first load before deciding there's nothing here.
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session && !user) {
        setLinkError('This link is invalid or has expired.');
        return;
      }
      const redirect = searchParams.get('redirect') ?? '/';
      navigate(profile ? redirect : '/onboarding', { replace: true });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [linkError, loading, user, profile, navigate, searchParams]);

  if (linkError) {
    return (
      <Screen>
        <ScreenTitle>Link expired</ScreenTitle>
        <ScreenSubtitle>{linkError}</ScreenSubtitle>
        <Button onClick={() => navigate('/login', { replace: true })}>Back to sign in</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8" />
        <p className="text-neutral-500">Signing you in…</p>
      </div>
    </Screen>
  );
}
