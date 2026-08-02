alter table public.exercises
  add column if not exists created_by_user_id uuid references auth.users(id) on delete cascade;

create index if not exists exercises_created_by_user_id_idx
  on public.exercises (created_by_user_id);

drop policy if exists "exercises_select_authenticated" on public.exercises;

create policy "exercises_select_system_or_own"
on public.exercises for select
to authenticated
using (
  created_by_user_id is null
  or created_by_user_id = (select auth.uid())
);

create policy "exercises_insert_own_custom"
on public.exercises for insert
to authenticated
with check (created_by_user_id = (select auth.uid()));

create policy "exercises_update_own_custom"
on public.exercises for update
to authenticated
using (created_by_user_id = (select auth.uid()))
with check (created_by_user_id = (select auth.uid()));

create policy "exercises_delete_own_custom"
on public.exercises for delete
to authenticated
using (created_by_user_id = (select auth.uid()));

grant insert, update, delete on public.exercises to authenticated;

create table if not exists public.assistance_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistance_templates_name_check check (length(trim(name)) > 0)
);

create table if not exists public.assistance_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assistance_template_id uuid not null references public.assistance_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null,
  target_sets integer not null default 3,
  target_reps integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistance_template_exercises_template_sort_order_key unique (assistance_template_id, sort_order),
  constraint assistance_template_exercises_template_exercise_key unique (assistance_template_id, exercise_id),
  constraint assistance_template_exercises_sort_order_check check (sort_order > 0),
  constraint assistance_template_exercises_target_sets_check check (target_sets > 0),
  constraint assistance_template_exercises_target_reps_check check (target_reps > 0)
);

create index if not exists assistance_templates_user_id_idx
  on public.assistance_templates (user_id, updated_at desc);

create index if not exists assistance_template_exercises_template_id_idx
  on public.assistance_template_exercises (assistance_template_id, sort_order);

create trigger assistance_templates_set_updated_at
before update on public.assistance_templates
for each row execute function public.set_updated_at();

create trigger assistance_template_exercises_set_updated_at
before update on public.assistance_template_exercises
for each row execute function public.set_updated_at();

alter table public.assistance_templates enable row level security;
alter table public.assistance_template_exercises enable row level security;

grant select, insert, update, delete on
  public.assistance_templates,
  public.assistance_template_exercises
to authenticated;

grant all on
  public.assistance_templates,
  public.assistance_template_exercises
to service_role;

create policy "assistance_templates_select_own"
on public.assistance_templates for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "assistance_templates_insert_own"
on public.assistance_templates for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "assistance_templates_update_own"
on public.assistance_templates for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "assistance_templates_delete_own"
on public.assistance_templates for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "assistance_template_exercises_select_own"
on public.assistance_template_exercises for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "assistance_template_exercises_insert_own"
on public.assistance_template_exercises for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.assistance_templates
    where assistance_templates.id = assistance_template_exercises.assistance_template_id
      and assistance_templates.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.exercises
    where exercises.id = assistance_template_exercises.exercise_id
      and (
        exercises.created_by_user_id is null
        or exercises.created_by_user_id = (select auth.uid())
      )
  )
);

create policy "assistance_template_exercises_update_own"
on public.assistance_template_exercises for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.assistance_templates
    where assistance_templates.id = assistance_template_exercises.assistance_template_id
      and assistance_templates.user_id = (select auth.uid())
  )
);

create policy "assistance_template_exercises_delete_own"
on public.assistance_template_exercises for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into public.exercises (slug, name, category, default_unit)
values
  ('barbell-curls', 'Barbell Curls', 'Arms', 'kg'),
  ('dumbbell-curls', 'Dumbbell Curls', 'Arms', 'kg'),
  ('hammer-curls', 'Hammer Curls', 'Arms', 'kg'),
  ('skull-crushers', 'Skull Crushers', 'Arms', 'kg'),
  ('tricep-pushdowns', 'Tricep Pushdowns', 'Arms', 'kg'),
  ('chin-ups', 'Chin-Ups', 'Back', 'kg'),
  ('lat-pulldowns', 'Lat Pulldowns', 'Back', 'kg'),
  ('pull-ups', 'Pull-Ups', 'Back', 'kg'),
  ('seated-cable-rows', 'Seated Cable Rows', 'Back', 'kg'),
  ('dips', 'Dips', 'Chest', 'kg'),
  ('dumbbell-flyes', 'Dumbbell Flyes', 'Chest', 'kg'),
  ('incline-dumbbell-press', 'Incline Dumbbell Press', 'Chest', 'kg'),
  ('push-ups', 'Push-Ups', 'Chest', 'kg'),
  ('ab-wheel-rollouts', 'Ab Wheel Rollouts', 'Core', 'kg'),
  ('cable-crunches', 'Cable Crunches', 'Core', 'kg'),
  ('hanging-leg-raises', 'Hanging Leg Raises', 'Core', 'kg'),
  ('plank', 'Plank', 'Core', 'kg'),
  ('bulgarian-split-squats', 'Bulgarian Split Squats', 'Lower Body', 'kg'),
  ('calf-raises', 'Calf Raises', 'Lower Body', 'kg'),
  ('leg-curls', 'Leg Curls', 'Lower Body', 'kg'),
  ('lunges', 'Lunges', 'Lower Body', 'kg'),
  ('step-ups', 'Step Ups', 'Lower Body', 'kg'),
  ('face-pulls', 'Face Pulls', 'Shoulders', 'kg'),
  ('lateral-raises', 'Lateral Raises', 'Shoulders', 'kg'),
  ('rear-delt-flyes', 'Rear Delt Flyes', 'Shoulders', 'kg')
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  default_unit = excluded.default_unit;
