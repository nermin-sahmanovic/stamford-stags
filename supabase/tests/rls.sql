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

select plan(195);

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

-- RSVP tokens for New Canaan (match 5): a live one for P06 and an expired one for M. Alvarez (P02).
insert into public.rsvp_tokens (token, player_id, match_id, expires_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000006',
   '33333333-0000-0000-0000-000000000005', now() + interval '20 days'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002',
   '33333333-0000-0000-0000-000000000005', now() - interval '1 minute');

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
select throws_ok(
  $$select apply_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001', 'available')$$,
  '42501', null, 'anon: cannot call apply_rsvp_token() (service role only)');
select throws_ok(
  $$select peek_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon: cannot call peek_rsvp_token() (service role only)');
select is((select count(*)::int from news_posts where not is_public), 0, 'anon: cannot see member-only news');

select is((public_team_summary() ->> 'player_count')::int, 14, 'anon: public_team_summary() returns player_count');
select is((public_team_summary() ->> 'open_spots')::int,    2, 'anon: public_team_summary() returns open_spots');
select ok((select count(*) from public_calendar()) > 0, 'anon: public_calendar() returns rows');
select ok(not exists (select 1 from public_calendar() where title in ('Team practice', 'Playoff roster deadline')),
  'anon: public_calendar() hides private events');

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

-- Lineups are visible only once published (lineup_published_at).
reset role;
update matches set lineup_published_at = null where id = '33333333-0000-0000-0000-000000000003';
set local role authenticated;
select is((select count(*)::int from lineup_slots where match_id = '33333333-0000-0000-0000-000000000003'), 0,
  'player: cannot read an unpublished lineup');
reset role;
update matches set lineup_published_at = now() where id = '33333333-0000-0000-0000-000000000003';
set local role authenticated;
select is((select count(*)::int from lineup_slots where match_id = '33333333-0000-0000-0000-000000000003'), 7,
  'player: reads a published lineup');
update matches set lineup_published_at = null where id = '33333333-0000-0000-0000-000000000003';
select ok((select lineup_published_at is not null from matches where id = '33333333-0000-0000-0000-000000000003'),
  'player: cannot unpublish a lineup');

-- Checklist and results are captain-only writes.
select throws_ok(
  $$insert into checklist_items (match_id, label) values ('33333333-0000-0000-0000-000000000003', 'Nope')$$,
  '42501', null,
  'player: cannot add checklist items');
update checklist_items set done = true
 where match_id = '33333333-0000-0000-0000-000000000003' and label = 'Scorecards printed';
select is(
  (select done from checklist_items
    where match_id = '33333333-0000-0000-0000-000000000003' and label = 'Scorecards printed'),
  false, 'player: cannot tick checklist items');
select throws_ok(
  $$insert into line_results (match_id, line_type, line_number, won)
    values ('33333333-0000-0000-0000-000000000003', 'singles', 1, true)$$,
  '42501', null,
  'player: cannot enter results');

-- Clearing an answer deletes your own row only.
select lives_ok(
  $$delete from availability
     where match_id = '33333333-0000-0000-0000-000000000004' and player_id = '11111111-0000-0000-0000-000000000003'$$,
  'player: can clear own availability');
select is(
  (select count(*)::int from availability
    where match_id = '33333333-0000-0000-0000-000000000004' and player_id = '11111111-0000-0000-0000-000000000003'),
  0, 'player: own availability row is gone');
delete from availability
 where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from availability
    where match_id = '33333333-0000-0000-0000-000000000003' and player_id = '11111111-0000-0000-0000-000000000001'),
  1, 'player: cannot clear another player''s availability');

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
select is(
  (select position_pref::text from players where id = '11111111-0000-0000-0000-000000000003'),
  'both', 'player: update_my_profile() changed own position');
update players set ntrp_rating = 5.0 where id = '11111111-0000-0000-0000-000000000003';
select is(
  (select ntrp_rating from players where id = '11111111-0000-0000-0000-000000000003'),
  3.5, 'player: cannot change own rating directly');
select throws_ok(
  $$select * from import_players('[{"full_name":"Sneaky","email":"sneaky@rls-test.invalid"}]')$$,
  '42501', null,
  'player: cannot import players');

