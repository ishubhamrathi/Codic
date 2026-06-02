-- 001: Initial schema - user_profiles and uml_projects

create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.uml_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.uml_projects enable row level security;

-- User profiles policies
create policy "Users read own profile"
  on public.user_profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.user_profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.user_profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Projects policies
create policy "Users read own projects"
  on public.uml_projects for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own projects"
  on public.uml_projects for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own projects"
  on public.uml_projects for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete own projects"
  on public.uml_projects for delete to authenticated
  using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
