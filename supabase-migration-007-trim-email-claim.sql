-- ============================================================
-- PDR Tracker — Migration 007: Trim emails in the invite-claim match
-- Run in Supabase > SQL Editor > New Query, after migration 006.
--
-- The roster claim (migration 002) and the invite-only signup gate
-- (migration 006) both compare emails with lower() but not trimmed —
-- a stray leading/trailing space typed at signup (easy to pick up from
-- a mobile keyboard or autofill) gets baked into auth.users.email
-- permanently and silently fails the match forever, even though the
-- admin-invited profiles.email looks identical at a glance (it's
-- trimmed on save, in storage.js's saveProfile()). The app itself now
-- also trims+lowercases the email before every sign-in/sign-up call,
-- but this migration re-does the match with btrim() too, so it's not
-- solely dependent on the client having done that, and so it retroactively
-- fixes matching for anyone who already has a stray space baked in.
-- ============================================================

drop policy if exists "Users can claim a pre-created profile by email match" on public.profiles;
create policy "Users can claim a pre-created profile by email match"
  on public.profiles for update
  to authenticated
  using (user_id is null and lower(btrim(email)) = lower(btrim(auth.jwt() ->> 'email')))
  with check (user_id = auth.uid() and lower(btrim(email)) = lower(btrim(auth.jwt() ->> 'email')));

create or replace function public.invite_only_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  signup_email text := lower(btrim(event->'user'->>'email'));
begin
  if signup_email is not null and exists (
    select 1
    from public.profiles
    where user_id is null and lower(btrim(email)) = signup_email
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This email has not been invited. Ask an administrator to add it first.'
    )
  );
end;
$$;
