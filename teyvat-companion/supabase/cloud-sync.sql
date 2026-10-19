-- Teyvat Companion optional cloud backup.
-- Run once in your Supabase project's SQL Editor.
-- Each authenticated user can access only their own saved workspace.

create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state_json jsonb not null
    check (jsonb_typeof(state_json) = 'object')
    check (pg_column_size(state_json) < 5000000),
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;

revoke all on table public.user_workspaces from anon, authenticated;
grant select, insert, update on table public.user_workspaces to authenticated;

drop policy if exists "Users can read their own workspace" on public.user_workspaces;
create policy "Users can read their own workspace"
  on public.user_workspaces for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can create their own workspace" on public.user_workspaces;
create policy "Users can create their own workspace"
  on public.user_workspaces for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can update their own workspace" on public.user_workspaces;
create policy "Users can update their own workspace"
  on public.user_workspaces for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
