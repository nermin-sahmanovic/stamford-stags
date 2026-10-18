-- Phase 8: schedule, photos and results.
--   * public_calendar(): replaces public_schedule() with ids, end times and scores (calendar + ICS).
--   * public_results(): current-season results and line totals for the public Results page.
--   * standings: manually maintained league table. Everyone reads; captains edit (save_standings).
--   * calendar_tokens: one secret per player for their personal ICS feed. The token is kept off
--     players because every member can read every players row.
--   * photos + the private "photos" Storage bucket. Members see every photo; anon sees only
--     photos the captain marked public. Only captains upload, edit or delete.

-------------------------------------------------------------------------------
-- Public calendar and results
-------------------------------------------------------------------------------
drop function public.public_schedule(timestamptz);

-- Matches (all, including cancelled) plus public events. No addresses, notes or lineups.
create or replace function public.public_calendar(
  p_from timestamptz default now(),
  p_to   timestamptz default now() + interval '400 days'
)
returns table (
  id              uuid,
  kind            text,
  title           text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  location_name   text,
  home_away       public.home_away,
  status          public.match_status,
  team_points     smallint,
  opponent_points smallint
)
language sql stable security definer
set search_path = ''
as $$
  select m.id, 'match',
         case when m.home_away = 'home' then 'vs. ' else '@ ' end || m.opponent,
         m.starts_at, null::timestamptz, m.location_name, m.home_away, m.status,
         m.team_points, m.opponent_points
  from public.matches m
  where m.starts_at >= p_from and m.starts_at < p_to
  union all
  select e.id, e.type::text, e.title, e.starts_at, e.ends_at, e.location,
         null, null, null, null
  from public.events e
  where e.is_public and e.starts_at >= p_from and e.starts_at < p_to
  order by 4
$$;

-- Current season: record, completed matches and line totals. Aggregates only, never player names.
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
    ), '[]'::jsonb)
  )
$$;

grant execute on function public.public_calendar(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.public_results()                          to anon, authenticated;

-------------------------------------------------------------------------------
-- Standings
-------------------------------------------------------------------------------
create table public.standings (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons (id) on delete cascade,
  rank       smallint not null check (rank >= 1),
  team_name  text not null check (char_length(btrim(team_name)) between 1 and 60),
  wins       smallint not null default 0 check (wins >= 0),
  losses     smallint not null default 0 check (losses >= 0),
  lines_won  smallint not null default 0 check (lines_won >= 0),
  lines_lost smallint not null default 0 check (lines_lost >= 0),
  is_stags   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, team_name)
);
create unique index standings_one_stags_row on public.standings (season_id) where is_stags;
create trigger standings_updated_at before update on public.standings for each row execute function public.set_updated_at();

alter table public.standings enable row level security;
create policy "everyone reads standings"  on public.standings for select to anon, authenticated using (true);
create policy "captains manage standings" on public.standings for all    to authenticated
  using ((select public.is_captain())) with check ((select public.is_captain()));

-- p_rows: [{ rank, team_name, wins, losses, lines_won, lines_lost, is_stags }, ...]
-- Replaces the current season's table in one transaction. Invoker, so the policies still apply.
create or replace function public.save_standings(p_rows jsonb)
returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_season uuid;
begin
  if not public.is_captain() then
    raise exception 'Only captains can edit standings' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Standings must be a list' using errcode = '22023';
  end if;

  select id into v_season from public.seasons where is_current;
  if v_season is null then
    raise exception 'There is no current season' using errcode = 'P0002';
  end if;

  delete from public.standings where season_id = v_season;

  insert into public.standings (season_id, rank, team_name, wins, losses, lines_won, lines_lost, is_stags)
  select v_season, x.rank, btrim(x.team_name), coalesce(x.wins, 0), coalesce(x.losses, 0),
         coalesce(x.lines_won, 0), coalesce(x.lines_lost, 0), coalesce(x.is_stags, false)
  from jsonb_to_recordset(p_rows)
         as x(rank smallint, team_name text, wins smallint, losses smallint,
              lines_won smallint, lines_lost smallint, is_stags boolean);
end;
$$;

revoke execute on function public.save_standings(jsonb) from public, anon;
grant execute on function public.save_standings(jsonb) to authenticated;

