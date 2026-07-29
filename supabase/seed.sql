-- Idempotent seed data for local development.
--
-- Prompt 2 asks for "three test users, one bet with three positions and one
-- clause, and five spectator predictions." Those three users (alice, bob,
-- carol) fill the three positions. A participant cannot also submit a
-- prediction on the same bet (enforced by trigger and RLS), so the five
-- spectator predictions come from five additional accounts — there is no
-- way to get 5 spectator predictions on a 3-person bet using only those 3
-- users without violating that constraint.
--
-- auth.users is seeded directly (bypassing GoTrue) which is fine for local
-- dev seeding but would never happen from application code.

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@betme.test', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'bob@betme.test', '', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'carol@betme.test', '', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'dave@betme.test', '', now(), now(), now()),
  ('55555555-5555-5555-5555-555555555555', 'erin@betme.test', '', now(), now(), now()),
  ('66666666-6666-6666-6666-666666666666', 'frank@betme.test', '', now(), now(), now()),
  ('77777777-7777-7777-7777-777777777777', 'grace@betme.test', '', now(), now(), now()),
  ('88888888-8888-8888-8888-888888888888', 'heidi@betme.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into profiles (id, handle, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'alice', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'bob', 'Bob'),
  ('33333333-3333-3333-3333-333333333333', 'carol', 'Carol'),
  ('44444444-4444-4444-4444-444444444444', 'dave', 'Dave'),
  ('55555555-5555-5555-5555-555555555555', 'erin', 'Erin'),
  ('66666666-6666-6666-6666-666666666666', 'frank', 'Frank'),
  ('77777777-7777-7777-7777-777777777777', 'grace', 'Grace'),
  ('88888888-8888-8888-8888-888888888888', 'heidi', 'Heidi')
on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;

insert into bets (id, creator_id, title, description, status, visibility, resolution_method, locks_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Who gets the fastest Paladin time',
  'Saturday raid night, whoever clears the dungeon fastest wins bragging rights.',
  'open',
  'invite',
  'unanimous',
  now() + interval '2 days'
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  visibility = excluded.visibility,
  resolution_method = excluded.resolution_method,
  locks_at = excluded.locks_at;

insert into outcomes (id, bet_id, label, sort_order)
values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'Alice', 0),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bob', 1),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001', 'Carol', 2)
on conflict (bet_id, sort_order) do update set id = excluded.id, label = excluded.label;

insert into positions (id, bet_id, user_id, outcome_id, stake_kind, stake_label, accepted_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000011',
   'bragging_rights', 'bragging rights for a month', now()),
  ('aaaaaaaa-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000012',
   'food_drink', 'buys the next round', now()),
  ('aaaaaaaa-0000-0000-0000-000000000023', 'aaaaaaaa-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000013',
   'favour', 'does the loser''s laundry for a week', now())
on conflict (bet_id, user_id) do update set
  outcome_id = excluded.outcome_id,
  stake_kind = excluded.stake_kind,
  stake_label = excluded.stake_label,
  accepted_at = excluded.accepted_at;

insert into clauses (id, position_id, condition_text, effect_kind, effect_label)
values (
  'aaaaaaaa-0000-0000-0000-000000000031',
  'aaaaaaaa-0000-0000-0000-000000000021',
  'if Alice disconnects mid-run',
  'bragging_rights',
  'the run doesn''t count and she gets a re-run'
)
on conflict (id) do update set
  condition_text = excluded.condition_text,
  effect_kind = excluded.effect_kind,
  effect_label = excluded.effect_label;

insert into predictions (bet_id, user_id, outcome_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000011'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-0000-0000-0000-000000000011'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'aaaaaaaa-0000-0000-0000-000000000012'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'aaaaaaaa-0000-0000-0000-000000000013'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'aaaaaaaa-0000-0000-0000-000000000013')
on conflict (bet_id, user_id) do update set outcome_id = excluded.outcome_id;
