"use server";

import { revalidatePath } from "next/cache";
import { logError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  AddBodyweightEntryInput,
  BodyweightEntryView,
  LoadUnit,
} from "@/lib/training/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type BodyweightEntryRow = {
  id: string;
  weight: number | string;
  unit: LoadUnit;
  measured_on: string;
  created_at: string;
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
): ActionResult<T> {
  logError(event, error, {
    route: "/dashboard",
    operation,
  });

  return failure(error instanceof Error ? error.message : fallback);
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function mapEntry(row: BodyweightEntryRow): BodyweightEntryView {
  return {
    id: row.id,
    weight: toNumber(row.weight),
    unit: row.unit,
    measuredOn: row.measured_on,
    createdAt: row.created_at,
  };
}

async function getUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Log in to manage bodyweight entries.");
  }

  return data.user.id;
}

function normalizeMeasuredOn(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (!value || Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return value;
}

export async function fetchBodyweightEntries(): Promise<
  ActionResult<BodyweightEntryView[]>
> {
  try {
    const supabase = await createClient();
    await getUserId(supabase);
    const { data, error } = await supabase
      .from("bodyweight_entries")
      .select("id, weight, unit, measured_on, created_at")
      .order("measured_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120)
      .returns<BodyweightEntryRow[]>();

    if (error) {
      throw error;
    }

    return success(data.map(mapEntry));
  } catch (error) {
    return actionFailure(
      error,
      "bodyweight.fetch.failed",
      "fetchBodyweightEntries",
      "Could not fetch bodyweight entries.",
    );
  }
}

export async function addBodyweightEntry(
  input: AddBodyweightEntryInput,
): Promise<ActionResult<BodyweightEntryView[]>> {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);
    const weight = Math.round(Math.max(0, Number(input.weight) || 0) * 10) / 10;

    if (weight <= 0) {
      return failure("Enter a bodyweight above 0.");
    }

    const { error } = await supabase.from("bodyweight_entries").upsert(
      {
        user_id: userId,
        weight,
        unit: "kg",
        measured_on: normalizeMeasuredOn(input.measuredOn),
      },
      { onConflict: "user_id,measured_on" },
    );

    if (error) {
      throw error;
    }

    revalidatePath("/dashboard");
    return fetchBodyweightEntries();
  } catch (error) {
    return actionFailure(
      error,
      "bodyweight.add.failed",
      "addBodyweightEntry",
      "Could not save bodyweight entry.",
    );
  }
}
