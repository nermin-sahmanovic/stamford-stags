-- Stamford Stags: initial schema (Phase 1)
-- Tables, helper functions, triggers, RLS policies, views and RPCs.
-- Authorization lives here: the app may hide UI, but these policies decide access.

-------------------------------------------------------------------------------
-- Enums
-------------------------------------------------------------------------------
create type public.member_role as enum ('captain', 'co_captain', 'player');
create type public.position_pref as enum ('singles', 'doubles', 'both');
create type public.availability_status as enum ('available', 'maybe', 'unavailable');
create type public.home_away as enum ('home', 'away');
create type public.line_type as enum ('singles', 'doubles');
create type public.rsvp_status as enum ('pending', 'confirmed', 'declined');
create type public.match_status as enum ('scheduled', 'completed', 'cancelled');
create type public.event_type as enum ('practice', 'social', 'usta_deadline', 'registration', 'other');
create type public.registration_status as enum ('pending', 'invited', 'declined', 'withdrawn');
create type public.message_audience as enum ('team', 'match', 'custom');
create type public.news_type as enum ('announcement', 'result', 'event');

-------------------------------------------------------------------------------
-- updated_at helper
-------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------
create table public.seasons (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  league              text,
  division            text,
  age_group           text,                                  -- e.g. '18+', '40+'
  ntrp_level          numeric(2,1) not null check (ntrp_level between 2.0 and 6.0),
  min_ntrp            numeric(2,1) check (min_ntrp is null or min_ntrp <= ntrp_level),
  singles_lines       smallint not null default 2 check (singles_lines between 0 and 5),
  doubles_lines       smallint not null default 3 check (doubles_lines between 0 and 5),
  max_roster          smallint not null default 16 check (max_roster > 0),
  playoff_min_matches smallint not null default 2 check (playoff_min_matches >= 0),
  starts_on           date,
  ends_on             date,
  is_current          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index seasons_one_current on public.seasons (is_current) where is_current;

create table public.players (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users (id) on delete set null,
  full_name     text not null check (char_length(full_name) between 2 and 120),
  email         text not null,
  phone         text,
  usta_number   text,
  ntrp_rating   numeric(2,1) check (ntrp_rating between 1.0 and 7.0),
  position_pref public.position_pref not null default 'both',
  role          public.member_role not null default 'player',
  is_active     boolean not null default true,
  joined_on     date default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index players_email_lower on public.players (lower(email));

create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id) on delete cascade,
  opponent         text not null,
  starts_at        timestamptz not null,
  home_away        public.home_away not null,
  location_name    text,
  location_address text,
  captain_notes    text,
  status           public.match_status not null default 'scheduled',
  team_points      smallint check (team_points >= 0),
  opponent_points  smallint check (opponent_points >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index matches_season_starts on public.matches (season_id, starts_at);

create table public.lineup_slots (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  line_type   public.line_type not null,
  line_number smallint not null check (line_number between 1 and 5),
  seat        smallint not null default 1 check (seat in (1, 2)),
  player_id   uuid not null references public.players (id) on delete cascade,
  court_label text,
  rsvp        public.rsvp_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint singles_one_seat check (line_type = 'doubles' or seat = 1),
  unique (match_id, line_type, line_number, seat),
  unique (match_id, player_id)
);
create index lineup_slots_player on public.lineup_slots (player_id);

create table public.line_results (
  match_id    uuid not null references public.matches (id) on delete cascade,
  line_type   public.line_type not null,
  line_number smallint not null check (line_number between 1 and 5),
  won         boolean not null,
  score       text,                                          -- e.g. '6-3 4-6 10-7'
  primary key (match_id, line_type, line_number)
);

create table public.availability (
  match_id   uuid not null references public.matches (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  status     public.availability_status not null,
  note       text check (char_length(coalesce(note, '')) <= 280),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index availability_player on public.availability (player_id);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid references public.seasons (id) on delete set null,
  type        public.event_type not null,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text,
  description text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts on public.events (starts_at);

create table public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  label      text not null,
  done       boolean not null default false,
  sort       smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.registrations (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null check (char_length(full_name) between 2 and 120),
  email              text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone              text check (char_length(coalesce(phone, '')) <= 40),
  usta_number        text check (char_length(coalesce(usta_number, '')) <= 20),
  ntrp_rating        numeric(2,1) check (ntrp_rating between 1.0 and 7.0),
  position_pref      public.position_pref not null default 'both',
  availability_slots text[] not null default '{}',
  notes              text check (char_length(coalesce(notes, '')) <= 2000),
  status             public.registration_status not null default 'pending',
  reviewed_by        uuid references public.players (id) on delete set null,
  reviewed_at        timestamptz,
  player_id          uuid references public.players (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  sent_by         uuid references public.players (id) on delete set null,
  audience        public.message_audience not null,
  match_id        uuid references public.matches (id) on delete set null,
  subject         text not null,
  body            text not null,
  recipient_count integer not null default 0,
  provider        text,
  status          text not null default 'sent' check (status in ('queued', 'sent', 'failed')),
  error           text,
  sent_at         timestamptz not null default now()
);

create table public.message_recipients (
  message_id uuid not null references public.messages (id) on delete cascade,
  player_id  uuid references public.players (id) on delete set null,
  email      text not null,
  primary key (message_id, email)
);
create index message_recipients_player on public.message_recipients (player_id);

create table public.news_posts (
  id           uuid primary key default gen_random_uuid(),
  type         public.news_type not null,
  title        text not null,
  body         text,
  is_public    boolean not null default true,
  published_at timestamptz not null default now(),
  author_id    uuid references public.players (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One-tap RSVP links in emails. Service role only (RLS on, no policies).
create table public.rsvp_tokens (
  token      uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  used_at    timestamptz
);

-------------------------------------------------------------------------------
-- updated_at triggers
-------------------------------------------------------------------------------
create trigger seasons_updated_at       before update on public.seasons       for each row execute function public.set_updated_at();
create trigger players_updated_at       before update on public.players       for each row execute function public.set_updated_at();
create trigger matches_updated_at       before update on public.matches       for each row execute function public.set_updated_at();
create trigger lineup_slots_updated_at  before update on public.lineup_slots  for each row execute function public.set_updated_at();
create trigger availability_updated_at  before update on public.availability  for each row execute function public.set_updated_at();
create trigger events_updated_at        before update on public.events        for each row execute function public.set_updated_at();
create trigger registrations_updated_at before update on public.registrations for each row execute function public.set_updated_at();
create trigger news_posts_updated_at    before update on public.news_posts    for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Identity helpers (security definer so policies on players don't recurse)
-------------------------------------------------------------------------------
create or replace function public.current_player_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.id from public.players p
  where p.user_id = auth.uid() and p.is_active
$$;

create or replace function public.is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.players p
    where p.user_id = auth.uid() and p.is_active
  )
$$;

create or replace function public.is_captain()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.players p
    where p.user_id = auth.uid() and p.is_active
      and p.role in ('captain', 'co_captain')
  )
$$;

grant execute on function public.current_player_id() to anon, authenticated;
grant execute on function public.is_member()         to anon, authenticated;
grant execute on function public.is_captain()        to anon, authenticated;

-------------------------------------------------------------------------------
-- Link auth users to roster rows by email (both directions)
-------------------------------------------------------------------------------
create or replace function public.link_player_on_signup()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.players
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_player_on_signup();

create or replace function public.link_user_on_player_write()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = lower(new.email)
     limit 1;
  end if;
  return new;
end;
$$;

create trigger players_link_user
  before insert or update of email on public.players
  for each row execute function public.link_user_on_player_write();

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------
alter table public.seasons            enable row level security;
alter table public.players            enable row level security;
alter table public.matches            enable row level security;
alter table public.lineup_slots       enable row level security;
alter table public.line_results       enable row level security;
alter table public.availability       enable row level security;
alter table public.events             enable row level security;
alter table public.checklist_items    enable row level security;
alter table public.registrations      enable row level security;
alter table public.messages           enable row level security;
alter table public.message_recipients enable row level security;
alter table public.news_posts         enable row level security;
alter table public.rsvp_tokens        enable row level security;  -- no policies: service role only

-- Pattern: members read, captains manage.
create policy "members read seasons"       on public.seasons         for select to authenticated using ((select public.is_member()));
create policy "captains manage seasons"    on public.seasons         for all    to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));

create policy "members read players"       on public.players         for select to authenticated using ((select public.is_member()));
create policy "captains manage players"    on public.players         for all    to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));

create policy "members read matches"       on public.matches         for select to authenticated using ((select public.is_member()));
create policy "captains manage matches"    on public.matches         for all    to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));

