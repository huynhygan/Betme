# Betme

A social betting app for friend groups. See `CLAUDE.md` for product context,
hard constraints, and vocabulary.

## Stack

React + TypeScript, Vite, Tailwind, Supabase (Postgres + Auth + Realtime),
deployed on Vercel.

## Getting started

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck and build for production
- `npm run typecheck` — typecheck only
- `npm run lint` — ESLint
- `npm run format` — Prettier, writes changes
- `npm run format:check` — Prettier, check only
