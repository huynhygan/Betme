import { useState } from 'react';
import { Button } from '../ui/Button';

export function ShareButton({ betId }: { betId: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/bet/${betId}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        return;
      } catch {
        // user cancelled the native share sheet — fall through to copy
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="secondary" onClick={() => void handleShare()}>
      {copied ? 'Link copied' : 'Share'}
    </Button>
  );
}
