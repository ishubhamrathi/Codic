-- 002: Add folders table and folder_id to projects

create table if not exists public.uml_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  parent_id uuid references public.uml_folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.uml_folders enable row level security;

-- Folders policies
create policy "Users read own folders"
  on public.uml_folders for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own folders"
  on public.uml_folders for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own folders"
  on public.uml_folders for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete own folders"
  on public.uml_folders for delete to authenticated
  using (auth.uid() = user_id);

-- Add folder_id to projects
alter table public.uml_projects
  add column if not exists folder_id uuid
  references public.uml_folders(id) on delete set null;
