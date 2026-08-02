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

type BaseExerciseRow = {
  id: string;
  name: string;
  category: string | null;
  default_unit: LoadUnit;
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

const confirmedAssistanceExercises: AssistanceExerciseView[] = [
  { id: "preset-barbell-curls", name: "Barbell Curls", category: "Arms", defaultUnit: "kg", isCustom: false },
  { id: "preset-dumbbell-curls", name: "Dumbbell Curls", category: "Arms", defaultUnit: "kg", isCustom: false },
  { id: "preset-hammer-curls", name: "Hammer Curls", category: "Arms", defaultUnit: "kg", isCustom: false },
  { id: "preset-skull-crushers", name: "Skull Crushers", category: "Arms", defaultUnit: "kg", isCustom: false },
  { id: "preset-tricep-pushdowns", name: "Tricep Pushdowns", category: "Arms", defaultUnit: "kg", isCustom: false },
  { id: "preset-chin-ups", name: "Chin-Ups", category: "Back", defaultUnit: "kg", isCustom: false },
  { id: "preset-lat-pulldowns", name: "Lat Pulldowns", category: "Back", defaultUnit: "kg", isCustom: false },
  { id: "preset-pull-ups", name: "Pull-Ups", category: "Back", defaultUnit: "kg", isCustom: false },
  { id: "preset-seated-cable-rows", name: "Seated Cable Rows", category: "Back", defaultUnit: "kg", isCustom: false },
  { id: "preset-dips", name: "Dips", category: "Chest", defaultUnit: "kg", isCustom: false },
  { id: "preset-dumbbell-flyes", name: "Dumbbell Flyes", category: "Chest", defaultUnit: "kg", isCustom: false },
  { id: "preset-incline-dumbbell-press", name: "Incline Dumbbell Press", category: "Chest", defaultUnit: "kg", isCustom: false },
  { id: "preset-push-ups", name: "Push-Ups", category: "Chest", defaultUnit: "kg", isCustom: false },
  { id: "preset-ab-wheel-rollouts", name: "Ab Wheel Rollouts", category: "Core", defaultUnit: "kg", isCustom: false },
  { id: "preset-cable-crunches", name: "Cable Crunches", category: "Core", defaultUnit: "kg", isCustom: false },
  { id: "preset-hanging-leg-raises", name: "Hanging Leg Raises", category: "Core", defaultUnit: "kg", isCustom: false },
  { id: "preset-plank", name: "Plank", category: "Core", defaultUnit: "kg", isCustom: false },
  { id: "preset-bulgarian-split-squats", name: "Bulgarian Split Squats", category: "Lower Body", defaultUnit: "kg", isCustom: false },
  { id: "preset-calf-raises", name: "Calf Raises", category: "Lower Body", defaultUnit: "kg", isCustom: false },
  { id: "preset-leg-curls", name: "Leg Curls", category: "Lower Body", defaultUnit: "kg", isCustom: false },
  { id: "preset-lunges", name: "Lunges", category: "Lower Body", defaultUnit: "kg", isCustom: false },
  { id: "preset-step-ups", name: "Step Ups", category: "Lower Body", defaultUnit: "kg", isCustom: false },
  { id: "preset-face-pulls", name: "Face Pulls", category: "Shoulders", defaultUnit: "kg", isCustom: false },
  { id: "preset-lateral-raises", name: "Lateral Raises", category: "Shoulders", defaultUnit: "kg", isCustom: false },
  { id: "preset-rear-delt-flyes", name: "Rear Delt Flyes", category: "Shoulders", defaultUnit: "kg", isCustom: false },
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

function needsAssistanceMigration(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /created_by_user_id|assistance_templates|assistance_template_exercises|schema cache/i.test(
    error.message,
  );
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

function mapBaseExercise(row: BaseExerciseRow): AssistanceExerciseView {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "Custom",
    defaultUnit: row.default_unit,
    isCustom: false,
  };
}

function assistanceOnly(exercises: AssistanceExerciseView[]) {
  return exercises.filter((exercise) =>
    assistanceCategories.includes(exercise.category) || exercise.isCustom,
  );
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

async function fetchTemplatesOrEmpty(supabase: SupabaseClient) {
  try {
    return await fetchTemplates(supabase);
  } catch {
    return [];
  }
}

async function fetchExercises(
  supabase: SupabaseClient,
  userId: string,
): Promise<AssistanceExerciseView[]> {
  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id, name, category, default_unit, created_by_user_id")
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .returns<AssistanceExerciseRow[]>();

  if (!exercisesError) {
    const assistanceExercises = assistanceOnly(
      exercises.map((exercise) => mapExercise(exercise, userId)),
    );
    return assistanceExercises.length ? assistanceExercises : confirmedAssistanceExercises;
  }

  const { data: baseExercises, error: baseError } = await supabase
    .from("exercises")
    .select("id, name, category, default_unit")
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .returns<BaseExerciseRow[]>();

  if (baseError) {
    return confirmedAssistanceExercises;
  }

  const assistanceExercises = assistanceOnly(baseExercises.map(mapBaseExercise));
  return assistanceExercises.length ? assistanceExercises : confirmedAssistanceExercises;
}

export async function fetchAssistanceLibrary(): Promise<
  ActionResult<AssistanceLibraryView>
> {
  try {
    const supabase = await createClient();
    const user = await getUser(supabase);

    return success({
      exercises: await fetchExercises(supabase, user.id),
      templates: await fetchTemplatesOrEmpty(supabase),
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
      if (needsAssistanceMigration(error)) {
        return failure(
          "Apply the assistance Supabase migration before adding custom exercises.",
        );
      }
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

    if (exerciseIds.some((exerciseId) => exerciseId.startsWith("preset-"))) {
      return failure(
        "Apply the assistance Supabase migration before saving templates.",
      );
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
      if (needsAssistanceMigration(templateError)) {
        return failure(
          "Apply the assistance Supabase migration before saving templates.",
        );
      }
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
      if (needsAssistanceMigration(exercisesError)) {
        return failure(
          "Apply the assistance Supabase migration before saving templates.",
        );
      }
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
