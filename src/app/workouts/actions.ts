"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateProgressionDecision } from "@/lib/training/progression";
import type {
  ActionResult,
  ApplyDeloadInput,
  ChartDataPoint,
  CreateWorkoutInput,
  LoadUnit,
  NextWorkoutPreview,
  ProgressionDecision,
  SetResultInput,
  SetStatus,
  UserSettingsInput,
  WorkoutExerciseStatus,
  WorkoutView,
} from "@/lib/training/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type User = {
  id: string;
};

type EnrollmentRow = {
  id: string;
  program_id: string;
  next_template_id: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  sort_order: number;
};

type TemplateExerciseRow = {
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  target_reps: number;
};

type ExerciseRow = {
  id: string;
  name: string;
};

type TrainingStateRow = {
  id: string;
  exercise_id: string;
  current_load: number | string;
  unit: LoadUnit;
  consecutive_failures: number;
};

type ProgramExerciseRuleRow = {
  exercise_id: string;
  increment: number | string;
  deload_percent: number | string;
  failures_before_deload: number;
};

type WorkoutSessionRow = {
  id: string;
  program_enrollment_id: string;
  workout_template_id: string | null;
  status: string;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
};

type WorkoutExerciseRow = {
  id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  target_reps: number;
  planned_load: number | string;
  unit: LoadUnit;
  status: string;
};

type WorkoutSetRow = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  target_reps: number;
  completed_reps: number;
  load: number | string;
  unit: LoadUnit;
  status: string;
  failure_reason: string | null;
  notes: string | null;
};

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function failure<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function asSetStatus(status: string): SetStatus {
  return ["planned", "completed", "failed", "skipped"].includes(status)
    ? (status as SetStatus)
    : "planned";
}

function asExerciseStatus(status: string): WorkoutExerciseStatus {
  return ["planned", "active", "completed", "failed", "skipped"].includes(
    status,
  )
    ? (status as WorkoutExerciseStatus)
    : "planned";
}

async function getUser(supabase: SupabaseClient): Promise<User> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Log in to manage workouts.");
  }

  return { id: data.user.id };
}

