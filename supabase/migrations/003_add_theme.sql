-- 003: Add theme preference to user_profiles

alter table public.user_profiles
  add column if not exists theme text not null default 'light';
