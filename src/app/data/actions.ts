"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logError, logInfo } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/config";
import { getNextTemplateId } from "@/lib/training/workout-rules";
import type { ActionResult, LoadUnit, SetStatus } from "@/lib/training/types";

type JsonRecord = Record<string, unknown>;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ExerciseReference = {
  id: string;
  slug: string;
  name: string;
};

type TemplateReference = {
  id: string;
  name: string;
  sort_order: number;
};

type EnrollmentReference = {
  id: string;
  program_id: string;
  next_template_id: string | null;
};

type ImportSet = {
  setNumber: number;
  targetReps: number;
  completedReps: number;
  load: number;
  unit: LoadUnit;
  status: SetStatus;
  failureReason: string | null;
  notes: string | null;
};

type ImportExercise = {
  sourceName: string;
  exerciseId: string;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
  plannedLoad: number;
  unit: LoadUnit;
  status: "completed" | "failed" | "skipped";
  sets: ImportSet[];
};

type ImportWorkout = {
  sourceId: string | null;
  templateName: string | null;
  startedAt: string;
  completedAt: string;
  notes: string | null;
  exercises: ImportExercise[];
};

export type ImportWorkoutJsonResult = {
  importedWorkouts: number;
  importedExercises: number;
  importedSets: number;
  skippedWorkouts: number;
  warnings: string[];
};

export type UserDataExport = {
  exportedAt: string;
  user: {
    id: string;
    email: string | null;
  };
  profile: JsonRecord | null;
  training: {
    programEnrollments: JsonRecord[];
    exerciseTrainingStates: JsonRecord[];
    workoutSessions: JsonRecord[];
    workoutExercises: JsonRecord[];
    workoutSets: JsonRecord[];
    failureEvents: JsonRecord[];
    deloadEvents: JsonRecord[];
    progressionDecisions: JsonRecord[];
  };
  referenceData: {
    programs: JsonRecord[];
    exercises: JsonRecord[];
    programExercises: JsonRecord[];
    workoutTemplates: JsonRecord[];
    workoutTemplateExercises: JsonRecord[];
  };
};

const exerciseAliases: Record<string, string> = {
  "barbell row": "barbell-row",
  "barbell rows": "barbell-row",
  bench: "bench-press",
  "bench press": "bench-press",
  deadlift: "deadlift",
  deadlifts: "deadlift",
  ohp: "overhead-press",
  "overhead press": "overhead-press",
  press: "overhead-press",
  row: "barbell-row",
  rows: "barbell-row",
  squat: "squat",
  squats: "squat",
};

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function failure<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDate(value: unknown, fallback: Date) {
  const raw = asString(value);

  if (!raw) {
    return fallback.toISOString();
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

function normalizeUnit(value: unknown): LoadUnit {
  const raw = asString(value)?.toLowerCase();
  return raw === "lb" || raw === "lbs" || raw === "pounds" ? "lb" : "kg";
}

function normalizeSetStatus(
  status: unknown,
  completedReps: number,
  targetReps: number,
): SetStatus {
  const raw = asString(status)?.toLowerCase();

  if (raw === "skipped" || raw === "skip") {
    return "skipped";
  }

  if (raw === "failed" || raw === "missed") {
    return "failed";
  }

  return completedReps >= targetReps ? "completed" : "failed";
}

function actionFailure<T>(
  error: unknown,
  event: string,
  operation: string,
  fallback: string,
  context: Record<string, string | number | boolean | null | undefined> = {},
): ActionResult<T> {
  logError(event, error, {
    route: "/dashboard",
    operation,
    ...context,
  });

  return failure(error instanceof Error ? error.message : fallback);
}

function serviceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }

  return key;
}

function createAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Log in to manage your data.");
  }

  return { supabase, user: data.user };
}

