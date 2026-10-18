-- Phase 8: the Home page team photo, chosen by a captain from the gallery.
--   * photos.is_team_photo: at most one row (partial unique index), and only a public photo
--     (check constraint), because Home is a public page.
--   * set_team_photo(): makes a photo the team photo and public in one transaction.

alter table public.photos
  add column is_team_photo boolean not null default false,
  add constraint photos_team_photo_is_public check (not is_team_photo or is_public);

create unique index photos_one_team_photo on public.photos (is_team_photo) where is_team_photo;

-- Invoker, so "captains manage photos" still applies; the is_captain() check gives a clear error.
-- Pass null to clear the team photo (Home falls back to its placeholder).
create or replace function public.set_team_photo(p_photo_id uuid)
returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
  if not public.is_captain() then
    raise exception 'Only captains can choose the team photo' using errcode = '42501';
  end if;
  if p_photo_id is not null and not exists (select 1 from public.photos where id = p_photo_id) then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;

  update public.photos set is_team_photo = false where is_team_photo and id is distinct from p_photo_id;
  if p_photo_id is not null then
    update public.photos set is_team_photo = true, is_public = true where id = p_photo_id;
  end if;
end;
$$;

revoke execute on function public.set_team_photo(uuid) from public, anon;
grant execute on function public.set_team_photo(uuid) to authenticated;
