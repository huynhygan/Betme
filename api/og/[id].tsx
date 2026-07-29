// No project-wide JSX pragma applies to /api (it's bundled separately from
// src), so this imports React explicitly rather than relying on whichever
// JSX transform the bundler defaults to picking.
import React from 'react';
import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';

void React;

export const config = { runtime: 'edge' };

// Deliberately not the VITE_-prefixed vars: those are inlined into the client
// bundle at build time and unavailable here. Edge functions read process.env
// directly, so the same Supabase project URL/anon key need to be set again
// under these names in the Vercel project settings.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const betId = url.pathname.split('/').pop();

  let title = 'Betme';
  let participantCount = 0;

  if (betId && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // RLS applies here exactly as it does for any anon client: a private
    // bet's title never reaches this image for a non-participant, it just
    // falls back to the generic card below.
    const { data: bet } = await supabase.from('bets').select('title').eq('id', betId).maybeSingle();
    if (bet) {
      title = bet.title;
      const { count } = await supabase
        .from('positions')
        .select('id', { count: 'exact', head: true })
        .eq('bet_id', betId);
      participantCount = count ?? 0;
    }
  }

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        backgroundColor: '#161022',
        padding: '80px',
        color: 'white',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 32, color: '#c4b5fd', fontWeight: 600 }}>Betme</div>
      <div
        style={{
          display: 'flex',
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1.2,
          marginTop: 24,
          maxWidth: 1000,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: '#a78bfa', marginTop: 40 }}>
        {participantCount} {participantCount === 1 ? 'person has' : 'people have'} joined
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
