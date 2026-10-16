-- Phase 4: roster CSV import, and relinking a player's login when the captain changes their email.

-------------------------------------------------------------------------------
-- Email change unlinks the old login
-------------------------------------------------------------------------------
-- Before: user_id was only filled when null, so a changed email stayed attached to the
-- old auth user. Now an email change clears the link, then relinks by the new email.
create or replace function public.link_user_on_player_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and lower(new.email) is distinct from lower(old.email) then
    new.user_id := null;
  end if;
  if new.user_id is null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = lower(new.email)
     limit 1;
  end if;
  return new;
end; $$;

-------------------------------------------------------------------------------
-- import_players(rows): upsert by lower(email)
-------------------------------------------------------------------------------
-- p_rows is a JSON array of {full_name, email, phone, usta_number, ntrp_rating,
-- position_pref, is_active}. Null or missing fields keep the existing value on update.
-- role is never set here: new players default to 'player'; roles change in the edit form.
-- Security invoker, so the "captains manage players" policy is what authorizes the writes;
-- the is_captain() check only gives a clear error. One statement, so the batch is atomic.
create or replace function public.import_players(p_rows jsonb)
returns table (email text, outcome text)
language plpgsql security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_captain() then
    raise exception 'Only captains can import players' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;

  return query
  with input as (
    select distinct on (lower(trim(r.email)))
           lower(trim(r.email))           as email,
           nullif(trim(r.full_name), '')   as full_name,
           nullif(trim(r.phone), '')       as phone,
           nullif(trim(r.usta_number), '') as usta_number,
           r.ntrp_rating,
           r.position_pref,
           r.is_active
      from jsonb_to_recordset(p_rows) as r(
             full_name text, email text, phone text, usta_number text,
             ntrp_rating numeric, position_pref public.position_pref, is_active boolean)
     where nullif(trim(r.email), '') is not null
  ),
  updated as (
    update public.players p
       set full_name     = coalesce(i.full_name, p.full_name),
           phone         = coalesce(i.phone, p.phone),
           usta_number   = coalesce(i.usta_number, p.usta_number),
           ntrp_rating   = coalesce(i.ntrp_rating, p.ntrp_rating),
           position_pref = coalesce(i.position_pref, p.position_pref),
           is_active     = coalesce(i.is_active, p.is_active)
      from input i
     where lower(p.email) = i.email
       and (coalesce(i.full_name, p.full_name), coalesce(i.phone, p.phone),
            coalesce(i.usta_number, p.usta_number), coalesce(i.ntrp_rating, p.ntrp_rating),
            coalesce(i.position_pref, p.position_pref), coalesce(i.is_active, p.is_active))
           is distinct from
           (p.full_name, p.phone, p.usta_number, p.ntrp_rating, p.position_pref, p.is_active)
    returning i.email
  ),
  inserted as (
    insert into public.players (full_name, email, phone, usta_number, ntrp_rating, position_pref, is_active)
    select i.full_name, i.email, i.phone, i.usta_number, i.ntrp_rating,
           coalesce(i.position_pref, 'both'), coalesce(i.is_active, true)
      from input i
     where not exists (select 1 from public.players p where lower(p.email) = i.email)
    returning lower(players.email) as email
  )
  select i.email,
         case when ins.email is not null then 'created'
              when upd.email is not null then 'updated'
              else 'unchanged' end
    from input i
    left join inserted ins on ins.email = i.email
    left join updated  upd on upd.email = i.email;
end;
$$;

revoke execute on function public.import_players(jsonb) from public, anon;
grant execute on function public.import_players(jsonb) to authenticated;