-- Messages and records.
select is((select count(*)::int from messages where id::text like '44444444-%'), 2, 'player: reads the seeded messages they received');
select is(
  (select count(*)::int from messages m where not exists (
     select 1 from message_recipients r where r.message_id = m.id and r.player_id = '11111111-0000-0000-0000-000000000003')),
  0, 'player: sees no message they did not receive');
select throws_ok(
  $$select apply_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001', 'available')$$,
  '42501', null, 'player: cannot call apply_rsvp_token() directly');
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
select is((select count(*)::int from messages where id::text like '44444444-%'), 2, 'captain: reads all seeded messages');
select is((select count(*)::int from rsvp_tokens), 0, 'captain: cannot read rsvp_tokens (service role only)');
select throws_ok(
  $$insert into messages (audience, subject, body) values ('team', 'Direct insert', 'Should fail')$$,
  '42501', null, 'captain: cannot write messages directly (service role only)');
select throws_ok(
  $$select * from issue_rsvp_tokens('33333333-0000-0000-0000-000000000005', array['11111111-0000-0000-0000-000000000004'::uuid])$$,
  '42501', null, 'captain: cannot call issue_rsvp_tokens() (service role only)');

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
  '(7,9,2,1,2)', 'captain: Norwalk summary = needed 7 / available 9 / maybe 2 / out 1 / no response 2');
select is(
  (select roster_size::int from match_availability_summary where match_id = '33333333-0000-0000-0000-000000000003'),
  14, 'captain: summary roster_size counts active players');
-- A deactivated player's old answer no longer counts.
update players set is_active = false where id = '11111111-0000-0000-0000-000000000009';
select is(
  (select row(available, no_response, roster_size)::text
     from match_availability_summary where match_id = '33333333-0000-0000-0000-000000000003'),
  '(8,2,13)', 'captain: summary ignores answers from deactivated players');
update players set is_active = true where id = '11111111-0000-0000-0000-000000000009';

-- Lineup drafts, publishing and results.
update matches set lineup_published_at = null where id = '33333333-0000-0000-0000-000000000003';
select ok((select lineup_published_at is null from matches where id = '33333333-0000-0000-0000-000000000003'),
  'captain: can unpublish a lineup');
select is((select count(*)::int from lineup_slots where match_id = '33333333-0000-0000-0000-000000000003'), 7,
  'captain: reads an unpublished (draft) lineup');
select lives_ok(
  $$insert into line_results (match_id, line_type, line_number, won, score)
    values ('33333333-0000-0000-0000-000000000003', 'singles', 1, true, '6-1 6-1')
    on conflict (match_id, line_type, line_number) do update set won = excluded.won, score = excluded.score$$,
  'captain: can enter a line result');
select is(
  (select score from line_results
    where match_id = '33333333-0000-0000-0000-000000000003' and line_type = 'singles' and line_number = 1),
  '6-1 6-1', 'captain: line result was saved');
update matches set status = 'completed', team_points = 3, opponent_points = 2
 where id = '33333333-0000-0000-0000-000000000003';
select is(
  (select status || ' ' || team_points || '-' || opponent_points from matches
    where id = '33333333-0000-0000-0000-000000000003'),
  'completed 3-2', 'captain: can record the team result');

-- Lineup builder: save_lineup() on Darien (match 4, no lineup yet).
--   Draft: S1 J. Chen (P03), D1 P04 + P05, D2 P02 (seat 2 empty).
select lives_ok(
  $$select save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"singles","line_number":1,"seat":1,"player_id":"11111111-0000-0000-0000-000000000003","court_label":" Ct 3 "},
      {"line_type":"doubles","line_number":2,"seat":1,"player_id":"11111111-0000-0000-0000-000000000002","court_label":"Ct 6"},
      {"line_type":"doubles","line_number":1,"seat":1,"player_id":"11111111-0000-0000-0000-000000000004","court_label":"Ct 5"},
      {"line_type":"doubles","line_number":1,"seat":2,"player_id":"11111111-0000-0000-0000-000000000005","court_label":"Ct 5"}
    ]'::jsonb, false)$$,
  'captain: save_lineup() saves a draft');
select is(
  (select count(*)::int || ' ' || min(court_label) from lineup_slots where match_id = '33333333-0000-0000-0000-000000000004'),
  '4 Ct 3', 'captain: draft has 4 slots with trimmed court labels');
