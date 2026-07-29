-- Extensions and enums.

-- Betme schema
-- A social betting app for friend groups. See CLAUDE.md for product context
-- and vocabulary. This file is the canonical schema; supabase/migrations/
-- splits it into ordered, forward-only migration files.
--
-- Hard constraints encoded here:
--   * no monetary columns anywhere — stakes are always free text
--   * point_ledger is never writable by the authenticated role
--   * every table has RLS enabled

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists pgcrypto;
-- ============================================================================
-- Enums
-- ============================================================================

create type bet_status as enum ('draft', 'open', 'locked', 'resolved', 'voided');
create type bet_visibility as enum ('private', 'invite', 'public');
create type resolution_method as enum ('unanimous', 'creator', 'majority');
create type stake_kind as enum ('cash_offline', 'food_drink', 'favour', 'item', 'bragging_rights');
create type resolution_status as enum ('pending', 'declared', 'confirmed', 'disputed', 'void');
create type resolution_response_kind as enum ('confirm', 'dispute');
create type bet_event_kind as enum (
  'bet_created',
  'position_accepted',
  'clause_added',
  'bet_locked',
  'outcome_declared',
  'resolution_confirmed',
  'resolution_disputed',
  'stake_settled',
  'message'
);
