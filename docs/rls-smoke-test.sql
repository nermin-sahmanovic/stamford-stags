\set ON_ERROR_STOP 0
insert into auth.users (id, email) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Captain@Example.com'),
 ('aaaaaaaa-0000-0000-0000-000000000003','player03@example.com'),
 ('aaaaaaaa-0000-0000-0000-000000000099','stranger@example.com');
select 'link trigger: captain linked = ' || (select user_id is not null from players where email='captain@example.com');

\echo '--- ANON'
set role anon;
select 'anon players visible: ' || count(*) from players;
select 'anon summary: ' || public_team_summary()::text;
select 'anon calendar rows: ' || count(*) from public_calendar();
select 'anon public news: ' || count(*) from news_posts;
insert into registrations (full_name,email) values ('Test Person','t@example.com');
select 'anon insert pending registration: ok';
insert into registrations (full_name,email,status) values ('Sneaky','s@example.com','invited');
reset role;

\echo '--- STRANGER (signed in, not on roster)'
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000099';
select 'stranger players: ' || (select count(*) from players) || ', matches: ' || (select count(*) from matches);
reset role;

\echo '--- PLAYER (J. Chen)'
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select 'player sees players: ' || count(*) from players;
select 'player sees registrations: ' || count(*) from registrations;
select set_my_availability('33333333-0000-0000-0000-000000000004','available');
select 'own availability set: ' || status from availability where match_id='33333333-0000-0000-0000-000000000004' and player_id='11111111-0000-0000-0000-000000000003';
insert into availability (match_id, player_id, status) values ('33333333-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000010','unavailable');
update lineup_slots set rsvp='declined' where player_id='11111111-0000-0000-0000-000000000009';
select 'direct lineup update rows affected check: P.Rossi rsvp = ' || (select rsvp from lineup_slots where player_id='11111111-0000-0000-0000-000000000009' and match_id='33333333-0000-0000-0000-000000000003');
select set_my_rsvp('33333333-0000-0000-0000-000000000003','declined');
select 'set_my_rsvp -> ' || rsvp from lineup_slots where player_id='11111111-0000-0000-0000-000000000003' and match_id='33333333-0000-0000-0000-000000000003';
select 'player messages visible: ' || count(*) from messages;
select 'player record: ' || coalesce((select wins||'-'||losses from player_records where player_id='11111111-0000-0000-0000-000000000002'),'none') || ' (Alvarez)';
reset role;

\echo '--- CAPTAIN'
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'captain sees registrations: ' || count(*) from registrations;
update matches set captain_notes = 'Updated by captain' where id='33333333-0000-0000-0000-000000000003';
select 'captain updated notes: ' || captain_notes from matches where id='33333333-0000-0000-0000-000000000003';
select 'eligible: ' || full_name || ' avail=' || coalesce(availability::text,'-') || ' rating_ok=' || rating_ok || ' playoff=' || playoff_eligible from eligible_players('33333333-0000-0000-0000-000000000003') limit 4;
select 'eligible flagged 4.0: ' || full_name || ' rating_ok=' || rating_ok from eligible_players('33333333-0000-0000-0000-000000000003') where not rating_ok;
select 'summary norwalk: needed=' || players_needed || ' avail=' || available || ' maybe=' || maybe || ' out=' || unavailable || ' noresp=' || no_response from match_availability_summary where match_id='33333333-0000-0000-0000-000000000003';
select 'captain messages visible: ' || count(*) from messages;
reset role;