async function requireStrongLiftsEnrollment(
  supabase: SupabaseClient,
  userId: string,
): Promise<EnrollmentReference> {
  const { data: existing, error: existingError } = await supabase
    .from("program_enrollments")
    .select("id, program_id, next_template_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<EnrollmentReference>();

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
    .single<EnrollmentReference>();

  if (enrollmentError) {
    throw enrollmentError;
  }

  return enrollment;
}

async function getExerciseReferences(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, slug, name")
    .returns<ExerciseReference[]>();

  if (error) {
    throw error;
  }

  const byKey = new Map<string, ExerciseReference>();

  for (const exercise of data) {
    byKey.set(normalizeKey(exercise.slug), exercise);
    byKey.set(normalizeKey(exercise.name), exercise);
  }

  for (const [alias, slug] of Object.entries(exerciseAliases)) {
    const exercise = data.find((item) => item.slug === slug);

    if (exercise) {
      byKey.set(normalizeKey(alias), exercise);
    }
  }

  return byKey;
}

async function getTemplateReferences(
  supabase: SupabaseClient,
  programId: string,
) {
  const { data, error } = await supabase
    .from("workout_templates")
    .select("id, name, sort_order")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true })
    .returns<TemplateReference[]>();

  if (error) {
    throw error;
  }

  return data;
}

function findExerciseName(row: JsonRecord) {
  return (
    asString(row.exerciseName) ??
    asString(row.exercise_name) ??
    asString(row.exercise) ??
    asString(row.lift) ??
    asString(row.name)
  );
}

function parseExercise(
  value: unknown,
  sortOrder: number,
  exerciseMap: Map<string, ExerciseReference>,
  warnings: string[],
): ImportExercise | null {
  if (!isRecord(value)) {
    warnings.push(`Skipped exercise ${sortOrder}: expected an object.`);
    return null;
  }

  const sourceName = findExerciseName(value);
  const exercise = sourceName ? exerciseMap.get(normalizeKey(sourceName)) : null;

  if (!sourceName || !exercise) {
    warnings.push(`Skipped exercise ${sortOrder}: unknown lift "${sourceName ?? "unnamed"}".`);
    return null;
  }

  const targetSets =
    asNumber(value.targetSets) ??
    asNumber(value.target_sets) ??
    asNumber(value.sets) ??
    asArray(value.sets).length ??
    5;
  const targetReps =
    asNumber(value.targetReps) ??
    asNumber(value.target_reps) ??
    asNumber(value.reps) ??
    5;
  const plannedLoad =
    asNumber(value.plannedLoad) ??
    asNumber(value.planned_load) ??
    asNumber(value.weight) ??
    asNumber(value.load) ??
    20;
  const unit = normalizeUnit(value.unit);
  const importedSets = asArray(value.sets);
  const sets =
    importedSets.length > 0
      ? importedSets
          .map((setValue, index): ImportSet | null => {
            if (!isRecord(setValue)) {
              return null;
            }

            const setTargetReps =
              asNumber(setValue.targetReps) ??
              asNumber(setValue.target_reps) ??
              asNumber(setValue.reps) ??
              targetReps;
            const completedReps =
              asNumber(setValue.completedReps) ??
              asNumber(setValue.completed_reps) ??
              asNumber(setValue.repsCompleted) ??
              asNumber(setValue.reps_completed) ??
              asNumber(setValue.reps) ??
              setTargetReps;
            const status = normalizeSetStatus(
              setValue.status,
              Math.trunc(completedReps),
              Math.trunc(setTargetReps),
            );

            return {
              setNumber:
                Math.trunc(asNumber(setValue.setNumber) ?? asNumber(setValue.set_number) ?? index + 1),
              targetReps: Math.max(1, Math.trunc(setTargetReps)),
              completedReps: Math.max(0, Math.trunc(completedReps)),
              load: asNumber(setValue.load) ?? asNumber(setValue.weight) ?? plannedLoad,
              unit: normalizeUnit(setValue.unit ?? unit),
              status,
              failureReason:
                asString(setValue.failureReason) ?? asString(setValue.failure_reason),
              notes: asString(setValue.notes),
            };
          })
          .filter((set): set is ImportSet => Boolean(set))
      : Array.from({ length: Math.max(1, Math.trunc(targetSets)) }, (_, index) => ({
          setNumber: index + 1,
          targetReps: Math.max(1, Math.trunc(targetReps)),
          completedReps: Math.max(0, Math.trunc(targetReps)),
          load: plannedLoad,
          unit,
          status: "completed" as const,
          failureReason: null,
          notes: null,
        }));
  const failedOrSkippedSet = sets.some((set) => set.status !== "completed");

  return {
    sourceName,
    exerciseId: exercise.id,
    sortOrder,
    targetSets: sets.length,
    targetReps: Math.max(1, Math.trunc(targetReps)),
    plannedLoad,
    unit,
    status: failedOrSkippedSet ? "failed" : "completed",
    sets,
  };
}

function workoutSourceRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (isRecord(payload.training) && Array.isArray(payload.training.workoutSessions)) {
    return payload.training.workoutSessions;
  }

  return (
    asArray(payload.workouts).length ? asArray(payload.workouts) :
    asArray(payload.sessions).length ? asArray(payload.sessions) :
    asArray(payload.workoutSessions).length ? asArray(payload.workoutSessions) :
    []
  );
}

function findRenascorExercises(payload: unknown, workoutId: string) {
  if (!isRecord(payload) || !isRecord(payload.training)) {
    return [];
  }

  return asArray(payload.training.workoutExercises).filter(
    (exercise) =>
      isRecord(exercise) &&
      (exercise.workout_session_id === workoutId ||
        exercise.workoutSessionId === workoutId),
  );
}

function findRenascorSets(payload: unknown, workoutExerciseId: string) {
  if (!isRecord(payload) || !isRecord(payload.training)) {
    return [];
  }

  return asArray(payload.training.workoutSets).filter(
    (set) =>
      isRecord(set) &&
      (set.workout_exercise_id === workoutExerciseId ||
        set.workoutExerciseId === workoutExerciseId),
  );
}

function parseImportWorkouts(
  payload: unknown,
  exerciseMap: Map<string, ExerciseReference>,
): { workouts: ImportWorkout[]; warnings: string[] } {
  const warnings: string[] = [];
  const rows = workoutSourceRows(payload);
  const workouts = rows
    .map((row, index): ImportWorkout | null => {
      if (!isRecord(row)) {
        warnings.push(`Skipped workout ${index + 1}: expected an object.`);
        return null;
      }

      const sourceId = asString(row.id);
      const sourceExercises =
        asArray(row.exercises).length > 0
          ? asArray(row.exercises)
          : sourceId
            ? findRenascorExercises(payload, sourceId)
            : [];
      const exercises = sourceExercises
        .map((exercise, exerciseIndex) => {
          if (isRecord(exercise) && sourceId && !Array.isArray(exercise.sets)) {
            const exerciseId = asString(exercise.id);
            return parseExercise(
              {
                ...exercise,
                sets: exerciseId ? findRenascorSets(payload, exerciseId) : [],
              },
              exerciseIndex + 1,
              exerciseMap,
              warnings,
            );
          }

          return parseExercise(exercise, exerciseIndex + 1, exerciseMap, warnings);
        })
        .filter((exercise): exercise is ImportExercise => Boolean(exercise));

      if (exercises.length === 0) {
        warnings.push(`Skipped workout ${index + 1}: no recognized StrongLifts exercises.`);
        return null;
      }

      const fallbackDate = new Date();

      return {
        sourceId,
        templateName:
          asString(row.templateName) ??
          asString(row.template_name) ??
          asString(row.name) ??
          asString(row.workoutName),
        startedAt: normalizeDate(
          row.startedAt ?? row.started_at ?? row.date ?? row.completedAt ?? row.completed_at,
          fallbackDate,
        ),
        completedAt: normalizeDate(row.completedAt ?? row.completed_at ?? row.date, fallbackDate),
        notes: asString(row.notes),
        exercises,
      };
    })
    .filter((workout): workout is ImportWorkout => Boolean(workout))
    .sort(
      (left, right) =>
        new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime(),
    );

  return { workouts, warnings };
}

function chooseTemplate(
  workout: ImportWorkout,
  templates: TemplateReference[],
): TemplateReference | null {
  if (templates.length === 0) {
    return null;
  }

  const name = normalizeKey(workout.templateName ?? "");
  const exact = templates.find((template) => normalizeKey(template.name) === name);

  if (exact) {
    return exact;
  }

  const hasDeadliftOrPress = workout.exercises.some((exercise) =>
    ["deadlift", "overhead press"].includes(normalizeKey(exercise.sourceName)),
  );

  return templates.find((template) =>
    normalizeKey(template.name).endsWith(hasDeadliftOrPress ? "b" : "a"),
  ) ?? templates[0];
}

