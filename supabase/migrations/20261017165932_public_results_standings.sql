-- Phase 8 follow-up: public_results() also returns the current season's standings.
-- Anon can't read seasons, so the Results page can't pick the current season's rows itself.
create or replace function public.public_results()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with s as (
    select * from public.seasons where is_current limit 1
  ),
  m as (
    select * from public.matches
    where season_id = (select id from s) and status = 'completed'
  ),
  l as (
    select lr.line_type, lr.won
    from public.line_results lr
    join m on m.id = lr.match_id
  ),
  t as (
    select * from public.standings where season_id = (select id from s)
  )
  select jsonb_build_object(
    'season',  (select name from s),
    'wins',    (select count(*) from m where team_points > opponent_points),
    'losses',  (select count(*) from m where team_points < opponent_points),
    'singles_won',  (select count(*) from l where line_type = 'singles' and won),
    'singles_lost', (select count(*) from l where line_type = 'singles' and not won),
    'doubles_won',  (select count(*) from l where line_type = 'doubles' and won),
    'doubles_lost', (select count(*) from l where line_type = 'doubles' and not won),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'opponent', opponent, 'starts_at', starts_at, 'home_away', home_away,
               'team_points', team_points, 'opponent_points', opponent_points)
             order by starts_at desc)
      from m
    ), '[]'::jsonb),
    'standings_updated_at', (select max(updated_at) from t),
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', rank, 'team_name', team_name, 'wins', wins, 'losses', losses,
               'lines_won', lines_won, 'lines_lost', lines_lost, 'is_stags', is_stags)
             order by rank, team_name)
      from t
    ), '[]'::jsonb)
  )
$$;
