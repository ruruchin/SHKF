-- Employee accounts: username login, position, avatar, forced password change.
-- New users are added ONLY by inserting them here / via the seed script — no self sign-up.

-- 1. Extend profiles with employee fields.
alter table public.profiles
  add column if not exists username text,
  add column if not exists position text not null default '',
  add column if not exists avatar_url text not null default '',
  add column if not exists must_change_password boolean not null default true;

-- Username like "k.zorenko" (k = first letter of name, zorenko = surname). Unique, optional null-safe.
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- 2. Let users maintain their own display fields (full_name, position, avatar_url,
--    must_change_password). Role stays admin-only (changed in Supabase dashboard / via service key).
--    The existing "profiles_update_own_limited" policy already allows owner updates;
--    column-level protection of "role" is enforced by not exposing it from the app.

-- 3. Avatars storage bucket (public read, owner write under their own folder).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Carry username / position / avatar from auth metadata when a user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, username, position, avatar_url, must_change_password)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'designer'::public.app_role),
    nullif(new.raw_user_meta_data->>'username', ''),
    coalesce(new.raw_user_meta_data->>'position', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id, settings, app_state)
  values (new.id, '{}'::jsonb, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
exception
  when invalid_text_representation then
    insert into public.profiles (id, email, full_name, role, username, position, avatar_url, must_change_password)
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      'designer',
      nullif(new.raw_user_meta_data->>'username', ''),
      coalesce(new.raw_user_meta_data->>'position', ''),
      coalesce(new.raw_user_meta_data->>'avatar_url', ''),
      true
    )
    on conflict (id) do nothing;
    insert into public.user_settings (user_id, settings, app_state)
    values (new.id, '{}'::jsonb, '{}'::jsonb)
    on conflict (user_id) do nothing;
    return new;
end;
$$;
