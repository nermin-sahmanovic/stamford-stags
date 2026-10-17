-- League format: every match is 1 singles + 3 doubles (7 players).
-- The columns stay on seasons so a future season could differ, but 1 + 3 is the default
-- and every existing season moves to it.

alter table public.seasons
  alter column singles_lines set default 1,
  alter column doubles_lines set default 3;

update public.seasons set singles_lines = 1, doubles_lines = 3
 where singles_lines <> 1 or doubles_lines <> 3;

-- Lines the format no longer has (e.g. S2) can't be shown, edited or scored; drop them.
delete from public.lineup_slots ls
 using public.matches m, public.seasons s
 where m.id = ls.match_id and s.id = m.season_id
   and ls.line_number > case ls.line_type when 'singles' then s.singles_lines else s.doubles_lines end;

delete from public.line_results lr
 using public.matches m, public.seasons s
 where m.id = lr.match_id and s.id = m.season_id
   and lr.line_number > case lr.line_type when 'singles' then s.singles_lines else s.doubles_lines end;
