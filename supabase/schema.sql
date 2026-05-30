create extension if not exists "pgcrypto";

create table if not exists public.uml_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.uml_projects enable row level security;

create policy "Allow anon project reads"
on public.uml_projects
for select
to anon
using (true);

create policy "Allow anon project writes"
on public.uml_projects
for insert
to anon
with check (true);

create policy "Allow anon project updates"
on public.uml_projects
for update
to anon
using (true)
with check (true);
