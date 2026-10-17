-- Phase 5: matches and availability.
--   * matches.latitude / longitude: venue coordinates for the Open-Meteo forecast. Geocoded from
--     the address when a captain saves a match; null means "use Stamford, CT".
--   * matches.lineup_published_at: members only see a lineup once the captain publishes it.
--   * match_availability_summary: count active players only, and expose roster_size.

alter table public.matches
  add column latitude  double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column lineup_published_at timestamptz,
  add constraint matches_lat_lon_together check ((latitude is null) = (longitude is null));

-- Lineups that exist today were visible to members; keep them visible.
update public.matches m
   set lineup_published_at = now()
 where exists (select 1 from public.lineup_slots ls where ls.match_id = m.id);

-- Members read a lineup only once it's published. "captains manage lineups" (for all)
-- still lets captains read drafts. set_my_rsvp() is security definer, so it is unaffected.
drop policy "members read lineups" on public.lineup_slots;
create policy "members read published lineups" on public.lineup_slots for select to authenticated
  using (
    (select public.is_member())
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.lineup_published_at is not null
    )
  );

-- Same columns as before (so create or replace works), plus roster_size at the end.
-- Answers from deactivated players no longer count toward available / maybe / out.
create or replace view public.match_availability_summary with (security_invoker = true) as
with roster as (
  select count(*) as size from public.players p where p.is_active
)
select m.id                                                  as match_id,
       m.starts_at,
       (s.singles_lines + 2 * s.doubles_lines)               as players_needed,
       count(*) filter (where a.status = 'available')        as available,
       count(*) filter (where a.status = 'maybe')            as maybe,
       count(*) filter (where a.status = 'unavailable')      as unavailable,
       (select size from roster) - count(a.player_id)        as no_response,
       (select size from roster)                             as roster_size
from public.matches m
join public.seasons s on s.id = m.season_id
left join (
  public.availability a
  join public.players ap on ap.id = a.player_id and ap.is_active
) on a.match_id = m.id
group by m.id, m.starts_at, s.singles_lines, s.doubles_lines;
