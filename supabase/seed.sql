-- Stamford Stags: sample data for local development.
-- Mirrors the approved prototype. Dates are relative to "now" so the seed never goes stale.
--
-- BEFORE YOU RUN: change captain@example.com below to the email you will sign in with.
-- When you sign in by magic link, a trigger links your account to that roster row,
-- which makes you captain.

-------------------------------------------------------------------------------
-- Season
-------------------------------------------------------------------------------
insert into public.seasons (id, name, league, division, age_group, ntrp_level, min_ntrp,
                            singles_lines, doubles_lines, max_roster, playoff_min_matches,
                            starts_on, ends_on, is_current)
values ('22222222-0000-0000-0000-000000000001', 'Fall 2026', 'USTA Adult League', 'Fairfield County',
        '18+', 3.5, null, 1, 3, 16, 2,
        (now() - interval '45 days')::date, (now() + interval '45 days')::date, true);

-------------------------------------------------------------------------------
-- Roster (14 active players, 2 open spots against max 16)
-------------------------------------------------------------------------------
insert into public.players (id, full_name, email, phone, usta_number, ntrp_rating, position_pref, role) values
  ('11111111-0000-0000-0000-000000000001', 'Team Captain', 'sahmanovic@gmail.com',  '(347) 745-0193', '2000000001', 3.5, 'doubles', 'captain'),
  ('11111111-0000-0000-0000-000000000002', 'M. Alvarez',   'player02@example.com', '(203) 555-0102', '2000000002', 3.5, 'singles', 'player'),
  ('11111111-0000-0000-0000-000000000003', 'J. Chen',      'player03@example.com', '(203) 555-0103', '2000000003', 3.5, 'singles', 'player'),
  ('11111111-0000-0000-0000-000000000004', 'R. Patel',     'player04@example.com', '(203) 555-0104', '2000000004', 3.5, 'doubles', 'co_captain'),
  ('11111111-0000-0000-0000-000000000005', 'D. Kim',       'player05@example.com', '(203) 555-0105', '2000000005', 3.0, 'doubles', 'player'),
  ('11111111-0000-0000-0000-000000000006', 'T. O''Brien',  'player06@example.com', '(203) 555-0106', '2000000006', 3.5, 'both',    'player'),
  ('11111111-0000-0000-0000-000000000007', 'S. Novak',     'player07@example.com', '(203) 555-0107', '2000000007', 3.0, 'doubles', 'player'),
  ('11111111-0000-0000-0000-000000000008', 'L. Haddad',    'player08@example.com', '(203) 555-0108', '2000000008', 3.5, 'both',    'player'),
  ('11111111-0000-0000-0000-000000000009', 'P. Rossi',     'player09@example.com', '(203) 555-0109', '2000000009', 3.0, 'doubles', 'player'),
  ('11111111-0000-0000-0000-000000000010', 'A. Brooks',    'player10@example.com', '(203) 555-0110', '2000000010', 3.5, 'singles', 'player'),
  ('11111111-0000-0000-0000-000000000011', 'K. Ito',       'player11@example.com', '(203) 555-0111', '2000000011', 3.0, 'both',    'player'),
  ('11111111-0000-0000-0000-000000000012', 'E. Morgan',    'player12@example.com', '(203) 555-0112', '2000000012', 3.5, 'doubles', 'player'),
  ('11111111-0000-0000-0000-000000000013', 'G. Silva',     'player13@example.com', '(203) 555-0113', '2000000013', 3.0, 'doubles', 'player'),
  ('11111111-0000-0000-0000-000000000014', 'H. Lund',      'player14@example.com', '(203) 555-0114', '2000000014', 4.0, 'singles', 'player');
-- H. Lund is rated 4.0 on purpose: eligible_players() should flag them as rating_ok = false.

