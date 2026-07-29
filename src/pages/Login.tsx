import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Screen, ScreenTitle, ScreenSubtitle } from '../components/ui/Screen';
import { TextInput } from '../components/ui/TextInput';
import { Button } from '../components/ui/Button';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const redirect = searchParams.get('redirect') ?? '/';
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('redirect', redirect);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    if (signInError) {
      setError(signInError.message);
      setStatus('error');
      return;
    }
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <Screen>
        <ScreenTitle>Check your email</ScreenTitle>
        <ScreenSubtitle>
          We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on this
          device to continue.
        </ScreenSubtitle>
        <Button variant="secondary" onClick={() => setStatus('idle')}>
          Use a different email
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle>Betme</ScreenTitle>
      <ScreenSubtitle>Challenge your friends. Settle it together.</ScreenSubtitle>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={status === 'error' ? (error ?? undefined) : undefined}
        />
        <Button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
        </Button>
      </form>
    </Screen>
  );
}
