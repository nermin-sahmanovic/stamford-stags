-- Phase 6: lineup builder.
--   * save_lineup(): the captain's builder replaces a match's slots in one transaction, so swaps
--     don't trip the (immediate) unique constraints. It returns the players to notify.
--   * set_my_rsvp(): only for a published lineup on a match that hasn't started.

-- p_slots: [{ line_type, line_number, seat, player_id, court_label }, ...]
-- RSVP rules:
--   first publish (draft -> published): every seat is pending, every player is returned.
--   already published: a player who stays on the same line keeps their RSVP (a partner seat swap
--     or a court change); anyone new to a line goes to pending and is returned.
--   draft save: a player already in the draft keeps their RSVP; nobody is returned.
-- Invoker, so the "captains manage" policies still apply; the is_captain() check gives a clear error.
create or replace function public.save_lineup(
  p_match_id uuid,
  p_slots    jsonb,
  p_publish  boolean default false
)
returns setof uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_singles       smallint;
  v_doubles       smallint;
  v_was_published boolean;
  v_old           jsonb;
begin
  if not public.is_captain() then
    raise exception 'Only captains can edit lineups' using errcode = '42501';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'Lineup slots must be a list' using errcode = '22023';
  end if;

  select s.singles_lines, s.doubles_lines, m.lineup_published_at is not null
    into v_singles, v_doubles, v_was_published
    from public.matches m
    join public.seasons s on s.id = m.season_id
   where m.id = p_match_id
     for update of m;
  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_slots) as x(line_type public.line_type, line_number smallint, seat smallint)
    where x.line_type is null
       or x.line_number is null
       or x.line_number < 1
       or x.line_number > case x.line_type when 'singles' then v_singles else v_doubles end
       or x.seat not in (1, 2)
       or (x.line_type = 'singles' and x.seat <> 1)
  ) then
    raise exception 'That line isn''t part of this season''s format' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_slots) as x(player_id uuid)
    left join public.players p on p.id = x.player_id and p.is_active
    where p.id is null
  ) then
    raise exception 'That player isn''t on the active roster' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'player_id', ls.player_id, 'line_type', ls.line_type,
           'line_number', ls.line_number, 'rsvp', ls.rsvp)), '[]'::jsonb)
    into v_old
    from public.lineup_slots ls
   where ls.match_id = p_match_id;

  delete from public.lineup_slots where match_id = p_match_id;

  insert into public.lineup_slots (match_id, line_type, line_number, seat, player_id, court_label, rsvp)
  select p_match_id, x.line_type, x.line_number, coalesce(x.seat, 1), x.player_id,
         nullif(btrim(x.court_label), ''),
         case
           when p_publish and not v_was_published then 'pending'::public.rsvp_status
           else coalesce(o.rsvp, 'pending'::public.rsvp_status)
         end
  from jsonb_to_recordset(p_slots)
         as x(line_type public.line_type, line_number smallint, seat smallint, player_id uuid, court_label text)
  left join jsonb_to_recordset(v_old)
         as o(player_id uuid, line_type public.line_type, line_number smallint, rsvp public.rsvp_status)
    on o.player_id = x.player_id
   and (not v_was_published or (o.line_type = x.line_type and o.line_number = x.line_number));

  if p_publish and not v_was_published then
    update public.matches set lineup_published_at = now() where id = p_match_id;
  end if;

  if v_was_published or p_publish then
    return query
      select x.player_id
      from jsonb_to_recordset(p_slots) as x(line_type public.line_type, line_number smallint, player_id uuid)
      where not v_was_published
         or not exists (
           select 1
           from jsonb_to_recordset(v_old) as o(player_id uuid, line_type public.line_type, line_number smallint)
           where o.player_id = x.player_id
             and o.line_type = x.line_type
             and o.line_number = x.line_number
         );
  end if;
end;
$$;

revoke execute on function public.save_lineup(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_lineup(uuid, jsonb, boolean) to authenticated;

-- Player confirms or declines their lineup spot. Definer because players have no
-- update policy on lineup_slots; it only touches the caller's own slot, and only once
-- the lineup is published and the match hasn't started.
create or replace function public.set_my_rsvp(
  p_match_id uuid,
  p_rsvp     public.rsvp_status
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_player uuid := public.current_player_id();
begin
  if v_player is null then
    raise exception 'Not an active team member' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.lineup_published_at is not null
  ) then
    raise exception 'You are not in the lineup for this match' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.status = 'scheduled'
      and m.starts_at > now()
  ) then
    raise exception 'This match is closed for replies' using errcode = 'P0001';
  end if;
  update public.lineup_slots
     set rsvp = p_rsvp
   where match_id = p_match_id
     and player_id = v_player;
  if not found then
    raise exception 'You are not in the lineup for this match' using errcode = 'P0002';
  end if;
end;
$$;
