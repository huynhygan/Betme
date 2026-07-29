import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { isHandleAvailable, createProfile } from '../lib/queries/profiles';
import { Screen, ScreenTitle, ScreenSubtitle } from '../components/ui/Screen';
import { TextInput } from '../components/ui/TextInput';
import { Button } from '../components/ui/Button';

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [handleAvailability, setHandleAvailability] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');

  const debouncedHandle = useDebounce(handle, 400);
  const handleIsValidFormat = HANDLE_PATTERN.test(debouncedHandle);

  useEffect(() => {
    if (!handleIsValidFormat) {
      setHandleAvailability('idle');
      return;
    }
    let cancelled = false;
    setHandleAvailability('checking');
    isHandleAvailable(debouncedHandle)
      .then((available) => {
        if (!cancelled) setHandleAvailability(available ? 'available' : 'taken');
      })
      .catch(() => {
        if (!cancelled) setHandleAvailability('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedHandle, handleIsValidFormat]);

  const handleFormatError =
    handle.length > 0 && !HANDLE_PATTERN.test(handle)
      ? 'Lowercase letters, numbers, underscores only. 3–20 characters.'
      : handleAvailability === 'taken'
        ? 'That handle is already taken.'
        : undefined;

  const canSubmit =
    HANDLE_PATTERN.test(handle) &&
    handleAvailability === 'available' &&
    displayName.trim().length > 0 &&
    !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createProfile({ id: user.id, handle, display_name: displayName.trim() });
      await refreshProfile();
      navigate(searchParams.get('redirect') ?? '/', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle>Pick a handle</ScreenTitle>
      <ScreenSubtitle>This is how your friends will find and mention you.</ScreenSubtitle>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextInput
          label="Handle"
          required
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
          error={handleFormatError}
          hint={
            !handleFormatError && handleAvailability === 'checking'
              ? 'Checking availability…'
              : !handleFormatError && handleAvailability === 'available'
                ? 'Available'
                : 'lowercase letters, numbers, underscores — 3 to 20 characters'
          }
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <TextInput
          label="Display name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </Screen>
  );
}