async function requireActiveEnrollment(
  supabase: SupabaseClient,
  userId: string,
): Promise<EnrollmentRow> {
  const { data: existing, error: existingError } = await supabase
    .from("program_enrollments")
    .select("id, program_id, next_template_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<EnrollmentRow>();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id")
    .eq("slug", "stronglifts-5x5")
    .single<{ id: string }>();

  if (programError) {
    throw programError;
  }

  const { data: firstTemplate, error: templateError } = await supabase
    .from("workout_templates")
    .select("id")
    .eq("program_id", program.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .single<{ id: string }>();

  if (templateError) {
    throw templateError;
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("program_enrollments")
    .insert({
      user_id: userId,
      program_id: program.id,
      next_template_id: firstTemplate.id,
    })
    .select("id, program_id, next_template_id")
    .single<EnrollmentRow>();

  if (enrollmentError) {
    throw enrollmentError;
  }

  return enrollment;
}

async function getTemplate(
  supabase: SupabaseClient,
  enrollment: EnrollmentRow,
  templateId?: string,
): Promise<TemplateRow> {
  const id = templateId ?? enrollment.next_template_id;

  let query = supabase
    .from("workout_templates")
    .select("id, name, sort_order")
    .eq("program_id", enrollment.program_id);

  if (id) {
    query = query.eq("id", id);
  } else {
    query = query.order("sort_order", { ascending: true }).limit(1);
  }

  const { data, error } = await query.single<TemplateRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function getTemplateExercises(
  supabase: SupabaseClient,
  templateId: string,
): Promise<TemplateExerciseRow[]> {
  const { data, error } = await supabase
    .from("workout_template_exercises")
    .select("exercise_id, sort_order, target_sets, target_reps")
    .eq("workout_template_id", templateId)
    .order("sort_order", { ascending: true })
    .returns<TemplateExerciseRow[]>();

  if (error) {
    throw error;
  }

  return data;
}

async function getExercisesById(
  supabase: SupabaseClient,
  exerciseIds: string[],
): Promise<Map<string, ExerciseRow>> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name")
    .in("id", exerciseIds)
    .returns<ExerciseRow[]>();

  if (error) {
    throw error;
  }

  return new Map(data.map((exercise) => [exercise.id, exercise]));
}

async function getTrainingStatesByExerciseId(
  supabase: SupabaseClient,
  enrollmentId: string,
  exerciseIds: string[],
): Promise<Map<string, TrainingStateRow>> {
  const { data, error } = await supabase
    .from("exercise_training_states")
    .select("id, exercise_id, current_load, unit, consecutive_failures")
    .eq("program_enrollment_id", enrollmentId)
    .in("exercise_id", exerciseIds)
    .returns<TrainingStateRow[]>();

  if (error) {
    throw error;
  }

  return new Map(data.map((state) => [state.exercise_id, state]));
}

async function ensureTrainingState(
  supabase: SupabaseClient,
  userId: string,
  enrollmentId: string,
  exerciseId: string,
  startingLoad: number,
): Promise<TrainingStateRow> {
  const { data: existing, error: existingError } = await supabase
    .from("exercise_training_states")
    .select("id, exercise_id, current_load, unit, consecutive_failures")
    .eq("program_enrollment_id", enrollmentId)
    .eq("exercise_id", exerciseId)
    .maybeSingle<TrainingStateRow>();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("exercise_training_states")
    .insert({
      user_id: userId,
      program_enrollment_id: enrollmentId,
      exercise_id: exerciseId,
      current_load: startingLoad,
      unit: "kg",
      consecutive_failures: 0,
    })
    .select("id, exercise_id, current_load, unit, consecutive_failures")
    .single<TrainingStateRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function getWorkoutView(
  supabase: SupabaseClient,
  workoutId: string,
): Promise<WorkoutView> {
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(
      "id, program_enrollment_id, workout_template_id, status, scheduled_for, started_at, completed_at, notes",
    )
    .eq("id", workoutId)
    .single<WorkoutSessionRow>();

  if (sessionError) {
    throw sessionError;
  }

  const { data: template } = session.workout_template_id
    ? await supabase
        .from("workout_templates")
        .select("name")
        .eq("id", session.workout_template_id)
        .maybeSingle<{ name: string }>()
    : { data: null };

  const { data: workoutExercises, error: workoutExercisesError } =
    await supabase
      .from("workout_exercises")
      .select(
        "id, exercise_id, sort_order, target_sets, target_reps, planned_load, unit, status",
      )
      .eq("workout_session_id", workoutId)
      .order("sort_order", { ascending: true })
      .returns<WorkoutExerciseRow[]>();

  if (workoutExercisesError) {
    throw workoutExercisesError;
  }

  const exerciseIds = workoutExercises.map((exercise) => exercise.exercise_id);
  const exerciseNames = await getExercisesById(supabase, exerciseIds);
  const workoutExerciseIds = workoutExercises.map((exercise) => exercise.id);
  const { data: sets, error: setsError } = await supabase
    .from("workout_sets")
    .select(
      "id, workout_exercise_id, set_number, target_reps, completed_reps, load, unit, status, failure_reason, notes",
    )
    .in("workout_exercise_id", workoutExerciseIds)
    .order("set_number", { ascending: true })
    .returns<WorkoutSetRow[]>();

  if (setsError) {
    throw setsError;
  }

  return {
    id: session.id,
    status: session.status as WorkoutView["status"],
    templateId: session.workout_template_id,
    templateName: template?.name ?? null,
    scheduledFor: session.scheduled_for,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    notes: session.notes,
    exercises: workoutExercises.map((workoutExercise) => ({
      id: workoutExercise.id,
      exerciseId: workoutExercise.exercise_id,
      exerciseName:
        exerciseNames.get(workoutExercise.exercise_id)?.name ?? "Exercise",
      sortOrder: workoutExercise.sort_order,
      targetSets: workoutExercise.target_sets,
      targetReps: workoutExercise.target_reps,
      plannedLoad: toNumber(workoutExercise.planned_load),
      unit: workoutExercise.unit,
      status: asExerciseStatus(workoutExercise.status),
      sets: sets
        .filter((set) => set.workout_exercise_id === workoutExercise.id)
        .map((set) => ({
          id: set.id,
          setNumber: set.set_number,
          targetReps: set.target_reps,
          completedReps: set.completed_reps,
          load: toNumber(set.load),
          unit: set.unit,
          status: asSetStatus(set.status),
          failureReason: set.failure_reason,
          notes: set.notes,
        })),
    })),
  };
}

async function advanceNextTemplate(
  supabase: SupabaseClient,
  enrollment: EnrollmentRow,
  completedTemplateId: string | null,
) {
  if (!completedTemplateId) {
    return;
  }

  const { data: templates, error } = await supabase
    .from("workout_templates")
    .select("id, sort_order")
    .eq("program_id", enrollment.program_id)
    .order("sort_order", { ascending: true })
    .returns<Array<{ id: string; sort_order: number }>>();

  if (error || templates.length === 0) {
    throw error ?? new Error("No workout templates found.");
  }

  const index = templates.findIndex((template) => template.id === completedTemplateId);
  const nextTemplate = templates[(index + 1) % templates.length] ?? templates[0];

  const { error: updateError } = await supabase
    .from("program_enrollments")
    .update({ next_template_id: nextTemplate.id })
    .eq("id", enrollment.id);

  if (updateError) {
    throw updateError;
  }
}

export async function createWorkout(
  input: CreateWorkoutInput = {},
): Promise<ActionResult<WorkoutView>> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const enrollment = await requireActiveEnrollment(supabase, user.id);
    const template = await getTemplate(supabase, enrollment, input.templateId);
    const templateExercises = await getTemplateExercises(supabase, template.id);

    if (templateExercises.length === 0) {
      return failure("The selected workout template has no exercises.");
    }

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        program_enrollment_id: enrollment.id,
        workout_template_id: template.id,
        scheduled_for: input.scheduledFor ?? null,
        status: "planned",
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) {
      throw sessionError;
    }

    for (const templateExercise of templateExercises) {
      const state = await ensureTrainingState(
        supabase,
        user.id,
        enrollment.id,
        templateExercise.exercise_id,
        input.startingLoads?.[templateExercise.exercise_id] ??
          input.defaultStartingLoad ??
          20,
      );

      const { data: workoutExercise, error: workoutExerciseError } =
        await supabase
          .from("workout_exercises")
          .insert({
            user_id: user.id,
            workout_session_id: session.id,
            exercise_id: templateExercise.exercise_id,
            sort_order: templateExercise.sort_order,
            target_sets: templateExercise.target_sets,
            target_reps: templateExercise.target_reps,
            planned_load: state.current_load,
            unit: state.unit,
            status: "planned",
          })
          .select("id")
          .single<{ id: string }>();

      if (workoutExerciseError) {
        throw workoutExerciseError;
      }

      const setRows = Array.from(
        { length: templateExercise.target_sets },
        (_, index) => ({
          user_id: user.id,
          workout_exercise_id: workoutExercise.id,
          set_number: index + 1,
          target_reps: templateExercise.target_reps,
          completed_reps: 0,
          load: state.current_load,
          unit: state.unit,
          status: "planned",
        }),
      );

      const { error: setsError } = await supabase
        .from("workout_sets")
        .insert(setRows);

      if (setsError) {
        throw setsError;
      }
    }

    revalidatePath("/dashboard");
    return success(await getWorkoutView(supabase, session.id));
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not create workout.");
  }
}

