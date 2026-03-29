create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  day_index int not null,
  row_index int not null,
  title text not null default '',
  notes text not null default '',
  status text not null default 'none',
  task_time text not null default '',
  detail_color text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start, day_index, row_index)
);

alter table public.tasks
  add column if not exists status text not null default 'none';

alter table public.tasks
  add column if not exists task_time text not null default '';

alter table public.tasks
  add column if not exists detail_color text not null default 'default';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'completed'
  ) then
    execute $sql$
      update public.tasks
      set status = 'done'
      where status = 'none' and coalesce(completed, false) = true
    $sql$;

    execute 'alter table public.tasks drop column completed';
  end if;
end $$;

alter table public.tasks
  alter column status set default 'none';

alter table public.tasks
  alter column task_time set default '';

alter table public.tasks
  alter column detail_color set default 'default';

alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('none', 'low', 'urgent', 'critical', 'done'));

alter table public.tasks
  drop constraint if exists tasks_detail_color_check;

alter table public.tasks
  add constraint tasks_detail_color_check
  check (detail_color in ('default', 'blue', 'green', 'amber', 'pink', 'violet'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;

create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "users can read own tasks" on public.tasks;
create policy "users can read own tasks"
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own tasks" on public.tasks;
create policy "users can insert own tasks"
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own tasks" on public.tasks;
create policy "users can update own tasks"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own tasks" on public.tasks;
create policy "users can delete own tasks"
on public.tasks
for delete
using (auth.uid() = user_id);