create policy "members read lineups"       on public.lineup_slots    for select to authenticated using ((select public.is_member()));
create policy "captains manage lineups"    on public.lineup_slots    for all    to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));

create policy "members read line results"  on public.line_results    for select to authenticated using ((select public.is_member()));
create policy "captains manage results"    on public.line_results    for all    to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));

create policy "members read events"        on public.events          for select to authenticated using ((select public.is_member()));
create policy "captains manage events"     on public.events          for all    to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));

create policy "members read checklist"     on public.checklist_items for select to authenticated using ((select public.is_member()));
create policy "captains manage checklist"  on public.checklist_items for all    to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));

-- Availability: everyone on the team can see it; you write your own row, captains write any.
create policy "members read availability"  on public.availability for select to authenticated
  using ((select public.is_member()));
create policy "own or captain insert availability" on public.availability for insert to authenticated
  with check (player_id = (select public.current_player_id()) or (select public.is_captain()));
create policy "own or captain update availability" on public.availability for update to authenticated
  using (player_id = (select public.current_player_id()) or (select public.is_captain()))
  with check (player_id = (select public.current_player_id()) or (select public.is_captain()));
create policy "own or captain delete availability" on public.availability for delete to authenticated
  using (player_id = (select public.current_player_id()) or (select public.is_captain()));