export async function startWorkoutSession(
  workoutId: string,
): Promise<ActionResult<WorkoutView>> {
  try {
    const supabase = await createClient();
    await getUser(supabase);

    const { error } = await supabase
      .from("workout_sessions")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", workoutId)
      .in("status", ["planned", "active"]);

    if (error) {
      throw error;
    }

    revalidatePath("/dashboard");
    return success(await getWorkoutView(supabase, workoutId));
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not start workout.");
  }
}

export async function updateSetResult(
  input: SetResultInput,
): Promise<ActionResult<WorkoutView>> {
  try {
    const supabase = await createClient();
    await getUser(supabase);

    const completedReps = Math.max(0, Math.trunc(input.completedReps));
    const { data: currentSet, error: currentSetError } = await supabase
      .from("workout_sets")
      .select("target_reps")
      .eq("id", input.setId)
      .single<{ target_reps: number }>();

    if (currentSetError) {
      throw currentSetError;
    }

    const status =
      input.status ??
      (completedReps >= currentSet.target_reps ? "completed" : "failed");

    const { data: set, error: setError } = await supabase
      .from("workout_sets")
      .update({
        completed_reps: completedReps,
        status,
        failure_reason: input.failureReason ?? null,
        notes: input.notes ?? null,
      })
      .eq("id", input.setId)
      .select("workout_exercise_id")
      .single<{ workout_exercise_id: string }>();

    if (setError) {
      throw setError;
    }

    const { data: sets, error: setsError } = await supabase
      .from("workout_sets")
      .select("status, completed_reps, target_reps")
      .eq("workout_exercise_id", set.workout_exercise_id)
      .returns<Array<{ status: string; completed_reps: number; target_reps: number }>>();

    if (setsError) {
      throw setsError;
    }

    const allFinished = sets.every((row) =>
      ["completed", "failed", "skipped"].includes(row.status),
    );
    const allSuccessful =
      allFinished &&
      sets.every((row) => row.status === "completed" && row.completed_reps >= row.target_reps);
    const exerciseStatus: WorkoutExerciseStatus = allSuccessful
      ? "completed"
      : allFinished
        ? "failed"
        : "active";

    const { data: workoutExercise, error: workoutExerciseError } =
      await supabase
        .from("workout_exercises")
        .update({ status: exerciseStatus })
        .eq("id", set.workout_exercise_id)
        .select("workout_session_id")
        .single<{ workout_session_id: string }>();

    if (workoutExerciseError) {
      throw workoutExerciseError;
    }

    revalidatePath("/dashboard");
    return success(await getWorkoutView(supabase, workoutExercise.workout_session_id));
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not update set.");
  }
}