-------------------------------------------------------------------------------
-- Matches: 2 completed, 3 upcoming. 14:00 UTC = 10:00 AM Eastern (EDT).
-- Lat/lon are the venue towns (for the forecast). Greenwich has no lineup, so it stays unpublished.
-------------------------------------------------------------------------------
insert into public.matches (id, season_id, opponent, starts_at, home_away, location_name, location_address,
                            captain_notes, status, team_points, opponent_points, latitude, longitude, lineup_published_at) values
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Greenwich Lobsters',
   date_trunc('day', now()) - interval '20 days' + interval '14 hours', 'away', 'Greenwich Racquet Center', null,
   null, 'completed', 1, 3, 41.0262, -73.6282, null),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Westport Volleys',
   date_trunc('day', now()) - interval '6 days' + interval '14 hours', 'away', 'Westport Tennis Club', null,
   null, 'completed', 3, 1, 41.1415, -73.3579, now() - interval '9 days'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'Norwalk Aces',
   date_trunc('day', now()) + interval '8 days' + interval '14 hours', 'home', 'Stamford Tennis Center', 'Courts 3–6',
   'Warm-up at 9:30. Courts are booked under the team name. Wear team colors for the photo after.', 'scheduled', null, null, 41.0534, -73.5387, now() - interval '1 day'),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', 'Darien Drop Shots',
   date_trunc('day', now()) + interval '16 days' + interval '17 hours', 'away', 'Darien Indoor Tennis', null,
   null, 'scheduled', null, null, 41.0787, -73.4693, null),
  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000001', 'New Canaan Netters',
   date_trunc('day', now()) + interval '23 days' + interval '14 hours', 'home', 'Stamford Tennis Center', null,
   null, 'scheduled', null, null, 41.0534, -73.5387, null);

-------------------------------------------------------------------------------
-- Lineups: the completed Westport match (for records) and the upcoming Norwalk match
-------------------------------------------------------------------------------
insert into public.lineup_slots (match_id, line_type, line_number, seat, player_id, court_label, rsvp) values
  -- Westport (completed)
  ('33333333-0000-0000-0000-000000000002', 'singles', 1, 1, '11111111-0000-0000-0000-000000000002', 'Ct 1', 'confirmed'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 1, 1, '11111111-0000-0000-0000-000000000004', 'Ct 2', 'confirmed'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 1, 2, '11111111-0000-0000-0000-000000000005', 'Ct 2', 'confirmed'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 2, 1, '11111111-0000-0000-0000-000000000001', 'Ct 3', 'confirmed'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 2, 2, '11111111-0000-0000-0000-000000000012', 'Ct 3', 'confirmed'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 3, 1, '11111111-0000-0000-0000-000000000011', 'Ct 4', 'confirmed'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 3, 2, '11111111-0000-0000-0000-000000000013', 'Ct 4', 'confirmed'),
  -- Norwalk (upcoming): 1 singles + 3 doubles, one player still pending
  ('33333333-0000-0000-0000-000000000003', 'singles', 1, 1, '11111111-0000-0000-0000-000000000003', 'Ct 3', 'confirmed'),
  ('33333333-0000-0000-0000-000000000003', 'doubles', 1, 1, '11111111-0000-0000-0000-000000000004', 'Ct 4', 'confirmed'),
  ('33333333-0000-0000-0000-000000000003', 'doubles', 1, 2, '11111111-0000-0000-0000-000000000005', 'Ct 4', 'confirmed'),
  ('33333333-0000-0000-0000-000000000003', 'doubles', 2, 1, '11111111-0000-0000-0000-000000000006', 'Ct 5', 'confirmed'),
  ('33333333-0000-0000-0000-000000000003', 'doubles', 2, 2, '11111111-0000-0000-0000-000000000007', 'Ct 5', 'confirmed'),
  ('33333333-0000-0000-0000-000000000003', 'doubles', 3, 1, '11111111-0000-0000-0000-000000000008', 'Ct 6', 'confirmed'),
  ('33333333-0000-0000-0000-000000000003', 'doubles', 3, 2, '11111111-0000-0000-0000-000000000009', 'Ct 6', 'pending');

insert into public.line_results (match_id, line_type, line_number, won, score) values
  ('33333333-0000-0000-0000-000000000002', 'singles', 1, true,  '6-3 6-4'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 1, true,  '6-2 6-1'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 2, true,  '4-6 6-3 10-6'),
  ('33333333-0000-0000-0000-000000000002', 'doubles', 3, false, '3-6 5-7');

-------------------------------------------------------------------------------
-- Availability for upcoming matches (some players deliberately missing = no response)
-------------------------------------------------------------------------------
insert into public.availability (match_id, player_id, status)
select '33333333-0000-0000-0000-000000000003', id, 'available'
from public.players
where id in ('11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002',
             '11111111-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004',
             '11111111-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000006',
             '11111111-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000008',
             '11111111-0000-0000-0000-000000000009');