-- Registrations: anyone may submit a pending application; only captains read or change them.
create policy "anyone submits registration" on public.registrations for insert to anon, authenticated
  with check (status = 'pending' and reviewed_by is null and reviewed_at is null and player_id is null);
create policy "captains read registrations"   on public.registrations for select to authenticated using ((select public.is_captain()));
create policy "captains update registrations" on public.registrations for update to authenticated using ((select public.is_captain())) with check ((select public.is_captain()));
create policy "captains delete registrations" on public.registrations for delete to authenticated using ((select public.is_captain()));

-- Messages: written server-side with the service role. Captains read all; players read what they received.
create policy "captains or recipients read messages" on public.messages for select to authenticated
  using (
    (select public.is_captain())
    or exists (
      select 1 from public.message_recipients r
      where r.message_id = messages.id
        and r.player_id = (select public.current_player_id())
    )
  );
create policy "captains or self read recipients" on public.message_recipients for select to authenticated
  using ((select public.is_captain()) or player_id = (select public.current_player_id()));

-- News: public posts are visible to everyone; private posts to members.
create policy "read public or member news" on public.news_posts for select to anon, authenticated
  using (is_public or (select public.is_member()));
create policy "captains manage news" on public.news_posts for all to authenticated
  using ((select public.is_captain())) with check ((select public.is_captain()));

