create extension if not exists pgcrypto;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  day_index int not null,
  row_index int not null,
  title text not null default '',
  notes text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start, day_index, row_index)
);

alter table public.tasks enable row level security;

create policy "users can read own tasks"
on public.tasks
for select
using (auth.uid() = user_id);

create policy "users can insert own tasks"
on public.tasks
for insert
with check (auth.uid() = user_id);

create policy "users can update own tasks"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own tasks"
on public.tasks
for delete
using (auth.uid() = user_id);
