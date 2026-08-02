"use server";

import { revalidatePath } from "next/cache";
import { logError, logInfo } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  AssistanceExerciseView,
  AssistanceLibraryView,
  AssistanceTemplateView,
  CreateAssistanceTemplateInput,
  LoadUnit,
} from "@/lib/training/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type User = {
  id: string;
};

type AssistanceExerciseRow = {
  id: string;
  name: string;
  category: string | null;
  default_unit: LoadUnit;
  created_by_user_id: string | null;
};

type AssistanceTemplateRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type AssistanceTemplateExerciseRow = {
  id: string;
  assistance_template_id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  target_reps: number;
  exercises: {
    name: string;
    category: string | null;
  } | null;
};

const assistanceCategories = [
  "Arms",
  "Back",
  "Chest",
  "Core",
  "Lower Body",
  "Shoulders",
];

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
): ActionResult<T> {
  logError(event, error, {
    route: "/dashboard",
    operation,
  });

  return failure(error instanceof Error ? error.message : fallback);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeCategory(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Custom";

  const known = assistanceCategories.find(
    (category) => category.toLowerCase() === trimmed.toLowerCase(),
  );
  return known ?? trimmed;
}

async function getUser(supabase: SupabaseClient): Promise<User> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Log in to manage assistance exercises.");
  }

  return { id: data.user.id };
}

function mapExercise(row: AssistanceExerciseRow, userId: string): AssistanceExerciseView {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "Custom",
    defaultUnit: row.default_unit,
    isCustom: row.created_by_user_id === userId,
  };
}

async function fetchTemplates(
  supabase: SupabaseClient,
): Promise<AssistanceTemplateView[]> {
  const { data: templates, error: templatesError } = await supabase
    .from("assistance_templates")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .returns<AssistanceTemplateRow[]>();

  if (templatesError) {
    throw templatesError;
  }

  if (templates.length === 0) {
    return [];
  }

  const templateIds = templates.map((template) => template.id);
  const { data: templateExercises, error: exercisesError } = await supabase
    .from("assistance_template_exercises")
    .select("id, assistance_template_id, exercise_id, sort_order, target_sets, target_reps, exercises(name, category)")
    .in("assistance_template_id", templateIds)
    .order("sort_order", { ascending: true })
    .returns<AssistanceTemplateExerciseRow[]>();

  if (exercisesError) {
    throw exercisesError;
  }

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
    exercises: templateExercises
      .filter((exercise) => exercise.assistance_template_id === template.id)
      .map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercises?.name ?? "Exercise",
        category: exercise.exercises?.category ?? "Custom",
        sortOrder: exercise.sort_order,
        targetSets: exercise.target_sets,
        targetReps: exercise.target_reps,
      })),
  }));
}

export async function fetchAssistanceLibrary(): Promise<
  ActionResult<AssistanceLibraryView>
> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);

    const { data: exercises, error: exercisesError } = await supabase
      .from("exercises")
      .select("id, name, category, default_unit, created_by_user_id")
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .returns<AssistanceExerciseRow[]>();

    if (exercisesError) {
      throw exercisesError;
    }

    return success({
      exercises: exercises
        .filter(
          (exercise) =>
            assistanceCategories.includes(exercise.category ?? "") ||
            exercise.created_by_user_id === user.id,
        )
        .map((exercise) => mapExercise(exercise, user.id)),
      templates: await fetchTemplates(supabase),
    });
  } catch (error) {
    return actionFailure(
      error,
      "assist.library.fetch.failed",
      "fetchAssistanceLibrary",
      "Could not fetch assistance exercises.",
    );
  }
}

export async function addCustomAssistanceExercise(input: {
  name: string;
  category: string;
}): Promise<ActionResult<AssistanceLibraryView>> {
  try {
    const name = input.name.trim();
    if (!name) {
      return failure("Enter an exercise name.");
    }

    const supabase = await createClient();
    const user = await getUser(supabase);
    const category = normalizeCategory(input.category);
    const slug = `custom-${user.id.slice(0, 8)}-${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;

    const { error } = await supabase.from("exercises").insert({
      slug,
      name,
      category,
      default_unit: "kg",
      created_by_user_id: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath("/dashboard");
    logInfo("assist.exercise.create.completed", {
      route: "/dashboard",
      operation: "addCustomAssistanceExercise",
      userId: user.id,
    });
    return fetchAssistanceLibrary();
  } catch (error) {
    return actionFailure(
      error,
      "assist.exercise.create.failed",
      "addCustomAssistanceExercise",
      "Could not add custom exercise.",
    );
  }
}

export async function createAssistanceTemplate(
  input: CreateAssistanceTemplateInput,
): Promise<ActionResult<AssistanceLibraryView>> {
  try {
    const name = input.name.trim();
    const exerciseIds = [...new Set(input.exerciseIds)].filter(Boolean);

    if (!name) {
      return failure("Enter a template name.");
    }

    if (exerciseIds.length === 0) {
      return failure("Select at least one assistance exercise.");
    }

    const supabase = await createClient();
    const user = await getUser(supabase);

    const { data: template, error: templateError } = await supabase
      .from("assistance_templates")
      .insert({
        user_id: user.id,
        name,
      })
      .select("id")
      .single<{ id: string }>();

    if (templateError) {
      throw templateError;
    }

    const rows = exerciseIds.map((exerciseId, index) => ({
      user_id: user.id,
      assistance_template_id: template.id,
      exercise_id: exerciseId,
      sort_order: index + 1,
      target_sets: 3,
      target_reps: 10,
    }));

    const { error: exercisesError } = await supabase
      .from("assistance_template_exercises")
      .insert(rows);

    if (exercisesError) {
      throw exercisesError;
    }

    revalidatePath("/dashboard");
    logInfo("assist.template.create.completed", {
      route: "/dashboard",
      operation: "createAssistanceTemplate",
      userId: user.id,
      templateId: template.id,
      exerciseCount: exerciseIds.length,
    });
    return fetchAssistanceLibrary();
  } catch (error) {
    return actionFailure(
      error,
      "assist.template.create.failed",
      "createAssistanceTemplate",
      "Could not create assistance template.",
    );
  }
}