-------------------------------------------------------------------------------
-- Views (security_invoker: they respect the caller's RLS)
-------------------------------------------------------------------------------
create view public.player_records with (security_invoker = true) as
select ls.player_id,
       count(*) filter (where lr.won)     as wins,
       count(*) filter (where not lr.won) as losses
from public.lineup_slots ls
join public.matches m       on m.id = ls.match_id and m.status = 'completed'
join public.line_results lr on lr.match_id = ls.match_id
                           and lr.line_type = ls.line_type
                           and lr.line_number = ls.line_number
group by ls.player_id;

create view public.match_availability_summary with (security_invoker = true) as
select m.id                                                  as match_id,
       m.starts_at,
       (s.singles_lines + 2 * s.doubles_lines)               as players_needed,
       count(*) filter (where a.status = 'available')        as available,
       count(*) filter (where a.status = 'maybe')            as maybe,
       count(*) filter (where a.status = 'unavailable')      as unavailable,
       (select count(*) from public.players p where p.is_active) - count(a.player_id) as no_response
from public.matches m
join public.seasons s           on s.id = m.season_id
left join public.availability a on a.match_id = m.id
group by m.id, m.starts_at, s.singles_lines, s.doubles_lines;

-------------------------------------------------------------------------------
-- RPCs
-------------------------------------------------------------------------------

-- Player sets their own availability (RLS still applies: invoker).
create or replace function public.set_my_availability(
  p_match_id uuid,
  p_status   public.availability_status,
  p_note     text default null
)
returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_player uuid := public.current_player_id();
begin
  if v_player is null then
    raise exception 'Not an active team member' using errcode = '42501';
  end if;
  insert into public.availability (match_id, player_id, status, note)
  values (p_match_id, v_player, p_status, p_note)
  on conflict (match_id, player_id)
  do update set status = excluded.status, note = excluded.note;
end;
$$;

-- Player confirms or declines their lineup spot. Definer because players have no
-- update policy on lineup_slots; it only touches the caller's own slot.
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
  update public.lineup_slots
     set rsvp = p_rsvp
   where match_id = p_match_id
     and player_id = v_player;
  if not found then
    raise exception 'You are not in the lineup for this match' using errcode = 'P0002';
  end if;
end;
$$;

-- Player edits the few profile fields they own.
create or replace function public.update_my_profile(
  p_phone         text,
  p_position_pref public.position_pref
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
  update public.players
     set phone = nullif(trim(p_phone), ''),
         position_pref = p_position_pref
   where id = v_player;
end;
$$;

-- Who can play this match, and why not. Rules come from the season row.
-- TODO(captain): confirm the league's actual rules; extend here, not in the app.
create or replace function public.eligible_players(p_match_id uuid)
returns table (
  player_id        uuid,
  full_name        text,
  ntrp_rating      numeric,
  availability     public.availability_status,
  matches_played   bigint,
  rating_ok        boolean,
  playoff_eligible boolean
)
language sql stable security invoker
set search_path = ''
as $$
  with ctx as (
    select m.id, m.season_id, s.ntrp_level, s.min_ntrp, s.playoff_min_matches
    from public.matches m
    join public.seasons s on s.id = m.season_id
    where m.id = p_match_id
  ),
  played as (
    select ls.player_id, count(distinct ls.match_id) as n
    from public.lineup_slots ls
    join public.matches m on m.id = ls.match_id
    where m.season_id = (select season_id from ctx)
      and m.status = 'completed'
    group by ls.player_id
  )
  select p.id,
         p.full_name,
         p.ntrp_rating,
         a.status,
         coalesce(pl.n, 0),
         (p.ntrp_rating is not null
            and p.ntrp_rating <= ctx.ntrp_level
            and (ctx.min_ntrp is null or p.ntrp_rating >= ctx.min_ntrp)),
         coalesce(pl.n, 0) >= ctx.playoff_min_matches
  from public.players p
  cross join ctx
  left join public.availability a on a.match_id = ctx.id and a.player_id = p.id
  left join played pl             on pl.player_id = p.id
  where p.is_active
  order by (a.status = 'available') desc nulls last,
           p.ntrp_rating desc nulls last,
           p.full_name
$$;

-- Public home-page numbers. Definer so anon can call it without reading tables.
create or replace function public.public_team_summary()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with s as (
    select * from public.seasons where is_current limit 1
  ),
  m as (
    select * from public.matches where season_id = (select id from s)
  ),
  roster as (
    select count(*)::int as n from public.players where is_active
  )
  select jsonb_build_object(
    'season',       (select name from s),
    'player_count', (select n from roster),
    'open_spots',   greatest(0, coalesce((select max_roster from s), 0) - (select n from roster)),
    'wins',         (select count(*) from m where status = 'completed' and team_points > opponent_points),
    'losses',       (select count(*) from m where status = 'completed' and team_points < opponent_points),
    'next_match',   (
      select jsonb_build_object(
        'opponent', opponent, 'starts_at', starts_at,
        'home_away', home_away, 'location_name', location_name)
      from m
      where status = 'scheduled' and starts_at > now()
      order by starts_at
      limit 1
    )
  )
$$;

-- Public schedule: matches plus events marked public. No notes, no lineups.
create or replace function public.public_schedule(p_from timestamptz default now())
returns table (
  kind          text,
  title         text,
  starts_at     timestamptz,
  home_away     public.home_away,
  location_name text,
  status        public.match_status
)
language sql stable security definer
set search_path = ''
as $$
  select 'match',
         case when m.home_away = 'home' then 'vs. ' else '@ ' end || m.opponent,
         m.starts_at, m.home_away, m.location_name, m.status
  from public.matches m
  where m.starts_at >= p_from
  union all
  select e.type::text, e.title, e.starts_at, null, e.location, null
  from public.events e
  where e.is_public and e.starts_at >= p_from
  order by 3
$$;

grant execute on function public.set_my_availability(uuid, public.availability_status, text) to authenticated;
grant execute on function public.set_my_rsvp(uuid, public.rsvp_status)                         to authenticated;
grant execute on function public.update_my_profile(text, public.position_pref)                 to authenticated;
grant execute on function public.eligible_players(uuid)                                        to authenticated;
grant execute on function public.public_team_summary()                                         to anon, authenticated;
grant execute on function public.public_schedule(timestamptz)                                  to anon, authenticated;
