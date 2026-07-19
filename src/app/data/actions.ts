"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logError, logInfo } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/config";
import type { ActionResult } from "@/lib/training/types";

type JsonRecord = Record<string, unknown>;

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

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function failure<T>(error: string): ActionResult<T> {
  return { ok: false, error };
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