select ok((select lineup_published_at is null from matches where id = '33333333-0000-0000-0000-000000000004'),
  'captain: a draft save does not publish');
select throws_ok(
  $$select save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"singles","line_number":2,"seat":1,"player_id":"11111111-0000-0000-0000-000000000003"}
    ]'::jsonb, false)$$,
  '22023', null, 'captain: save_lineup() refuses S2 (the format is 1 singles + 3 doubles)');
select throws_ok(
  $$select save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"singles","line_number":1,"seat":2,"player_id":"11111111-0000-0000-0000-000000000003"}
    ]'::jsonb, false)$$,
  '22023', null, 'captain: save_lineup() refuses a second seat on a singles line');
select throws_ok(
  $$select save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"doubles","line_number":4,"seat":1,"player_id":"11111111-0000-0000-0000-000000000003"}
    ]'::jsonb, false)$$,
  '22023', null, 'captain: save_lineup() refuses D4');
select throws_ok(
  $$select save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"singles","line_number":1,"seat":1,"player_id":"11111111-0000-0000-0000-000000000003"},
      {"line_type":"doubles","line_number":3,"seat":1,"player_id":"11111111-0000-0000-0000-000000000003"}
    ]'::jsonb, false)$$,
  '23505', null, 'captain: save_lineup() refuses a double-booked player');
select throws_ok(
  $$select save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"singles","line_number":1,"seat":1,"player_id":"aaaaaaaa-0000-0000-0000-000000000a99"}
    ]'::jsonb, false)$$,
  '22023', null, 'captain: save_lineup() refuses someone not on the active roster');
select is((select count(*)::int from lineup_slots where match_id = '33333333-0000-0000-0000-000000000004'), 4,
  'captain: a refused save leaves the draft untouched');
-- First publish: every seat goes to pending (even one marked confirmed in the draft) and everyone is notified.
update lineup_slots set rsvp = 'confirmed'
 where match_id = '33333333-0000-0000-0000-000000000004' and player_id = '11111111-0000-0000-0000-000000000004';
select is(
  (select count(*)::int from save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"singles","line_number":1,"seat":1,"player_id":"11111111-0000-0000-0000-000000000003","court_label":"Ct 3"},
      {"line_type":"doubles","line_number":2,"seat":1,"player_id":"11111111-0000-0000-0000-000000000002","court_label":"Ct 6"},
      {"line_type":"doubles","line_number":1,"seat":1,"player_id":"11111111-0000-0000-0000-000000000004","court_label":"Ct 5"},
      {"line_type":"doubles","line_number":1,"seat":2,"player_id":"11111111-0000-0000-0000-000000000005","court_label":"Ct 5"}
    ]'::jsonb, true)),
  4, 'captain: first publish returns every player to notify');
select is(
  (select string_agg(distinct rsvp::text, ',') from lineup_slots where match_id = '33333333-0000-0000-0000-000000000004'),
  'pending', 'captain: first publish sets every RSVP to pending');
select ok((select lineup_published_at is not null from matches where id = '33333333-0000-0000-0000-000000000004'),
  'captain: publishing sets lineup_published_at');
-- Republish with D1 seat 2 changed (P05 -> P06), D1 partners kept, S1 court changed.
update lineup_slots set rsvp = 'confirmed' where match_id = '33333333-0000-0000-0000-000000000004';
select is(
  (select string_agg(id::text, ',') from save_lineup('33333333-0000-0000-0000-000000000004', '[
      {"line_type":"singles","line_number":1,"seat":1,"player_id":"11111111-0000-0000-0000-000000000003","court_label":"Ct 8"},
      {"line_type":"doubles","line_number":2,"seat":1,"player_id":"11111111-0000-0000-0000-000000000002","court_label":"Ct 6"},
      {"line_type":"doubles","line_number":1,"seat":1,"player_id":"11111111-0000-0000-0000-000000000006","court_label":"Ct 5"},
      {"line_type":"doubles","line_number":1,"seat":2,"player_id":"11111111-0000-0000-0000-000000000004","court_label":"Ct 5"}
    ]'::jsonb, true) as id),
  '11111111-0000-0000-0000-000000000006', 'captain: republish notifies only the player new to a line');
select is(
  (select string_agg(player_id::text || '=' || rsvp, ',' order by player_id) from lineup_slots
    where match_id = '33333333-0000-0000-0000-000000000004'),
  '11111111-0000-0000-0000-000000000002=confirmed,11111111-0000-0000-0000-000000000003=confirmed,'
  || '11111111-0000-0000-0000-000000000004=confirmed,11111111-0000-0000-0000-000000000006=pending',
  'captain: republish resets only the changed seat (seat swap and court change keep RSVP)');

-- The player side of the published Darien lineup (J. Chen is on S1).
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a03', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a03","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select save_lineup('33333333-0000-0000-0000-000000000004', '[]'::jsonb, false)$$,
  '42501', null, 'player: cannot call save_lineup()');
