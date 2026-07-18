import type { ChartDataPoint, LoadUnit, SetStatus, WorkoutExerciseStatus } from "./types";

export type TemplateOrderRow = {
  id: string;
  sortOrder: number;
};

export type SetOutcomeRow = {
  status: string;
  completedReps: number;
  targetReps: number;
};

export type ChartExerciseInput = {
  exerciseId: string;
  exerciseName: string;
  plannedLoad: number;
  unit: LoadUnit;
  sets: Array<{
    completedReps: number;
  }>;
};

export function getNextTemplateId(
  templates: TemplateOrderRow[],
  completedTemplateId: string | null,
): string | null {
  if (!completedTemplateId || templates.length === 0) {
    return null;
  }

  const sortedTemplates = [...templates].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sortedTemplates.findIndex(
    (template) => template.id === completedTemplateId,
  );
  const nextTemplate = sortedTemplates[(index + 1) % sortedTemplates.length];

  return nextTemplate?.id ?? sortedTemplates[0]?.id ?? null;
}

export function inferSetStatus(
  completedReps: number,
  targetReps: number,
  explicitStatus?: SetStatus,
): SetStatus {
  return explicitStatus ?? (completedReps >= targetReps ? "completed" : "failed");
}

export function getExerciseStatusFromSets(
  sets: SetOutcomeRow[],
): WorkoutExerciseStatus {
  const allFinished = sets.every((row) =>
    ["completed", "failed", "skipped"].includes(row.status),
  );
  const allSuccessful =
    allFinished &&
    sets.every(
      (row) => row.status === "completed" && row.completedReps >= row.targetReps,
    );

  if (allSuccessful) {
    return "completed";
  }

  return allFinished ? "failed" : "active";
}

export function completedAllPrescribedReps(sets: SetOutcomeRow[]) {
  return (
    sets.length > 0 &&
    sets.every(
      (set) => set.status === "completed" && set.completedReps >= set.targetReps,
    )
  );
}

export function buildChartDataPoints(
  completedAt: string,
  exercises: ChartExerciseInput[],
): ChartDataPoint[] {
  return exercises.map((exercise) => {
    const totalReps = exercise.sets.reduce(
      (sum, set) => sum + set.completedReps,
      0,
    );

    return {
      date: completedAt,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      load: exercise.plannedLoad,
      totalReps,
      volume: exercise.plannedLoad * totalReps,
      unit: exercise.unit,
    };
  });
}
