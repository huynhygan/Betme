// Vercel Edge Middleware. This SPA serves the same static index.html for
// every route, so a link crawler (WhatsApp, iMessage, Slack, ...) fetching
// /bet/:id would only ever see the generic app-shell <title>/meta tags — it
// never runs the client JS that would fetch the real bet and update them.
// This intercepts exactly that request, fetches the bet server-side, and
// returns the same index.html with per-bet <meta> tags spliced in before it
// reaches the crawler (or the browser — real users get the same accurate
// tags on first paint, then React takes over normally).
import { createClient } from '@supabase/supabase-js';

export const config = {
  matcher: '/bet/:id',
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const betId = url.pathname.split('/').filter(Boolean).pop();
  if (!betId) return;

  const indexResponse = await fetch(new URL('/index.html', url));
  let html = await indexResponse.text();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const [{ data: bet }, { count: participantCount }] = await Promise.all([
    supabase.from('bets').select('title, description').eq('id', betId).maybeSingle(),
    supabase.from('positions').select('id', { count: 'exact', head: true }).eq('bet_id', betId),
  ]);

  const title = bet ? `${bet.title} — Betme` : 'Betme';
  const count = participantCount ?? 0;
  const description = bet
    ? `${count} ${count === 1 ? 'person has' : 'people have'} joined. Tap to see the challenge and settle it together.`
    : 'A social betting app for friend groups.';
  const imageUrl = new URL(`/api/og/${betId}`, url).toString();
  const pageUrl = url.toString();

  const metaTags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
  ].join('\n    ');

  html = html
    .replace('</head>', `${metaTags}\n  </head>`)
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`);

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