select is((select count(*)::int from lineup_slots where match_id = '33333333-0000-0000-0000-000000000004'), 4,
  'player: reads the published Darien lineup');
select lives_ok(
  $$select set_my_rsvp('33333333-0000-0000-0000-000000000004', 'declined')$$,
  'player: can decline a published lineup spot');
reset role;
update matches set lineup_published_at = null where id = '33333333-0000-0000-0000-000000000004';
set local role authenticated;
select throws_ok(
  $$select set_my_rsvp('33333333-0000-0000-0000-000000000004', 'confirmed')$$,
  'P0002', null, 'player: set_my_rsvp() refuses an unpublished lineup');
reset role;
update matches set lineup_published_at = now(), starts_at = now() - interval '1 hour'
 where id = '33333333-0000-0000-0000-000000000004';
set local role authenticated;
select throws_ok(
  $$select set_my_rsvp('33333333-0000-0000-0000-000000000004', 'confirmed')$$,
  'P0001', null, 'player: set_my_rsvp() refuses a match that has started');
reset role;
update matches set starts_at = now() + interval '16 days' where id = '33333333-0000-0000-0000-000000000004';

-- Back to the captain, who sees the decline.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a01', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select rsvp::text from lineup_slots
    where match_id = '33333333-0000-0000-0000-000000000004' and player_id = '11111111-0000-0000-0000-000000000003'),
  'declined', 'captain: sees the player''s decline');

-- CSV import: upsert by lower(email); blank fields keep existing values; role is never set.
select is(
  (select string_agg(email || ':' || outcome, ',' order by email) from import_players($$[
    {"full_name":"Import New","email":"Import.New@rls-test.invalid","ntrp_rating":3.0,"role":"captain"},
    {"email":"PLAYER02@example.com","ntrp_rating":4.5,"phone":""},
    {"full_name":"R. Patel","email":"player04@example.com"}
  ]$$)),
  'import.new@rls-test.invalid:created,player02@example.com:updated,player04@example.com:unchanged',
  'captain: import_players() reports created / updated / unchanged');
select is(
  (select role::text from players where email = 'import.new@rls-test.invalid'),
  'player', 'captain: imported players are always created with the player role');
select is(
  (select ntrp_rating || ' ' || phone from players where id = '11111111-0000-0000-0000-000000000002'),
  '4.5 (203) 555-0102', 'captain: import updates the rating and keeps a phone left blank');

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

-- Changing a player's email unlinks the old login.
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a01', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
update players set email = 'someone.else@rls-test.invalid' where email = 'Stranger@rls-test.invalid';
select is(
  (select user_id from players where email = 'someone.else@rls-test.invalid'),
  null, 'link trigger: changing the email clears the old login link');

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a99', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a99","role":"authenticated"}', true);
set local role authenticated;
select is(is_member(), false, 'stranger: loses membership when their roster email changes');

-------------------------------------------------------------------------------
-- SERVICE ROLE: one-tap RSVP tokens (what the /r/[token] page runs after it has a token)
-------------------------------------------------------------------------------
reset role;
set local role service_role;
select is(
  (select token from issue_rsvp_tokens('33333333-0000-0000-0000-000000000005',
     array['11111111-0000-0000-0000-000000000006'::uuid, '11111111-0000-0000-0000-000000000006'::uuid])),
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'tokens: issue_rsvp_tokens() reuses the player''s token for the match');
select is(
  (select expires_at = (select starts_at from matches where id = '33333333-0000-0000-0000-000000000005')
     from rsvp_tokens where token = 'bbbbbbbb-0000-0000-0000-000000000001'),
  true, 'tokens: a token expires when the match starts');
