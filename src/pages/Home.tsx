import { useAuth } from '../context/AuthContext';
import { Screen, ScreenTitle, ScreenSubtitle } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';

export default function Home() {
  const { profile, signOut } = useAuth();

  return (
    <Screen>
      <ScreenTitle>Betme</ScreenTitle>
      <ScreenSubtitle>
        Signed in as {profile?.display_name} (@{profile?.handle})
      </ScreenSubtitle>
      <Button variant="secondary" onClick={() => void signOut()}>
        Sign out
      </Button>
    </Screen>
  );
}