async function upsertLatestTrainingStates(
  supabase: SupabaseClient,
  userId: string,
  enrollmentId: string,
  workouts: ImportWorkout[],
) {
  const latestByExercise = new Map<
    string,
    { load: number; unit: LoadUnit; completedAt: string; consecutiveFailures: number }
  >();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const previous = latestByExercise.get(exercise.exerciseId);

      if (previous && previous.completedAt > workout.completedAt) {
        continue;
      }

      latestByExercise.set(exercise.exerciseId, {
        load: exercise.plannedLoad,
        unit: exercise.unit,
        completedAt: workout.completedAt,
        consecutiveFailures: exercise.status === "failed" ? 1 : 0,
      });
    }
  }

  for (const [exerciseId, latest] of latestByExercise) {
    const { data: existing, error: existingError } = await supabase
      .from("exercise_training_states")
      .select("id")
      .eq("program_enrollment_id", enrollmentId)
      .eq("exercise_id", exerciseId)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw existingError;
    }

    const row = {
      user_id: userId,
      program_enrollment_id: enrollmentId,
      exercise_id: exerciseId,
      current_load: latest.load,
      unit: latest.unit,
      consecutive_failures: latest.consecutiveFailures,
    };

    const { error } = existing
      ? await supabase.from("exercise_training_states").update(row).eq("id", existing.id)
      : await supabase.from("exercise_training_states").insert(row);

    if (error) {
      throw error;
    }
  }
}

async function selectUserRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .returns<JsonRecord[]>();

  if (error) {
    throw error;
  }

  return data;
}

async function selectReferenceRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .returns<JsonRecord[]>();

  if (error) {
    throw error;
  }

  return data;
}

async function deleteTrainingRowsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { error } = await supabase
    .from("program_enrollments")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function exportMyData(): Promise<ActionResult<UserDataExport>> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<JsonRecord>();

    if (profileError) {
      throw profileError;
    }

    const [
      programEnrollments,
      exerciseTrainingStates,
      workoutSessions,
      workoutExercises,
      workoutSets,
      failureEvents,
      deloadEvents,
      progressionDecisions,
      programs,
      exercises,
      programExercises,
      workoutTemplates,
      workoutTemplateExercises,
    ] = await Promise.all([
      selectUserRows(supabase, "program_enrollments", user.id),
      selectUserRows(supabase, "exercise_training_states", user.id),
      selectUserRows(supabase, "workout_sessions", user.id),
      selectUserRows(supabase, "workout_exercises", user.id),
      selectUserRows(supabase, "workout_sets", user.id),
      selectUserRows(supabase, "failure_events", user.id),
      selectUserRows(supabase, "deload_events", user.id),
      selectUserRows(supabase, "progression_decisions", user.id),
      selectReferenceRows(supabase, "programs"),
      selectReferenceRows(supabase, "exercises"),
      selectReferenceRows(supabase, "program_exercises"),
      selectReferenceRows(supabase, "workout_templates"),
      selectReferenceRows(supabase, "workout_template_exercises"),
    ]);

    logInfo("data.export.completed", {
      route: "/dashboard",
      operation: "exportMyData",
      userId: user.id,
    });

    return success({
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile,
      training: {
        programEnrollments,
        exerciseTrainingStates,
        workoutSessions,
        workoutExercises,
        workoutSets,
        failureEvents,
        deloadEvents,
        progressionDecisions,
      },
      referenceData: {
        programs,
        exercises,
        programExercises,
        workoutTemplates,
        workoutTemplateExercises,
      },
    });
  } catch (error) {
    return actionFailure(
      error,
      "data.export.failed",
      "exportMyData",
      "Could not export your data.",
    );
  }
}