select is(
  (peek_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001') ->> 'opponent'),
  'New Canaan Netters', 'tokens: peek_rsvp_token() describes the match');
select is(
  (apply_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001', 'available') ->> 'answer'),
  'available', 'tokens: apply_rsvp_token() accepts an availability answer');
select is(
  (select status::text from availability
    where match_id = '33333333-0000-0000-0000-000000000005' and player_id = '11111111-0000-0000-0000-000000000006'),
  'available', 'tokens: the answer is saved as the player''s availability');
select lives_ok(
  $$select apply_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001', 'maybe')$$,
  'tokens: a token can be used again to change the answer');
select ok((select used_at is not null from rsvp_tokens where token = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'tokens: using a token records used_at');
select throws_ok(
  $$select apply_rsvp_token('bbbbbbbb-0000-0000-0000-000000000002', 'available')$$,
  'P0002', null, 'tokens: an expired token is refused');
select throws_ok(
  $$select apply_rsvp_token('bbbbbbbb-0000-0000-0000-0000000000ff', 'available')$$,
  'P0002', null, 'tokens: an unknown token is refused');
select throws_ok(
  $$select apply_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001', 'confirmed')$$,
  'P0001', null, 'tokens: Confirm is refused when the player has no published lineup spot');
select throws_ok(
  $$select apply_rsvp_token('bbbbbbbb-0000-0000-0000-000000000001', 'whatever')$$,
  '22023', null, 'tokens: an unknown answer is refused');

-------------------------------------------------------------------------------
-- PHASE 8: standings, photos (+ storage), events, calendar tokens and feeds
--   Fixtures: one public and one private photo with their storage objects (no file
--   bytes needed: policies only look at storage.objects rows). J. Chen (P03) is made
--   an active player again; their calendar token is fixed so the feed can be tested.
-------------------------------------------------------------------------------
reset role;
update public.players set is_active = true, role = 'player' where id = '11111111-0000-0000-0000-000000000003';
update public.calendar_tokens set token = 'cccccccc-0000-0000-0000-000000000003'
 where player_id = '11111111-0000-0000-0000-000000000003';
update public.calendar_tokens set token = 'cccccccc-0000-0000-0000-000000000005'
 where player_id = '11111111-0000-0000-0000-000000000005';
insert into public.photos (id, path, thumb_path, width, height, caption, is_public) values
  ('dddddddd-0000-0000-0000-000000000001', 'rls-test/public.jpg',  'rls-test/public-thumb.jpg',  800, 600, 'Public', true),
  ('dddddddd-0000-0000-0000-000000000002', 'rls-test/private.jpg', 'rls-test/private-thumb.jpg', 800, 600, 'Private', false);
insert into storage.objects (bucket_id, name) values
  ('photos', 'rls-test/public.jpg'), ('photos', 'rls-test/public-thumb.jpg'),
  ('photos', 'rls-test/private.jpg'), ('photos', 'rls-test/private-thumb.jpg');

select is(
  (select count(*)::int from calendar_tokens t join players p on p.id = t.player_id where p.email = 'someone.else@rls-test.invalid'),
  1, 'calendar token: a new roster row gets a calendar token');

-- ANON
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role anon;

select ok((select count(*) from standings) > 0, 'anon: reads standings');
select throws_ok(
  $$insert into standings (season_id, rank, team_name) values ('22222222-0000-0000-0000-000000000001', 9, 'Nope')$$,
  '42501', null, 'anon: cannot add standings');
update standings set wins = 99;
delete from standings;
select ok((select count(*) from standings) > 0 and not exists (select 1 from standings where wins = 99),
  'anon: cannot change or delete standings');
select throws_ok($$select save_standings('[]'::jsonb)$$, '42501', null, 'anon: cannot call save_standings()');
select is((select count(*)::int from photos where path like 'rls-test/%'), 1, 'anon: sees only the public photo');
select is(
  (select string_agg(name, ',' order by name) from storage.objects where name like 'rls-test/%'),
  'rls-test/public-thumb.jpg,rls-test/public.jpg', 'anon: sees only the public photo''s files');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'rls-test/anon.jpg')$$,
  '42501', null, 'anon: cannot upload photo files');
update photos set is_public = true where id = 'dddddddd-0000-0000-0000-000000000002';
select is((select count(*)::int from photos where path like 'rls-test/%'), 1, 'anon: cannot make a photo public');
select is((select count(*)::int from events),          0, 'anon: cannot read events directly');
select is((select count(*)::int from calendar_tokens), 0, 'anon: cannot read calendar tokens');
select ok(exists (select 1 from public_calendar(now() - interval '60 days') where kind = 'match' and team_points is not null),
  'anon: public_calendar() includes match scores');
select ok(exists (select 1 from public_calendar() where title = 'Open hitting session'),
  'anon: public_calendar() includes public events');
select is((public_results() ->> 'singles_won')::int, 2, 'anon: public_results() counts singles lines won');
select is((public_results() -> 'standings' -> 0 ->> 'rank')::int, 1, 'anon: public_results() includes standings by rank');
select ok(not (public_results()::text ~ 'J\. Chen|M\. Alvarez'), 'anon: public_results() has no player names');
select throws_ok($$select calendar_feed('cccccccc-0000-0000-0000-000000000003')$$, '42501', null,
  'anon: cannot call calendar_feed() (service role only)');
select throws_ok($$select regenerate_my_calendar_token()$$, '42501', null,
  'anon: cannot call regenerate_my_calendar_token()');

-- STRANGER (signed in, not on the roster)
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a99', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a99","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from photos where path like 'rls-test/%'), 1, 'stranger: sees only the public photo');
select is((select count(*)::int from storage.objects where name like 'rls-test/%'), 2, 'stranger: sees only public photo files');
select is((select count(*)::int from calendar_tokens), 0, 'stranger: has no calendar token to read');
select throws_ok($$select regenerate_my_calendar_token()$$, '42501', null, 'stranger: cannot create a calendar token');

-- PLAYER (J. Chen)
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a03', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a03","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from photos where path like 'rls-test/%'), 2, 'player: sees every photo');
select is((select count(*)::int from storage.objects where name like 'rls-test/%'), 4, 'player: sees every photo file');
update photos set caption = 'Hacked' where id = 'dddddddd-0000-0000-0000-000000000002';
delete from photos where id = 'dddddddd-0000-0000-0000-000000000001';
select is(
  (select string_agg(coalesce(caption, ''), ',' order by caption) from photos where path like 'rls-test/%'),
  'Private,Public', 'player: cannot edit or delete photos');
select throws_ok(
  $$insert into photos (path, thumb_path, width, height) values ('rls-test/p.jpg', 'rls-test/p-t.jpg', 1, 1)$$,
  '42501', null, 'player: cannot add photos');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'rls-test/player.jpg')$$,
  '42501', null, 'player: cannot upload photo files');