-------------------------------------------------------------------------------
-- Calendar feed tokens
-------------------------------------------------------------------------------
create table public.calendar_tokens (
  player_id  uuid primary key references public.players (id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.calendar_tokens enable row level security;
-- A player reads only their own token. No write policies: tokens change through the RPC below.
create policy "players read own calendar token" on public.calendar_tokens for select to authenticated
  using (player_id = (select public.current_player_id()));

insert into public.calendar_tokens (player_id) select id from public.players
on conflict (player_id) do nothing;

-- Every new roster row gets a token. Definer: captains have no insert policy on calendar_tokens.
create or replace function public.create_calendar_token()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.calendar_tokens (player_id) values (new.id) on conflict (player_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_calendar_token() from public, anon, authenticated;

create trigger players_calendar_token after insert on public.players
  for each row execute function public.create_calendar_token();

-- "Reset link": the old feed URL stops working immediately.
create or replace function public.regenerate_my_calendar_token()
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_player uuid := public.current_player_id();
  v_token  uuid;
begin
  if v_player is null then
    raise exception 'Only players on the roster have a calendar link' using errcode = '42501';
  end if;
  insert into public.calendar_tokens (player_id) values (v_player)
  on conflict (player_id) do update set token = gen_random_uuid(), created_at = now()
  returning token into v_token;
  return v_token;
end;
$$;

revoke execute on function public.regenerate_my_calendar_token() from public, anon;
grant execute on function public.regenerate_my_calendar_token() to authenticated;

-- Personal ICS feed. Service role only: the route handler calls it with the token from the URL,
-- and the token is the whole check. Null when the token is unknown or the player is inactive.
create or replace function public.calendar_feed(p_token uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'player', p.full_name,
    'items', coalesce((
      select jsonb_agg(i order by i.starts_at)
      from (
        select m.id, 'match' as kind,
               case when m.home_away = 'home' then 'vs. ' else '@ ' end || m.opponent as title,
               m.starts_at, null::timestamptz as ends_at, m.location_name, m.location_address,
               m.home_away, m.status, m.team_points, m.opponent_points, null::text as description
        from public.matches m
        where m.starts_at >= now() - interval '120 days' and m.starts_at < now() + interval '400 days'
        union all
        select e.id, e.type::text, e.title, e.starts_at, e.ends_at, e.location, null,
               null, null, null, null, e.description
        from public.events e
        where e.starts_at >= now() - interval '120 days' and e.starts_at < now() + interval '400 days'
      ) i
    ), '[]'::jsonb)
  )
  from public.calendar_tokens t
  join public.players p on p.id = t.player_id and p.is_active
  where t.token = p_token
$$;

revoke execute on function public.calendar_feed(uuid) from public, anon, authenticated;
grant execute on function public.calendar_feed(uuid) to service_role;

-------------------------------------------------------------------------------
-- Photos
-------------------------------------------------------------------------------
create table public.photos (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid references public.seasons (id) on delete set null,
  match_id    uuid references public.matches (id) on delete set null,
  path        text not null unique,   -- object name in the "photos" bucket
  thumb_path  text not null unique,
  width       integer not null check (width > 0),
  height      integer not null check (height > 0),
  caption     text check (char_length(caption) <= 200),
  is_public   boolean not null default false,
  uploaded_by uuid references public.players (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index photos_created on public.photos (created_at desc);
create trigger photos_updated_at before update on public.photos for each row execute function public.set_updated_at();

alter table public.photos enable row level security;
create policy "read public or member photos" on public.photos for select to anon, authenticated
  using (is_public or (select public.is_member()));
create policy "captains manage photos" on public.photos for all to authenticated
  using ((select public.is_captain())) with check ((select public.is_captain()));

-- Private bucket: files are served through signed URLs, which need select permission below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Members read every photo file; anyone reads the files of a photo marked public.
create policy "read public or member photo files" on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and (
      (select public.is_member())
      or exists (
        select 1 from public.photos p
        where p.is_public and storage.objects.name in (p.path, p.thumb_path)
      )
    )
  );
create policy "captains upload photo files" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select public.is_captain()));
create policy "captains update photo files" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select public.is_captain()))
  with check (bucket_id = 'photos' and (select public.is_captain()));
create policy "captains delete photo files" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_captain()));
