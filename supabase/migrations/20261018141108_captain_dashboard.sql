-- Phase 9: captain dashboard.
--   * invite_registration(): turns a pending Join-form registration into a roster player in one
--     transaction (or links the existing player with that email) and marks it invited.
--   * messages.kind gains 'invite' so the welcome email shows in the message history.

alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('message', 'reminder', 'lineup', 'invite'));

-- Invoker, so "captains manage players / registrations" still apply; the is_captain() check gives
-- a clear error. Never sets a role: invited players are always 'player'. Returns the player id.
create or replace function public.invite_registration(p_registration_id uuid)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_reg    public.registrations%rowtype;
  v_player uuid;
begin
  if not public.is_captain() then
    raise exception 'Only captains can invite players' using errcode = '42501';
  end if;

  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found or v_reg.status <> 'pending' then
    raise exception 'That registration isn''t waiting for review' using errcode = 'P0002';
  end if;

  -- Already on the roster (perhaps inactive)? Link to that player instead of duplicating.
  select id into v_player from public.players where lower(email) = lower(btrim(v_reg.email));
  if v_player is null then
    insert into public.players (full_name, email, phone, usta_number, ntrp_rating, position_pref)
    values (btrim(v_reg.full_name), lower(btrim(v_reg.email)), nullif(btrim(v_reg.phone), ''),
            nullif(btrim(v_reg.usta_number), ''), v_reg.ntrp_rating, v_reg.position_pref)
    returning id into v_player;
  end if;

  update public.registrations
     set status = 'invited', player_id = v_player,
         reviewed_by = public.current_player_id(), reviewed_at = now()
   where id = p_registration_id;

  return v_player;
end;
$$;

revoke execute on function public.invite_registration(uuid) from public, anon;
grant execute on function public.invite_registration(uuid) to authenticated;
