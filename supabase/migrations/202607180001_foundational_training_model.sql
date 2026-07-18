create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

alter table public.profiles
  add column if not exists unit_system text not null default 'metric';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_unit_system_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_unit_system_check
      check (unit_system in ('metric', 'imperial'));
  end if;
end;
$$;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text,
  default_unit text not null default 'kg',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_default_unit_check check (default_unit in ('kg', 'lb'))
);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  default_sets integer not null,
  default_reps integer not null,
  increment numeric(6, 2) not null,
  deload_percent numeric(5, 2) not null default 10.00,
  failures_before_deload integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_exercises_program_exercise_key unique (program_id, exercise_id),
  constraint program_exercises_default_sets_check check (default_sets > 0),
  constraint program_exercises_default_reps_check check (default_reps > 0),
  constraint program_exercises_increment_check check (increment > 0),
  constraint program_exercises_deload_percent_check check (deload_percent >= 0 and deload_percent <= 100),
  constraint program_exercises_failures_before_deload_check check (failures_before_deload > 0)
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  code text not null,
  name text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_templates_program_code_key unique (program_id, code),
  constraint workout_templates_program_sort_order_key unique (program_id, sort_order),
  constraint workout_templates_sort_order_check check (sort_order > 0)
);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null,
  target_sets integer not null,
  target_reps integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_template_exercises_template_sort_order_key unique (workout_template_id, sort_order),
  constraint workout_template_exercises_template_exercise_key unique (workout_template_id, exercise_id),
  constraint workout_template_exercises_sort_order_check check (sort_order > 0),
  constraint workout_template_exercises_target_sets_check check (target_sets > 0),
  constraint workout_template_exercises_target_reps_check check (target_reps > 0)
);

create table public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict,
  status text not null default 'active',
  started_on date not null default current_date,
  ended_on date,
  next_template_id uuid references public.workout_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_enrollments_status_check check (status in ('active', 'paused', 'completed', 'archived')),
  constraint program_enrollments_dates_check check (ended_on is null or ended_on >= started_on)
);

create unique index program_enrollments_one_active_per_user_idx
  on public.program_enrollments (user_id)
  where status = 'active';

create table public.exercise_training_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_enrollment_id uuid not null references public.program_enrollments(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  current_load numeric(6, 2) not null,
  unit text not null default 'kg',
  consecutive_failures integer not null default 0,
  last_progression_decision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_training_states_enrollment_exercise_key unique (program_enrollment_id, exercise_id),
  constraint exercise_training_states_current_load_check check (current_load >= 0),
  constraint exercise_training_states_unit_check check (unit in ('kg', 'lb')),
  constraint exercise_training_states_consecutive_failures_check check (consecutive_failures >= 0)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_enrollment_id uuid not null references public.program_enrollments(id) on delete cascade,
  workout_template_id uuid references public.workout_templates(id) on delete set null,
  status text not null default 'planned',
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_status_check check (status in ('planned', 'active', 'completed', 'skipped', 'abandoned')),
  constraint workout_sessions_completed_at_check check (status <> 'completed' or completed_at is not null)
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null,
  target_sets integer not null,
  target_reps integer not null,
  planned_load numeric(6, 2) not null,
  unit text not null default 'kg',
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_exercises_session_sort_order_key unique (workout_session_id, sort_order),
  constraint workout_exercises_sort_order_check check (sort_order > 0),
  constraint workout_exercises_target_sets_check check (target_sets > 0),
  constraint workout_exercises_target_reps_check check (target_reps > 0),
  constraint workout_exercises_planned_load_check check (planned_load >= 0),
  constraint workout_exercises_unit_check check (unit in ('kg', 'lb')),
  constraint workout_exercises_status_check check (status in ('planned', 'active', 'completed', 'failed', 'skipped'))
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null,
  target_reps integer not null,
  completed_reps integer not null default 0,
  load numeric(6, 2) not null,
  unit text not null default 'kg',
  status text not null default 'planned',
  failure_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sets_exercise_set_number_key unique (workout_exercise_id, set_number),
  constraint workout_sets_set_number_check check (set_number > 0),
  constraint workout_sets_target_reps_check check (target_reps > 0),
  constraint workout_sets_completed_reps_check check (completed_reps >= 0),
  constraint workout_sets_load_check check (load >= 0),
  constraint workout_sets_unit_check check (unit in ('kg', 'lb')),
  constraint workout_sets_status_check check (status in ('planned', 'completed', 'failed', 'skipped'))
);

