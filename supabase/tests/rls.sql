-- Stamford Stags: RLS tests (pgTAP). Converted from docs/rls-smoke-test.sql.
--
-- Run against the linked cloud project (no Docker needed):   npm run test:rls
-- Or, where Docker works:                                     npx supabase test db
--
-- Everything runs in one transaction and is rolled back: test auth users, the test
-- registration and every edit below disappear when the run ends.
--
-- Personas use throwaway auth users (*@rls-test.invalid) pointed at seed roster rows
-- inside the transaction, so the tests don't depend on whose real email is in seed.sql.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(59);

-------------------------------------------------------------------------------
-- Fixtures (as postgres)
--   captain  = Team Captain (P01)   uid ...a01
--   player   = J. Chen      (P03)   uid ...a03, linked by the signup trigger
--   stranger = not on roster        uid ...a99
-------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000a01', 'captain@rls-test.invalid'),
  ('aaaaaaaa-0000-0000-0000-000000000a99', 'stranger@rls-test.invalid');

update public.players set user_id = 'aaaaaaaa-0000-0000-0000-000000000a01'
 where id = '11111111-0000-0000-0000-000000000001';

-- Signing up with an email that is on the roster links the player row.
update public.players set user_id = null where id = '11111111-0000-0000-0000-000000000003';
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000a03', 'Player03@Example.com');

select is(
  (select user_id from public.players where id = '11111111-0000-0000-0000-000000000003'),
  'aaaaaaaa-0000-0000-0000-000000000a03'::uuid,
  'link trigger: signing up with a roster email (any case) links the player row');

-------------------------------------------------------------------------------
-- ANON
-------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role anon;

select is((select count(*)::int from players),       0, 'anon: cannot read players');
select is((select count(*)::int from availability),  0, 'anon: cannot read availability');
select is((select count(*)::int from matches),       0, 'anon: cannot read matches');
select is((select count(*)::int from registrations), 0, 'anon: cannot read registrations');
select is((select count(*)::int from rsvp_tokens),   0, 'anon: cannot read rsvp_tokens');
select is((select count(*)::int from news_posts where not is_public), 0, 'anon: cannot see member-only news');

select is((public_team_summary() ->> 'player_count')::int, 14, 'anon: public_team_summary() returns player_count');
select is((public_team_summary() ->> 'open_spots')::int,    2, 'anon: public_team_summary() returns open_spots');
select ok((select count(*) from public_schedule()) > 0, 'anon: public_schedule() returns rows');
select ok(not exists (select 1 from public_schedule() where title in ('Team practice', 'Playoff roster deadline')),
  'anon: public_schedule() hides private events');

select lives_ok(
  $$insert into registrations (full_name, email) values ('Test Person', 't@rls-test.invalid')$$,
  'anon: can submit a pending registration');
select throws_ok(
  $$insert into registrations (full_name, email, status) values ('Sneaky', 's@rls-test.invalid', 'invited')$$,
  '42501', null,
  'anon: cannot submit an already-approved registration');
select throws_ok(
  $$select set_my_availability('33333333-0000-0000-0000-000000000004', 'available')$$,
  '42501', null,
  'anon: cannot set availability');

-------------------------------------------------------------------------------
-- STRANGER (signed in, not on the roster)
-------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a99', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a99","role":"authenticated"}', true);
set local role authenticated;

select is(is_member(), false, 'stranger: is_member() is false');
select is((select count(*)::int from players),       0, 'stranger: cannot read players');
select is((select count(*)::int from matches),       0, 'stranger: cannot read matches');
select is((select count(*)::int from availability),  0, 'stranger: cannot read availability');
select is((select count(*)::int from registrations), 0, 'stranger: cannot read registrations');
select is((select count(*)::int from messages),      0, 'stranger: cannot read messages');
select throws_ok(
  $$select set_my_availability('33333333-0000-0000-0000-000000000004', 'available')$$,
  '42501', null,
  'stranger: cannot set availability');

-------------------------------------------------------------------------------
-- PLAYER (J. Chen)
-------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a03', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select is(is_member(),  true,  'player: is_member() is true');
select is(is_captain(), false, 'player: is_captain() is false');
select is((select count(*)::int from players),       14, 'player: reads the whole roster');
select is((select count(*)::int from registrations),  0, 'player: cannot read registrations');
select is((select count(*)::int from rsvp_tokens),    0, 'player: cannot read rsvp_tokens');

-- Availability: own row via RPC, nobody else's.
select lives_ok(
  $$select set_my_availability('33333333-0000-0000-0000-000000000004', 'available')$$,
  'player: set_my_availability() works');
select is(
  (select status::text from availability
    where match_id = '33333333-0000-0000-0000-000000000004' and player_id = '11111111-0000-0000-0000-000000000003'),
  'available', 'player: own availability row was written');
select throws_ok(
  $$insert into availability (match_id, player_id, status)
    values ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000010', 'unavailable')$$,
  '42501', null,
  'player: cannot insert availability for another player');
update availability set status = 'unavailable'
 where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000001';