insert into public.availability (match_id, player_id, status) values
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000012', 'maybe'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000013', 'maybe'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000014', 'unavailable'),
  -- Darien: short of players
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'available'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', 'available'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', 'available'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000005', 'available'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000008', 'available'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000006', 'maybe'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000012', 'unavailable'),
  -- New Canaan
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'available'),
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000003', 'available'),
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000007', 'available'),
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000009', 'maybe');

-------------------------------------------------------------------------------
-- Match-day checklist for Norwalk
-------------------------------------------------------------------------------
insert into public.checklist_items (match_id, label, done, sort) values
  ('33333333-0000-0000-0000-000000000003', 'Lineup posted and confirmed', true,  1),
  ('33333333-0000-0000-0000-000000000003', 'Courts 3–6 reserved',          true,  2),
  ('33333333-0000-0000-0000-000000000003', 'New balls for each court',     false, 3),
  ('33333333-0000-0000-0000-000000000003', 'Scorecards printed',           false, 4),
  ('33333333-0000-0000-0000-000000000003', 'Water and towels',             false, 5),
  ('33333333-0000-0000-0000-000000000003', 'Report scores to USTA',        false, 6);

-------------------------------------------------------------------------------
-- Events
-------------------------------------------------------------------------------
insert into public.events (season_id, type, title, starts_at, ends_at, location, is_public) values
  ('22222222-0000-0000-0000-000000000001', 'practice', 'Team practice',
   date_trunc('day', now()) + interval '3 days' + interval '23 hours',
   date_trunc('day', now()) + interval '4 days' + interval '30 minutes', 'Stamford Tennis Center', false),
  ('22222222-0000-0000-0000-000000000001', 'social', 'End-of-season social',
   date_trunc('day', now()) + interval '29 days' + interval '23 hours', null, 'Location to be announced', true),
  ('22222222-0000-0000-0000-000000000001', 'usta_deadline', 'Playoff roster deadline',
   date_trunc('day', now()) + interval '30 days' + interval '16 hours', null, null, false),
  (null, 'registration', 'Spring 2027 registration opens',
   date_trunc('day', now()) + interval '60 days' + interval '14 hours', null, null, true);

-------------------------------------------------------------------------------
-- Registrations awaiting review
-------------------------------------------------------------------------------
insert into public.registrations (full_name, email, phone, usta_number, ntrp_rating, position_pref,
                                  availability_slots, notes, created_at) values
  ('E. Garcia', 'applicant1@example.com', '(203) 555-0201', '2000000101', 3.5, 'doubles', '{"Sat AM","Sun AM"}', 'Played 18+ 3.5 in Norwalk last year.', now() - interval '2 days'),
  ('B. Walsh',  'applicant2@example.com', '(203) 555-0202', '2000000102', 3.5, 'both',    '{"Weeknights","Sat AM"}', null, now() - interval '4 days'),
  ('M. Torres', 'applicant3@example.com', '(203) 555-0203', '2000000103', 3.0, 'singles', '{"Sat PM"}', 'New to USTA league play.', now() - interval '7 days');

-------------------------------------------------------------------------------
-- News
-------------------------------------------------------------------------------
insert into public.news_posts (type, title, body, is_public, published_at, author_id) values
  ('result', 'Stags win 4–1 at Westport', 'Clean sweep on the doubles courts.', true, now() - interval '6 days', '11111111-0000-0000-0000-000000000001'),
  ('announcement', 'Lineup for the Norwalk match is posted', 'Check your court and confirm in Match Center.', false, now() - interval '2 days', '11111111-0000-0000-0000-000000000001'),
  ('event', 'End-of-season social', 'Location to be announced.', true, now() - interval '1 day', '11111111-0000-0000-0000-000000000001');

-------------------------------------------------------------------------------
-- Message history
-------------------------------------------------------------------------------
insert into public.messages (id, sent_by, audience, match_id, subject, body, recipient_count, provider, sent_at) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'team', null,
   'Great win at Westport', 'Nice work everyone.', 14, 'seed', now() - interval '5 days'),
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'match', '33333333-0000-0000-0000-000000000003',
   'Norwalk lineup posted', 'Lineup and courts are in Match Center. Please confirm.', 7, 'seed', now() - interval '2 days');

insert into public.message_recipients (message_id, player_id, email)
select '44444444-0000-0000-0000-000000000001', id, email from public.players where is_active;

insert into public.message_recipients (message_id, player_id, email)
select '44444444-0000-0000-0000-000000000002', p.id, p.email
from public.lineup_slots ls join public.players p on p.id = ls.player_id
where ls.match_id = '33333333-0000-0000-0000-000000000003';