export async function importWorkoutJson(
  payload: unknown,
): Promise<ActionResult<ImportWorkoutJsonResult>> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const [enrollment, exerciseMap] = await Promise.all([
      requireStrongLiftsEnrollment(supabase, user.id),
      getExerciseReferences(supabase),
    ]);
    const templates = await getTemplateReferences(supabase, enrollment.program_id);
    const { workouts, warnings } = parseImportWorkouts(payload, exerciseMap);

    if (workouts.length === 0) {
      return failure(
        "No recognizable StrongLifts workouts were found in that JSON file.",
      );
    }

    let importedWorkouts = 0;
    let importedExercises = 0;
    let importedSets = 0;
    let lastTemplateId: string | null = null;

    for (const workout of workouts) {
      const template = chooseTemplate(workout, templates);
      lastTemplateId = template?.id ?? lastTemplateId;

      const { data: session, error: sessionError } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          program_enrollment_id: enrollment.id,
          workout_template_id: template?.id ?? null,
          status: "completed",
          scheduled_for: workout.completedAt.slice(0, 10),
          started_at: workout.startedAt,
          completed_at: workout.completedAt,
          notes: workout.notes,
        })
        .select("id")
        .single<{ id: string }>();

      if (sessionError) {
        throw sessionError;
      }

      importedWorkouts += 1;

      for (const exercise of workout.exercises) {
        const { data: workoutExercise, error: exerciseError } = await supabase
          .from("workout_exercises")
          .insert({
            user_id: user.id,
            workout_session_id: session.id,
            exercise_id: exercise.exerciseId,
            sort_order: exercise.sortOrder,
            target_sets: exercise.targetSets,
            target_reps: exercise.targetReps,
            planned_load: exercise.plannedLoad,
            unit: exercise.unit,
            status: exercise.status,
          })
          .select("id")
          .single<{ id: string }>();

        if (exerciseError) {
          throw exerciseError;
        }

        importedExercises += 1;

        const setRows = exercise.sets.map((set) => ({
          user_id: user.id,
          workout_exercise_id: workoutExercise.id,
          set_number: set.setNumber,
          target_reps: set.targetReps,
          completed_reps: set.completedReps,
          load: set.load,
          unit: set.unit,
          status: set.status,
          failure_reason: set.failureReason,
          notes: set.notes,
        }));

        const { error: setsError } = await supabase
          .from("workout_sets")
          .insert(setRows);

        if (setsError) {
          throw setsError;
        }

        importedSets += setRows.length;
      }
    }

    await upsertLatestTrainingStates(supabase, user.id, enrollment.id, workouts);

    if (lastTemplateId && templates.length > 0) {
      const nextTemplateId = getNextTemplateId(
        templates.map((template) => ({
          id: template.id,
          sortOrder: template.sort_order,
        })),
        lastTemplateId,
      );
      const { error } = await supabase
        .from("program_enrollments")
        .update({ next_template_id: nextTemplateId })
        .eq("id", enrollment.id);

      if (error) {
        throw error;
      }
    }

    revalidatePath("/dashboard");
    logInfo("data.import.completed", {
      route: "/dashboard",
      operation: "importWorkoutJson",
      userId: user.id,
      importedWorkouts,
      importedExercises,
      importedSets,
    });

    return success({
      importedWorkouts,
      importedExercises,
      importedSets,
      skippedWorkouts: Math.max(0, workoutSourceRows(payload).length - importedWorkouts),
      warnings,
    });
  } catch (error) {
    return actionFailure(
      error,
      "data.import.failed",
      "importWorkoutJson",
      "Could not import that JSON file.",
    );
  }
}

export async function deleteWorkoutSession(
  workoutId: string,
): Promise<ActionResult<{ workoutId: string }>> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { error } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", workoutId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    revalidatePath("/dashboard");
    logInfo("data.workout.delete.completed", {
      route: "/dashboard",
      operation: "deleteWorkoutSession",
      userId: user.id,
      workoutId,
    });

    return success({ workoutId });
  } catch (error) {
    return actionFailure(
      error,
      "data.workout.delete.failed",
      "deleteWorkoutSession",
      "Could not delete that workout.",
      { workoutId },
    );
  }
}

export async function deleteAllTrainingData(): Promise<
  ActionResult<{ userId: string }>
> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    await deleteTrainingRowsForUser(supabase, user.id);

    revalidatePath("/dashboard");
    logInfo("data.training.delete.completed", {
      route: "/dashboard",
      operation: "deleteAllTrainingData",
      userId: user.id,
    });

    return success({ userId: user.id });
  } catch (error) {
    return actionFailure(
      error,
      "data.training.delete.failed",
      "deleteAllTrainingData",
      "Could not delete your training data.",
    );
  }
}

export async function deleteAccountAndAppData(): Promise<
  ActionResult<{ userId: string }>
> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const admin = createAdminClient();

    await deleteTrainingRowsForUser(supabase, user.id);

    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", user.id);

    if (profileError) {
      throw profileError;
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      throw deleteUserError;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      logError("data.account.signout.failed", signOutError, {
        route: "/dashboard",
        operation: "deleteAccountAndAppData",
        userId: user.id,
      });
    }

    logInfo("data.account.delete.completed", {
      route: "/dashboard",
      operation: "deleteAccountAndAppData",
      userId: user.id,
    });

    return success({ userId: user.id });
  } catch (error) {
    return actionFailure(
      error,
      "data.account.delete.failed",
      "deleteAccountAndAppData",
      "Could not delete your account.",
    );
  }
}
