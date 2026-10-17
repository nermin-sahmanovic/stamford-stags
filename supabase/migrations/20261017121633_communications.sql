-- Phase 7: communications.
--   * Per-recipient delivery status, and what kind of message each one was.
--   * One RSVP token per player per match, valid until the match starts.
--   * Token RPCs for the one-tap links. Service role only: the app calls them after it has
--     nothing but a token to go on (no session), so they are never exposed to clients.

-- Delivery results per recipient (one email per player).
alter table public.message_recipients
  add column status text not null default 'sent' check (status in ('queued', 'sent', 'failed')),
  add column error text,
  add column provider_message_id text;

-- kind: 'message' (compose), 'reminder' (non-responders), 'lineup' (lineup published/updated).
-- automated: sent by the daily cron. delivery: 'live', 'redirect' (dev: all mail to one address) or 'log'.
alter table public.messages
  add column kind text not null default 'message' check (kind in ('message', 'reminder', 'lineup')),
  add column automated boolean not null default false,
  add column delivery text check (delivery in ('live', 'redirect', 'log')),
  drop constraint messages_status_check,
  add constraint messages_status_check check (status in ('queued', 'sent', 'partial', 'failed'));
create index messages_match_kind on public.messages (match_id, kind);
create index messages_sent_at on public.messages (sent_at desc);

alter table public.rsvp_tokens
  add column created_at timestamptz not null default now(),
  add constraint rsvp_tokens_player_match unique (player_id, match_id);

-- Tokens for these players on this match (created or reused), expiring when the match starts.
create or replace function public.issue_rsvp_tokens(p_match_id uuid, p_player_ids uuid[])
returns table (player_id uuid, token uuid)
language sql security definer
set search_path = ''
as $$
  insert into public.rsvp_tokens as t (player_id, match_id, expires_at)
  select ids.pid, m.id, m.starts_at
  from (select distinct unnest(p_player_ids) as pid) ids
  cross join public.matches m
  where m.id = p_match_id
  on conflict (player_id, match_id) do update set expires_at = excluded.expires_at
  returning t.player_id, t.token
$$;

-- What a token is for, without changing anything (the link's landing page reads this first).
create or replace function public.peek_rsvp_token(p_token uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'valid',        t.expires_at > now() and p.is_active and m.status = 'scheduled' and m.starts_at > now(),
    'player_name',  p.full_name,
    'match_id',     m.id,
    'opponent',     m.opponent,
    'home_away',    m.home_away,
    'starts_at',    m.starts_at,
    'availability', a.status,
    'in_lineup',    ls.player_id is not null and m.lineup_published_at is not null,
    'rsvp',         case when m.lineup_published_at is not null then ls.rsvp end
  )
  from public.rsvp_tokens t
  join public.players p on p.id = t.player_id
  join public.matches m on m.id = t.match_id
  left join public.availability a on a.match_id = m.id and a.player_id = p.id
  left join public.lineup_slots ls on ls.match_id = m.id and ls.player_id = p.id
  where t.token = p_token
$$;

-- Apply a one-tap answer. available / maybe / unavailable set availability; confirmed / declined
-- set the lineup RSVP (published lineup only). Tokens stay usable until expiry, so a player can
-- change their mind.
create or replace function public.apply_rsvp_token(p_token uuid, p_answer text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v record;
begin
  select t.player_id, t.match_id, t.expires_at, p.full_name, p.is_active,
         m.opponent, m.home_away, m.starts_at, m.status, m.lineup_published_at
    into v
    from public.rsvp_tokens t
    join public.players p on p.id = t.player_id
    join public.matches m on m.id = t.match_id
   where t.token = p_token;
  if not found or v.expires_at <= now() or not v.is_active then
    raise exception 'This link has expired' using errcode = 'P0002';
  end if;
  if v.status <> 'scheduled' or v.starts_at <= now() then
    raise exception 'This match is closed for replies' using errcode = 'P0001';
  end if;

  if p_answer in ('available', 'maybe', 'unavailable') then
    insert into public.availability (match_id, player_id, status)
    values (v.match_id, v.player_id, p_answer::public.availability_status)
    on conflict (match_id, player_id) do update set status = excluded.status;
  elsif p_answer in ('confirmed', 'declined') then
    if v.lineup_published_at is null then
      raise exception 'You are not in the lineup for this match' using errcode = 'P0001';
    end if;
    update public.lineup_slots set rsvp = p_answer::public.rsvp_status
     where match_id = v.match_id and player_id = v.player_id;
    if not found then
      raise exception 'You are not in the lineup for this match' using errcode = 'P0001';
    end if;
  else
    raise exception 'Unknown answer' using errcode = '22023';
  end if;

  update public.rsvp_tokens set used_at = now() where token = p_token;
  return jsonb_build_object(
    'player_name', v.full_name, 'match_id', v.match_id, 'opponent', v.opponent,
    'home_away', v.home_away, 'starts_at', v.starts_at, 'answer', p_answer);
end;
$$;

revoke execute on function public.issue_rsvp_tokens(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.peek_rsvp_token(uuid)            from public, anon, authenticated;
revoke execute on function public.apply_rsvp_token(uuid, text)      from public, anon, authenticated;
grant  execute on function public.issue_rsvp_tokens(uuid, uuid[]) to service_role;
grant  execute on function public.peek_rsvp_token(uuid)            to service_role;
grant  execute on function public.apply_rsvp_token(uuid, text)      to service_role;