export async function applyProgression(
  workoutExerciseId: string,
): Promise<ActionResult<ProgressionDecision>> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);

    const decision = await applyProgressionForExercise(
      supabase,
      user.id,
      workoutExerciseId,
    );

    revalidatePath("/dashboard");
    return success(decision);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Could not apply progression.",
    );
  }
}

async function applyProgressionForExercise(
  supabase: SupabaseClient,
  userId: string,
  workoutExerciseId: string,
): Promise<ProgressionDecision> {
  const { data: existingDecision, error: existingDecisionError } = await supabase
    .from("progression_decisions")
    .select("decision, from_load, to_load, unit, reason")
    .eq("workout_exercise_id", workoutExerciseId)
    .maybeSingle<{
      decision: ProgressionDecision["decision"];
      from_load: number | string;
      to_load: number | string;
      unit: LoadUnit;
      reason: string;
    }>();

  if (existingDecisionError) {
    throw existingDecisionError;
  }

  if (existingDecision) {
    return {
      decision: existingDecision.decision,
      fromLoad: toNumber(existingDecision.from_load),
      toLoad: toNumber(existingDecision.to_load),
      unit: existingDecision.unit,
      nextConsecutiveFailures: 0,
      reason: existingDecision.reason,
    };
  }

  const { data: workoutExercise, error: workoutExerciseError } = await supabase
    .from("workout_exercises")
    .select(
      "id, exercise_id, workout_session_id, planned_load, unit, workout_sessions(program_enrollment_id)",
    )
    .eq("id", workoutExerciseId)
    .single<
      WorkoutExerciseRow & {
        workout_sessions: { program_enrollment_id: string } | null;
      }
    >();

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }

  const enrollmentId = workoutExercise.workout_sessions?.program_enrollment_id;

  if (!enrollmentId) {
    throw new Error("Workout exercise is missing its enrollment.");
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("program_enrollments")
    .select("program_id")
    .eq("id", enrollmentId)
    .single<{ program_id: string }>();

  if (enrollmentError) {
    throw enrollmentError;
  }

  const { data: sets, error: setsError } = await supabase
    .from("workout_sets")
    .select("status, completed_reps, target_reps")
    .eq("workout_exercise_id", workoutExerciseId)
    .returns<Array<{ status: string; completed_reps: number; target_reps: number }>>();

  if (setsError) {
    throw setsError;
  }

  const completedAllReps =
    sets.length > 0 &&
    sets.every(
      (set) => set.status === "completed" && set.completed_reps >= set.target_reps,
    );

  const { data: state, error: stateError } = await supabase
    .from("exercise_training_states")
    .select("id, current_load, unit, consecutive_failures")
    .eq("program_enrollment_id", enrollmentId)
    .eq("exercise_id", workoutExercise.exercise_id)
    .single<TrainingStateRow>();

  if (stateError) {
    throw stateError;
  }

  const { data: rule, error: ruleError } = await supabase
    .from("program_exercises")
    .select("exercise_id, increment, deload_percent, failures_before_deload")
    .eq("program_id", enrollment.program_id)
    .eq("exercise_id", workoutExercise.exercise_id)
    .single<ProgramExerciseRuleRow>();

  if (ruleError) {
    throw ruleError;
  }

  const decision = calculateProgressionDecision({
    completedAllReps,
    currentLoad: toNumber(state.current_load),
    increment: toNumber(rule.increment),
    consecutiveFailures: state.consecutive_failures,
    failuresBeforeDeload: rule.failures_before_deload,
    deloadPercent: toNumber(rule.deload_percent),
    unit: state.unit,
  });

  const { data: savedDecision, error: decisionError } = await supabase
    .from("progression_decisions")
    .insert({
      user_id: userId,
      program_enrollment_id: enrollmentId,
      workout_exercise_id: workoutExerciseId,
      exercise_id: workoutExercise.exercise_id,
      decision: decision.decision,
      from_load: decision.fromLoad,
      to_load: decision.toLoad,
      unit: decision.unit,
      reason: decision.reason,
    })
    .select("id")
    .single<{ id: string }>();

  if (decisionError) {
    throw decisionError;
  }

  if (!completedAllReps) {
    const { error: failureError } = await supabase.from("failure_events").insert({
      user_id: userId,
      program_enrollment_id: enrollmentId,
      workout_exercise_id: workoutExerciseId,
      exercise_id: workoutExercise.exercise_id,
      reason: decision.reason,
    });

    if (failureError) {
      throw failureError;
    }
  }

  if (decision.decision === "deload") {
    const { error: deloadError } = await supabase.from("deload_events").insert({
      user_id: userId,
      program_enrollment_id: enrollmentId,
      exercise_id: workoutExercise.exercise_id,
      from_load: decision.fromLoad,
      to_load: decision.toLoad,
      unit: decision.unit,
      reason: decision.reason,
    });

    if (deloadError) {
      throw deloadError;
    }
  }

  const { error: stateUpdateError } = await supabase
    .from("exercise_training_states")
    .update({
      current_load: decision.toLoad,
      consecutive_failures: decision.nextConsecutiveFailures,
      last_progression_decision_id: savedDecision.id,
    })
    .eq("id", state.id);

  if (stateUpdateError) {
    throw stateUpdateError;
  }

  return decision;
}