-- The Storage API sets this before deleting; without it a trigger refuses every direct delete.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name = 'rls-test/private.jpg';
select is((select count(*)::int from storage.objects where name like 'rls-test/%'), 4, 'player: cannot delete photo files');
select is(
  (select string_agg(token::text, ',') from calendar_tokens),
  'cccccccc-0000-0000-0000-000000000003', 'player: reads only their own calendar token');
select ok(regenerate_my_calendar_token() <> 'cccccccc-0000-0000-0000-000000000003'::uuid,
  'player: regenerate_my_calendar_token() returns a new token');
select ok((select token <> 'cccccccc-0000-0000-0000-000000000003'::uuid from calendar_tokens),
  'player: the old calendar token is replaced');
update calendar_tokens set token = 'cccccccc-0000-0000-0000-0000000000ee';
select ok(not exists (select 1 from calendar_tokens where token = 'cccccccc-0000-0000-0000-0000000000ee'),
  'player: cannot set their own token directly');
select is((select count(*)::int from events where not is_public) > 0, true, 'player: reads members-only events');
select throws_ok(
  $$insert into events (type, title, starts_at) values ('social', 'Nope', now())$$,
  '42501', null, 'player: cannot add events');
update events set title = 'Hacked' where title = 'Team practice';
select ok(not exists (select 1 from events where title = 'Hacked'), 'player: cannot edit events');
select throws_ok($$select save_standings('[]'::jsonb)$$, '42501', null, 'player: cannot call save_standings()');
select throws_ok($$select calendar_feed('cccccccc-0000-0000-0000-000000000005')$$, '42501', null,
  'player: cannot call calendar_feed() directly');
