// Centralised user-facing copy for enum values. Keeping it in one place
// makes the CLAUDE.md vocabulary check (no "wager"/"odds"/"payout") a single
// file to audit instead of a grep across every component.
import type { Enums } from '../types/database';

export const STAKE_KIND_LABELS: Record<Enums<'stake_kind'>, string> = {
  cash_offline: 'Cash (settled offline)',
  food_drink: 'Food or drink',
  favour: 'Favour',
  item: 'Item',
  bragging_rights: 'Bragging rights',
};

export const STAKE_KIND_ORDER: Enums<'stake_kind'>[] = [
  'cash_offline',
  'food_drink',
  'favour',
  'item',
  'bragging_rights',
];

export const VISIBILITY_LABELS: Record<Enums<'bet_visibility'>, string> = {
  private: 'Private',
  invite: 'Invite-only',
  public: 'Public',
};

export const VISIBILITY_DESCRIPTIONS: Record<Enums<'bet_visibility'>, string> = {
  private: 'Only people you add can see this challenge.',
  invite: 'Anyone with the link can see it and join.',
  public: 'Anyone with the link can see it, join, and follow along.',
};

export const RESOLUTION_METHOD_LABELS: Record<Enums<'resolution_method'>, string> = {
  unanimous: 'Everyone has to agree',
  creator: "I'll call it",
  majority: 'Majority decides',
};

export const RESOLUTION_METHOD_DESCRIPTIONS: Record<Enums<'resolution_method'>, string> = {
  unanimous:
    'Nobody can dispute the outcome once everyone confirms it. The safest choice — nobody can be outvoted or overruled.',
  creator:
    'You confirm the outcome yourself. Fast, but only fair if everyone trusts you to call it straight.',
  majority: 'More than half of participants confirming locks it in, even if a few disagree.',
};