create table public.failure_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_enrollment_id uuid not null references public.program_enrollments(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  reason text not null,
  failed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.deload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_enrollment_id uuid not null references public.program_enrollments(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  from_load numeric(6, 2) not null,
  to_load numeric(6, 2) not null,
  unit text not null default 'kg',
  reason text not null,
  created_at timestamptz not null default now(),
  constraint deload_events_from_load_check check (from_load >= 0),
  constraint deload_events_to_load_check check (to_load >= 0),
  constraint deload_events_unit_check check (unit in ('kg', 'lb'))
);

create table public.progression_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_enrollment_id uuid not null references public.program_enrollments(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  decision text not null,
  from_load numeric(6, 2) not null,
  to_load numeric(6, 2) not null,
  unit text not null default 'kg',
  reason text not null,
  created_at timestamptz not null default now(),
  constraint progression_decisions_decision_check check (decision in ('increase', 'repeat', 'deload', 'hold')),
  constraint progression_decisions_from_load_check check (from_load >= 0),
  constraint progression_decisions_to_load_check check (to_load >= 0),
  constraint progression_decisions_unit_check check (unit in ('kg', 'lb'))
);

alter table public.exercise_training_states
  add constraint exercise_training_states_last_progression_decision_fk
  foreign key (last_progression_decision_id)
  references public.progression_decisions(id)
  on delete set null;

create index program_exercises_program_id_idx on public.program_exercises (program_id);
create index program_exercises_exercise_id_idx on public.program_exercises (exercise_id);
create index workout_templates_program_id_idx on public.workout_templates (program_id);
create index workout_template_exercises_template_id_idx on public.workout_template_exercises (workout_template_id);
create index workout_template_exercises_exercise_id_idx on public.workout_template_exercises (exercise_id);
create index program_enrollments_user_id_idx on public.program_enrollments (user_id);
create index program_enrollments_program_id_idx on public.program_enrollments (program_id);
create index exercise_training_states_user_id_idx on public.exercise_training_states (user_id);
create index exercise_training_states_enrollment_id_idx on public.exercise_training_states (program_enrollment_id);
create index workout_sessions_user_id_idx on public.workout_sessions (user_id);
create index workout_sessions_enrollment_id_idx on public.workout_sessions (program_enrollment_id);
create index workout_exercises_user_id_idx on public.workout_exercises (user_id);
create index workout_exercises_session_id_idx on public.workout_exercises (workout_session_id);
create index workout_sets_user_id_idx on public.workout_sets (user_id);
create index workout_sets_exercise_id_idx on public.workout_sets (workout_exercise_id);
create index failure_events_user_id_idx on public.failure_events (user_id);
create index failure_events_enrollment_exercise_idx on public.failure_events (program_enrollment_id, exercise_id);
create index deload_events_user_id_idx on public.deload_events (user_id);
create index deload_events_enrollment_exercise_idx on public.deload_events (program_enrollment_id, exercise_id);
create index progression_decisions_user_id_idx on public.progression_decisions (user_id);
create index progression_decisions_enrollment_exercise_idx on public.progression_decisions (program_enrollment_id, exercise_id);

create trigger programs_set_updated_at
before update on public.programs
for each row execute function public.set_updated_at();

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

create trigger program_exercises_set_updated_at
before update on public.program_exercises
for each row execute function public.set_updated_at();

create trigger workout_templates_set_updated_at
before update on public.workout_templates
for each row execute function public.set_updated_at();

create trigger workout_template_exercises_set_updated_at
before update on public.workout_template_exercises
for each row execute function public.set_updated_at();

create trigger program_enrollments_set_updated_at
before update on public.program_enrollments
for each row execute function public.set_updated_at();

create trigger exercise_training_states_set_updated_at
before update on public.exercise_training_states
for each row execute function public.set_updated_at();

create trigger workout_sessions_set_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

create trigger workout_exercises_set_updated_at
before update on public.workout_exercises
for each row execute function public.set_updated_at();

create trigger workout_sets_set_updated_at
before update on public.workout_sets
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.exercises enable row level security;
alter table public.program_exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.exercise_training_states enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.failure_events enable row level security;
alter table public.deload_events enable row level security;
alter table public.progression_decisions enable row level security;

grant usage on schema public to authenticated;

grant select on
  public.programs,
  public.exercises,
  public.program_exercises,
  public.workout_templates,
  public.workout_template_exercises
to authenticated;

grant select, insert, update, delete on
  public.program_enrollments,
  public.exercise_training_states,
  public.workout_sessions,
  public.workout_exercises,
  public.workout_sets,
  public.failure_events,
  public.deload_events,
  public.progression_decisions
to authenticated;

grant all on
  public.programs,
  public.exercises,
  public.program_exercises,
  public.workout_templates,
  public.workout_template_exercises,
  public.program_enrollments,
  public.exercise_training_states,
  public.workout_sessions,
  public.workout_exercises,
  public.workout_sets,
  public.failure_events,
  public.deload_events,
  public.progression_decisions
to service_role;

create policy "programs_select_authenticated"
on public.programs for select
to authenticated
using (true);

create policy "exercises_select_authenticated"
on public.exercises for select
to authenticated
using (true);

create policy "program_exercises_select_authenticated"
on public.program_exercises for select
to authenticated
using (true);

create policy "workout_templates_select_authenticated"
on public.workout_templates for select
to authenticated
using (true);

create policy "workout_template_exercises_select_authenticated"
on public.workout_template_exercises for select
to authenticated
using (true);

create policy "program_enrollments_select_own"
on public.program_enrollments for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "program_enrollments_insert_own"
on public.program_enrollments for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "program_enrollments_update_own"
on public.program_enrollments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "program_enrollments_delete_own"
on public.program_enrollments for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "exercise_training_states_select_own"
on public.exercise_training_states for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "exercise_training_states_insert_own"
on public.exercise_training_states for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = exercise_training_states.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
);

