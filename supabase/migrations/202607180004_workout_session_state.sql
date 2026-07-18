alter table public.workout_sessions
  add column if not exists rest_started_at timestamptz,
  add column if not exists target_rest_seconds integer,
  add column if not exists rest_set_id uuid references public.workout_sets(id) on delete set null,
  add column if not exists paused_at timestamptz;

update public.workout_sessions
set status = 'in_progress'
where status = 'active';

update public.workout_sessions
set status = 'discarded'
where status = 'abandoned';

alter table public.workout_sessions
  drop constraint if exists workout_sessions_status_check;

alter table public.workout_sessions
  add constraint workout_sessions_status_check
  check (status in (
    'planned',
    'in_progress',
    'paused',
    'completed',
    'skipped',
    'discarded',
    'active',
    'abandoned'
  ));

alter table public.workout_sessions
  drop constraint if exists workout_sessions_completed_at_check;

alter table public.workout_sessions
  add constraint workout_sessions_completed_at_check
  check (status <> 'completed' or completed_at is not null);

alter table public.workout_sessions
  add constraint workout_sessions_target_rest_seconds_check
  check (target_rest_seconds is null or target_rest_seconds > 0);

create index if not exists workout_sessions_open_user_idx
  on public.workout_sessions (user_id, updated_at desc)
  where status in ('in_progress', 'paused', 'active');