export async function completeWorkout(
  workoutId: string,
): Promise<ActionResult<WorkoutView>> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const workout = await getWorkoutView(supabase, workoutId);

    if (workout.status === "completed") {
      return success(workout);
    }

    const unfinishedSet = workout.exercises
      .flatMap((exercise) => exercise.sets)
      .some((set) => !["completed", "failed", "skipped"].includes(set.status));

    if (unfinishedSet) {
      return failure("Finish or skip every set before completing the workout.");
    }

    for (const exercise of workout.exercises) {
      await applyProgressionForExercise(supabase, user.id, exercise.id);
    }

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", workoutId)
      .select("program_enrollment_id, workout_template_id")
      .single<{ program_enrollment_id: string; workout_template_id: string | null }>();

    if (sessionError) {
      throw sessionError;
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select("id, program_id, next_template_id")
      .eq("id", session.program_enrollment_id)
      .single<EnrollmentRow>();

    if (enrollmentError) {
      throw enrollmentError;
    }

    await advanceNextTemplate(supabase, enrollment, session.workout_template_id);
    revalidatePath("/dashboard");
    return success(await getWorkoutView(supabase, workoutId));
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Could not complete workout.",
    );
  }
}

export async function calculateNextWorkout(): Promise<
  ActionResult<NextWorkoutPreview>
> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const enrollment = await requireActiveEnrollment(supabase, user.id);
    const template = await getTemplate(supabase, enrollment);
    const templateExercises = await getTemplateExercises(supabase, template.id);
    const exerciseIds = templateExercises.map((exercise) => exercise.exercise_id);
    const [exerciseNames, states] = await Promise.all([
      getExercisesById(supabase, exerciseIds),
      getTrainingStatesByExerciseId(supabase, enrollment.id, exerciseIds),
    ]);

    return success({
      templateId: template.id,
      templateName: template.name,
      exercises: templateExercises.map((exercise) => {
        const state = states.get(exercise.exercise_id);

        return {
          exerciseId: exercise.exercise_id,
          exerciseName: exerciseNames.get(exercise.exercise_id)?.name ?? "Exercise",
          targetSets: exercise.target_sets,
          targetReps: exercise.target_reps,
          plannedLoad: state ? toNumber(state.current_load) : 20,
          unit: state?.unit ?? "kg",
        };
      }),
    });
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : "Could not calculate the next workout.",
    );
  }
}

export async function applyDeload(
  input: ApplyDeloadInput,
): Promise<ActionResult<{ fromLoad: number; toLoad: number; unit: LoadUnit }>> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const enrollment = await requireActiveEnrollment(supabase, user.id);
    const { data: state, error: stateError } = await supabase
      .from("exercise_training_states")
      .select("id, exercise_id, current_load, unit")
      .eq("program_enrollment_id", enrollment.id)
      .eq("exercise_id", input.exerciseId)
      .single<TrainingStateRow>();

    if (stateError) {
      throw stateError;
    }

    const percent = input.percent ?? 10;
    const fromLoad = toNumber(state.current_load);
    const toLoad = Math.max(0, Math.round(fromLoad * (1 - percent / 100) * 2) / 2);
    const reason = input.reason ?? `Manual deload by ${percent}%.`;

    const { error: deloadError } = await supabase.from("deload_events").insert({
      user_id: user.id,
      program_enrollment_id: enrollment.id,
      exercise_id: input.exerciseId,
      from_load: fromLoad,
      to_load: toLoad,
      unit: state.unit,
      reason,
    });

    if (deloadError) {
      throw deloadError;
    }

    const { error: updateError } = await supabase
      .from("exercise_training_states")
      .update({ current_load: toLoad, consecutive_failures: 0 })
      .eq("id", state.id);

    if (updateError) {
      throw updateError;
    }

    revalidatePath("/dashboard");
    return success({ fromLoad, toLoad, unit: state.unit });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not deload.");
  }
}

export async function fetchHistory(
  limit = 20,
): Promise<ActionResult<WorkoutView[]>> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Array<{ id: string }>>();

    if (error) {
      throw error;
    }

    const workouts = [];

    for (const row of data) {
      workouts.push(await getWorkoutView(supabase, row.id));
    }

    return success(workouts);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Could not fetch workout history.",
    );
  }
}

export async function fetchChartData(): Promise<ActionResult<ChartDataPoint[]>> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const { data: sessions, error: sessionsError } = await supabase
      .from("workout_sessions")
      .select("id, completed_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: true })
      .returns<Array<{ id: string; completed_at: string }>>();

    if (sessionsError) {
      throw sessionsError;
    }

    const points: ChartDataPoint[] = [];

    for (const session of sessions) {
      const workout = await getWorkoutView(supabase, session.id);

      for (const exercise of workout.exercises) {
        const totalReps = exercise.sets.reduce(
          (sum, set) => sum + set.completedReps,
          0,
        );

        points.push({
          date: session.completed_at,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          load: exercise.plannedLoad,
          totalReps,
          volume: exercise.plannedLoad * totalReps,
          unit: exercise.unit,
        });
      }
    }

    return success(points);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Could not fetch chart data.",
    );
  }
}

export async function updateUserSettings(
  input: UserSettingsInput,
): Promise<ActionResult<UserSettingsInput>> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);
    const changes = {
      user_id: user.id,
      ...(input.displayName !== undefined
        ? { display_name: input.displayName.trim() || null }
        : {}),
      ...(input.unitSystem ? { unit_system: input.unitSystem } : {}),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(changes, { onConflict: "user_id" })
      .select("display_name, unit_system")
      .single<{ display_name: string | null; unit_system: "metric" | "imperial" }>();

    if (error) {
      throw error;
    }

    revalidatePath("/dashboard");
    return success({
      displayName: data.display_name ?? undefined,
      unitSystem: data.unit_system,
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Could not update settings.",
    );
  }
}
