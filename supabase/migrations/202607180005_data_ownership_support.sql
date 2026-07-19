alter table public.deload_events
  add column if not exists workout_exercise_id uuid
  references public.workout_exercises(id)
  on delete cascade;

create index if not exists deload_events_workout_exercise_id_idx
  on public.deload_events (workout_exercise_id);

drop policy if exists "deload_events_insert_own" on public.deload_events;
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
  and (
    workout_exercise_id is null
    or exists (
      select 1
      from public.workout_exercises
      where workout_exercises.id = deload_events.workout_exercise_id
        and workout_exercises.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "deload_events_update_own" on public.deload_events;
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
  and (
    workout_exercise_id is null
    or exists (
      select 1
      from public.workout_exercises
      where workout_exercises.id = deload_events.workout_exercise_id
        and workout_exercises.user_id = (select auth.uid())
    )
  )
);