select is(
  (select status::text from availability
    where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000001'),
  'available', 'player: cannot update another player''s availability');

-- Lineups: no direct writes, only set_my_rsvp().
update lineup_slots set rsvp = 'declined'
 where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000009';
select is(
  (select rsvp::text from lineup_slots
    where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000009'),
  'pending', 'player: cannot update another player''s lineup slot directly');
update lineup_slots set rsvp = 'declined'
 where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000003';
select is(
  (select rsvp::text from lineup_slots
    where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000003'),
  'confirmed', 'player: cannot update own lineup slot directly');
select lives_ok(
  $$select set_my_rsvp('33333333-0000-0000-0000-000000000003', 'declined')$$,
  'player: set_my_rsvp() works');
select is(
  (select rsvp::text from lineup_slots
    where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000003'),
  'declined', 'player: set_my_rsvp() updated own slot');
select throws_ok(
  $$select set_my_rsvp('33333333-0000-0000-0000-000000000004', 'confirmed')$$,
  'P0002', null,
  'player: set_my_rsvp() rejects a match they are not in the lineup for');

-- Matches and profile.
select throws_ok(
  $$insert into matches (season_id, opponent, starts_at, home_away)
    values ('22222222-0000-0000-0000-000000000001', 'Nope', now() + interval '30 days', 'home')$$,
  '42501', null,
  'player: cannot create matches');
update players set role = 'captain' where id = '11111111-0000-0000-0000-000000000003';
select is(
  (select role::text from players where id = '11111111-0000-0000-0000-000000000003'),
  'player', 'player: cannot promote themselves');
select lives_ok(
  $$select update_my_profile('(203) 555-9999', 'both')$$,
  'player: update_my_profile() works');
select is(
  (select phone from players where id = '11111111-0000-0000-0000-000000000003'),
  '(203) 555-9999', 'player: update_my_profile() changed own phone');

-- Messages and records.
select is((select count(*)::int from messages), 2, 'player: reads the messages they received');
select is(
  (select count(*)::int from message_recipients where player_id <> '11111111-0000-0000-0000-000000000003'),
  0, 'player: reads only their own message_recipients rows');
select is(
  (select wins || '-' || losses from player_records where player_id = '11111111-0000-0000-0000-000000000002'),
  '1-0', 'player: player_records shows M. Alvarez 1-0');

-------------------------------------------------------------------------------
-- CAPTAIN
-------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a01', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a01","role":"authenticated"}', true);
set local role authenticated;

select is(is_captain(), true, 'captain: is_captain() is true');
select ok(exists (select 1 from registrations where email = 't@rls-test.invalid'),
  'captain: reads the registration anon submitted');
select lives_ok(
  $$update registrations set status = 'invited' where email = 't@rls-test.invalid'$$,
  'captain: can approve a registration');
select is((select count(*)::int from messages),    2, 'captain: reads all messages');
select is((select count(*)::int from rsvp_tokens), 0, 'captain: cannot read rsvp_tokens (service role only)');

-- Manage matches.
update matches set captain_notes = 'Updated by captain' where id = '33333333-0000-0000-0000-000000000003';
select is(
  (select captain_notes from matches where id = '33333333-0000-0000-0000-000000000003'),
  'Updated by captain', 'captain: can update a match');
select lives_ok(
  $$insert into matches (id, season_id, opponent, starts_at, home_away)
    values ('33333333-0000-0000-0000-0000000000ff', '22222222-0000-0000-0000-000000000001',
            'RLS Test Opponent', now() + interval '30 days', 'home')$$,
  'captain: can create a match');
select lives_ok(
  $$delete from matches where id = '33333333-0000-0000-0000-0000000000ff'$$,
  'captain: can delete a match');
select is((select count(*)::int from matches where id = '33333333-0000-0000-0000-0000000000ff'), 0,
  'captain: deleted match is gone');
update lineup_slots set court_label = 'Ct 9'
 where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000009';
select is(
  (select court_label from lineup_slots
    where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000009'),
  'Ct 9', 'captain: can edit lineup slots directly');

-- Eligibility and availability summary.
select is((select count(*)::int from eligible_players('33333333-0000-0000-0000-000000000003')), 14,
  'captain: eligible_players() lists every active player');
select is(
  (select rating_ok from eligible_players('33333333-0000-0000-0000-000000000003')
    where player_id = '11111111-0000-0000-0000-000000000014'),
  false, 'captain: eligible_players() flags the 4.0 player (H. Lund) as over level');
select is(
  (select row(players_needed, available, maybe, unavailable, no_response)::text
     from match_availability_summary where match_id = '33333333-0000-0000-0000-000000000003'),
  '(8,9,2,1,2)', 'captain: Norwalk summary = needed 8 / available 9 / maybe 2 / out 1 / no response 2');

-- Adding a roster row for an existing account links it, and that makes them a member.
select lives_ok(
  $$insert into players (full_name, email) values ('New Stranger', 'Stranger@rls-test.invalid')$$,
  'captain: can add a player');
select is(
  (select user_id from players where email = 'Stranger@rls-test.invalid'),
  'aaaaaaaa-0000-0000-0000-000000000a99'::uuid,
  'link trigger: adding a roster row links an existing account by email');

-- Deactivating a player removes their access.
update players set is_active = false where id = '11111111-0000-0000-0000-000000000003';

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a99', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a99","role":"authenticated"}', true);
set local role authenticated;
select is(is_member(), true, 'stranger: becomes a member once added to the roster');

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a03', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a03","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from players), 0, 'deactivated player: loses access to the roster');

-------------------------------------------------------------------------------
reset role;
select * from finish();
rollback;