select throws_ok($$select set_team_photo('dddddddd-0000-0000-0000-000000000001')$$, '42501', null,
  'player: cannot choose the Home team photo');
update photos set is_team_photo = true where id = 'dddddddd-0000-0000-0000-000000000001';
select ok(not (select is_team_photo from photos where id = 'dddddddd-0000-0000-0000-000000000001'),
  'player: cannot flag a team photo directly');

-- CAPTAIN
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a01', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into events (id, type, title, starts_at, is_public)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'usta_deadline', 'Test deadline', now() + interval '5 days', false)$$,
  'captain: can add an event');
update events set is_public = true where id = 'eeeeeeee-0000-0000-0000-000000000001';
select ok(exists (select 1 from public_calendar() where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'captain: a public event shows in public_calendar()');
select lives_ok($$delete from events where id = 'eeeeeeee-0000-0000-0000-000000000001'$$, 'captain: can delete an event');
select is((select count(*)::int from events where id = 'eeeeeeee-0000-0000-0000-000000000001'), 0, 'captain: event is gone');
update photos set is_public = true where id = 'dddddddd-0000-0000-0000-000000000002';
select ok((select is_public from photos where id = 'dddddddd-0000-0000-0000-000000000002'), 'captain: can make a photo public');

-- Home team photo: one at most, always public.
update photos set is_public = false where id = 'dddddddd-0000-0000-0000-000000000002';
select lives_ok($$select set_team_photo('dddddddd-0000-0000-0000-000000000002')$$, 'captain: can choose a private photo as the team photo');
select is(
  (select is_team_photo::text || ' ' || is_public::text from photos where id = 'dddddddd-0000-0000-0000-000000000002'),
  'true true', 'captain: choosing the team photo also makes it public');
select lives_ok($$select set_team_photo('dddddddd-0000-0000-0000-000000000001')$$, 'captain: can switch the team photo');
select is(
  (select string_agg(id::text, ',') from photos where is_team_photo),
  'dddddddd-0000-0000-0000-000000000001', 'captain: switching leaves exactly one team photo');
select throws_ok(
  $$update photos set is_team_photo = true where id = 'dddddddd-0000-0000-0000-000000000002'$$,
  '23505', null, 'captain: a second team photo is refused');
select throws_ok(
  $$update photos set is_public = false where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  '23514', null, 'captain: the team photo cannot be made private while it is the team photo');
select throws_ok($$select set_team_photo('dddddddd-0000-0000-0000-0000000000ff')$$, 'P0002', null,
  'captain: an unknown photo cannot be the team photo');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'rls-test/captain.jpg')$$,
  'captain: can upload photo files');
select lives_ok($$delete from storage.objects where name = 'rls-test/captain.jpg'$$, 'captain: can delete photo files');
select is((select count(*)::int from storage.objects where name = 'rls-test/captain.jpg'), 0, 'captain: the deleted file is gone');
select lives_ok(
  $$select save_standings('[{"rank":1,"team_name":"Stamford Stags","wins":2,"losses":0,"lines_won":7,"lines_lost":1,"is_stags":true},
                           {"rank":2,"team_name":"Norwalk Aces","wins":1,"losses":1}]'::jsonb)$$,
  'captain: save_standings() replaces the table');
select is(
  (select string_agg(rank || ' ' || team_name || ' ' || wins || '-' || losses, ', ' order by rank) from standings),
  '1 Stamford Stags 2-0, 2 Norwalk Aces 1-1', 'captain: standings hold exactly the saved rows');
select throws_ok(
  $$select save_standings('[{"rank":1,"team_name":"A","is_stags":true},{"rank":2,"team_name":"B","is_stags":true}]'::jsonb)$$,
  '23505', null, 'captain: only one standings row can be the Stags');

-- After the captain made it public, anon can see the second photo's files too.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role anon;
select is((select count(*)::int from storage.objects where name like 'rls-test/%'), 4,
  'anon: files of a photo made public become readable');