create policy "exercise_training_states_update_own"
on public.exercise_training_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = exercise_training_states.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
);

create policy "exercise_training_states_delete_own"
on public.exercise_training_states for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "workout_sessions_select_own"
on public.workout_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "workout_sessions_insert_own"
on public.workout_sessions for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = workout_sessions.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
);

create policy "workout_sessions_update_own"
on public.workout_sessions for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = workout_sessions.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
);

create policy "workout_sessions_delete_own"
on public.workout_sessions for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "workout_exercises_select_own"
on public.workout_exercises for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "workout_exercises_insert_own"
on public.workout_exercises for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_exercises.workout_session_id
      and workout_sessions.user_id = (select auth.uid())
  )
);

create policy "workout_exercises_update_own"
on public.workout_exercises for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_exercises.workout_session_id
      and workout_sessions.user_id = (select auth.uid())
  )
);

create policy "workout_exercises_delete_own"
on public.workout_exercises for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "workout_sets_select_own"
on public.workout_sets for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "workout_sets_insert_own"
on public.workout_sets for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.workout_exercises
    where workout_exercises.id = workout_sets.workout_exercise_id
      and workout_exercises.user_id = (select auth.uid())
  )
);

create policy "workout_sets_update_own"
on public.workout_sets for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.workout_exercises
    where workout_exercises.id = workout_sets.workout_exercise_id
      and workout_exercises.user_id = (select auth.uid())
  )
);

create policy "workout_sets_delete_own"
on public.workout_sets for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "failure_events_select_own"
on public.failure_events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "failure_events_insert_own"
on public.failure_events for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = failure_events.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.workout_exercises
    where workout_exercises.id = failure_events.workout_exercise_id
      and workout_exercises.user_id = (select auth.uid())
  )
);

create policy "failure_events_update_own"
on public.failure_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = failure_events.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.workout_exercises
    where workout_exercises.id = failure_events.workout_exercise_id
      and workout_exercises.user_id = (select auth.uid())
  )
);

create policy "failure_events_delete_own"
on public.failure_events for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "deload_events_select_own"
on public.deload_events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "deload_events_insert_own"
on public.deload_events for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = deload_events.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
);

create policy "deload_events_update_own"
on public.deload_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = deload_events.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
);

create policy "deload_events_delete_own"
on public.deload_events for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "progression_decisions_select_own"
on public.progression_decisions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "progression_decisions_insert_own"
on public.progression_decisions for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = progression_decisions.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.workout_exercises
    where workout_exercises.id = progression_decisions.workout_exercise_id
      and workout_exercises.user_id = (select auth.uid())
  )
);

