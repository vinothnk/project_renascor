create table if not exists public.bodyweight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight numeric(5, 1) not null,
  unit text not null default 'kg',
  measured_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bodyweight_entries_user_measured_on_key unique (user_id, measured_on),
  constraint bodyweight_entries_unit_check check (unit in ('kg', 'lb')),
  constraint bodyweight_entries_weight_check check (weight > 0)
);

create index if not exists bodyweight_entries_user_measured_on_idx
  on public.bodyweight_entries (user_id, measured_on desc);

drop trigger if exists bodyweight_entries_set_updated_at on public.bodyweight_entries;

create trigger bodyweight_entries_set_updated_at
before update on public.bodyweight_entries
for each row execute function public.set_updated_at();

alter table public.bodyweight_entries enable row level security;

grant select, insert, update, delete on public.bodyweight_entries to authenticated;
grant all on public.bodyweight_entries to service_role;

drop policy if exists "bodyweight_entries_select_own" on public.bodyweight_entries;

create policy "bodyweight_entries_select_own"
on public.bodyweight_entries for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "bodyweight_entries_insert_own" on public.bodyweight_entries;

create policy "bodyweight_entries_insert_own"
on public.bodyweight_entries for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "bodyweight_entries_update_own" on public.bodyweight_entries;

create policy "bodyweight_entries_update_own"
on public.bodyweight_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "bodyweight_entries_delete_own" on public.bodyweight_entries;

create policy "bodyweight_entries_delete_own"
on public.bodyweight_entries for delete
to authenticated
using ((select auth.uid()) = user_id);