select is((select string_agg(id::text, ',') from photos where is_team_photo), 'dddddddd-0000-0000-0000-000000000001',
  'anon: reads the Home team photo');
select throws_ok($$select set_team_photo('dddddddd-0000-0000-0000-000000000002')$$, '42501', null,
  'anon: cannot choose the Home team photo');

-- SERVICE ROLE: personal calendar feed
reset role;
update public.players set is_active = false where id = '11111111-0000-0000-0000-000000000005';
set local role service_role;
select is(
  (select count(*)::int from jsonb_array_elements(
     calendar_feed((select token from calendar_tokens where player_id = '11111111-0000-0000-0000-000000000003')) -> 'items') i
   where i ->> 'title' = 'Team practice'),
  1, 'calendar feed: includes members-only events for a valid token');
select is(
  calendar_feed((select token from calendar_tokens where player_id = '11111111-0000-0000-0000-000000000003')) ->> 'player',
  'J. Chen', 'calendar feed: names the token''s player');
select is(calendar_feed('cccccccc-0000-0000-0000-000000000003'), null, 'calendar feed: a reset (old) token returns nothing');
select is(calendar_feed('cccccccc-0000-0000-0000-000000000005'), null, 'calendar feed: an inactive player''s token returns nothing');
select is(calendar_feed('cccccccc-0000-0000-0000-0000000000ff'), null, 'calendar feed: an unknown token returns nothing');

-------------------------------------------------------------------------------
-- PHASE 9: invite a Join-form registration (invite_registration) and the 'invite' message kind
--   Fixtures: two pending registrations, one new person and one whose email (any case) is
--   already on the roster as P05.
-------------------------------------------------------------------------------
reset role;
insert into public.registrations (id, full_name, email, phone, ntrp_rating, position_pref) values
  ('ffffffff-0000-0000-0000-000000000001', 'Rita Newcomer', 'Rita.Newcomer@rls-test.invalid', '(203) 555-0999', 3.5, 'singles'),
  ('ffffffff-0000-0000-0000-000000000002', 'Already Here', 'PLAYER05@example.com', null, null, 'both');

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select invite_registration('ffffffff-0000-0000-0000-000000000001')$$, '42501', null,
  'anon: cannot invite a registration');

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a03', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a03","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select invite_registration('ffffffff-0000-0000-0000-000000000001')$$, '42501', null,
  'player: cannot invite a registration');

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000a01', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
select ok(invite_registration('ffffffff-0000-0000-0000-000000000001') is not null, 'captain: can invite a registration');
select is(
  (select full_name || ' ' || email || ' ' || role || ' ' || position_pref || ' ' || ntrp_rating || ' ' || phone
     from players where lower(email) = 'rita.newcomer@rls-test.invalid'),
  'Rita Newcomer rita.newcomer@rls-test.invalid player singles 3.5 (203) 555-0999',
  'captain: the invite adds the player from the registration (as a player)');
select is(
  (select status || ' ' || (player_id is not null) || ' ' || (reviewed_by = '11111111-0000-0000-0000-000000000001') || ' ' || (reviewed_at is not null)
     from registrations where id = 'ffffffff-0000-0000-0000-000000000001'),
  'invited true true true', 'captain: the registration is marked invited, linked and reviewed');
select throws_ok($$select invite_registration('ffffffff-0000-0000-0000-000000000001')$$, 'P0002', null,
  'captain: the same registration cannot be invited twice');
select is(
  invite_registration('ffffffff-0000-0000-0000-000000000002'),
  '11111111-0000-0000-0000-000000000005'::uuid, 'captain: an email already on the roster links to that player');
select is((select count(*)::int from players where lower(email) = 'player05@example.com'), 1,
  'captain: inviting an existing email creates no duplicate player');

reset role;
set local role service_role;
select lives_ok(
  $$insert into messages (audience, kind, subject, body) values ('custom', 'invite', 'Welcome', 'Hi')$$,
  'messages: the invite kind is allowed');
select throws_ok(
  $$insert into messages (audience, kind, subject, body) values ('custom', 'spam', 'Nope', 'Hi')$$,
  '23514', null, 'messages: unknown kinds are still refused');

-------------------------------------------------------------------------------
reset role;
select * from finish();
rollback;