create policy "progression_decisions_update_own"
on public.progression_decisions for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.program_enrollments
    where program_enrollments.id = progression_decisions.program_enrollment_id
      and program_enrollments.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.workout_exercises
    where workout_exercises.id = progression_decisions.workout_exercise_id
      and workout_exercises.user_id = (select auth.uid())
  )
);

create policy "progression_decisions_delete_own"
on public.progression_decisions for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into public.programs (slug, name, description, is_system)
values (
  'stronglifts-5x5',
  'StrongLifts 5x5',
  'Alternating full-body strength program built around five barbell lifts.',
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system;

insert into public.exercises (slug, name, category, default_unit)
values
  ('squat', 'Squat', 'barbell', 'kg'),
  ('bench-press', 'Bench Press', 'barbell', 'kg'),
  ('barbell-row', 'Barbell Row', 'barbell', 'kg'),
  ('overhead-press', 'Overhead Press', 'barbell', 'kg'),
  ('deadlift', 'Deadlift', 'barbell', 'kg')
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  default_unit = excluded.default_unit;

with stronglifts as (
  select id from public.programs where slug = 'stronglifts-5x5'
),
exercise_rules as (
  select *
  from (
    values
      ('squat', 5, 5, 2.50, 10.00, 3),
      ('bench-press', 5, 5, 2.50, 10.00, 3),
      ('barbell-row', 5, 5, 2.50, 10.00, 3),
      ('overhead-press', 5, 5, 2.50, 10.00, 3),
      ('deadlift', 1, 5, 5.00, 10.00, 3)
  ) as rule(exercise_slug, default_sets, default_reps, increment, deload_percent, failures_before_deload)
)
insert into public.program_exercises (
  program_id,
  exercise_id,
  default_sets,
  default_reps,
  increment,
  deload_percent,
  failures_before_deload
)
select
  stronglifts.id,
  exercises.id,
  exercise_rules.default_sets,
  exercise_rules.default_reps,
  exercise_rules.increment,
  exercise_rules.deload_percent,
  exercise_rules.failures_before_deload
from stronglifts
join exercise_rules on true
join public.exercises on exercises.slug = exercise_rules.exercise_slug
on conflict (program_id, exercise_id) do update
set
  default_sets = excluded.default_sets,
  default_reps = excluded.default_reps,
  increment = excluded.increment,
  deload_percent = excluded.deload_percent,
  failures_before_deload = excluded.failures_before_deload;

with stronglifts as (
  select id from public.programs where slug = 'stronglifts-5x5'
),
templates as (
  select *
  from (
    values
      ('a', 'Workout A', 1),
      ('b', 'Workout B', 2)
  ) as template(code, name, sort_order)
)
insert into public.workout_templates (program_id, code, name, sort_order)
select stronglifts.id, templates.code, templates.name, templates.sort_order
from stronglifts
join templates on true
on conflict (program_id, code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order;

with stronglifts as (
  select id from public.programs where slug = 'stronglifts-5x5'
),
template_exercises as (
  select *
  from (
    values
      ('a', 'squat', 1, 5, 5),
      ('a', 'bench-press', 2, 5, 5),
      ('a', 'barbell-row', 3, 5, 5),
      ('b', 'squat', 1, 5, 5),
      ('b', 'overhead-press', 2, 5, 5),
      ('b', 'deadlift', 3, 1, 5)
  ) as item(template_code, exercise_slug, sort_order, target_sets, target_reps)
)
insert into public.workout_template_exercises (
  workout_template_id,
  exercise_id,
  sort_order,
  target_sets,
  target_reps
)
select
  workout_templates.id,
  exercises.id,
  template_exercises.sort_order,
  template_exercises.target_sets,
  template_exercises.target_reps
from stronglifts
join public.workout_templates on workout_templates.program_id = stronglifts.id
join template_exercises on template_exercises.template_code = workout_templates.code
join public.exercises on exercises.slug = template_exercises.exercise_slug
on conflict (workout_template_id, exercise_id) do update
set
  sort_order = excluded.sort_order,
  target_sets = excluded.target_sets,
  target_reps = excluded.target_reps;
