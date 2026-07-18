export type LoadUnit = "kg" | "lb";
export type WorkoutStatus =
  | "planned"
  | "in_progress"
  | "paused"
  | "completed"
  | "skipped"
  | "discarded";
export type WorkoutExerciseStatus =
  | "planned"
  | "active"
  | "completed"
  | "failed"
  | "skipped";
export type SetStatus = "planned" | "completed" | "failed" | "skipped";
export type ProgressionDecisionKind = "increase" | "repeat" | "deload" | "hold";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type SetResultInput = {
  setId: string;
  completedReps: number;
  status?: SetStatus;
  failureReason?: string;
  notes?: string;
  targetRestSeconds?: number;
};

export type RestTimerInput = {
  workoutId: string;
  setId?: string;
  targetRestSeconds: number;
};

export type CreateWorkoutInput = {
  scheduledFor?: string;
  templateId?: string;
  startingLoads?: Record<string, number>;
  defaultStartingLoad?: number;
};

export type ApplyDeloadInput = {
  exerciseId: string;
  percent?: number;
  reason?: string;
};

export type UserSettingsInput = {
  displayName?: string;
  unitSystem?: "metric" | "imperial";
};

export type WorkoutSetView = {
  id: string;
  setNumber: number;
  targetReps: number;
  completedReps: number;
  load: number;
  unit: LoadUnit;
  status: SetStatus;
  failureReason: string | null;
  notes: string | null;
};

export type WorkoutExerciseView = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
  plannedLoad: number;
  unit: LoadUnit;
  status: WorkoutExerciseStatus;
  sets: WorkoutSetView[];
};

export type WorkoutView = {
  id: string;
  status: WorkoutStatus;
  templateId: string | null;
  templateName: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  restStartedAt: string | null;
  targetRestSeconds: number | null;
  restSetId: string | null;
  notes: string | null;
  exercises: WorkoutExerciseView[];
};

export type ProgressionDecisionInput = {
  completedAllReps: boolean;
  currentLoad: number;
  increment: number;
  consecutiveFailures: number;
  failuresBeforeDeload: number;
  deloadPercent: number;
  unit: LoadUnit;
};

export type ProgressionDecision = {
  decision: ProgressionDecisionKind;
  fromLoad: number;
  toLoad: number;
  unit: LoadUnit;
  nextConsecutiveFailures: number;
  reason: string;
};

export type NextWorkoutPreview = {
  templateId: string;
  templateName: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    targetReps: number;
    plannedLoad: number;
    unit: LoadUnit;
  }>;
};

export type ChartDataPoint = {
  date: string;
  exerciseId: string;
  exerciseName: string;
  load: number;
  totalReps: number;
  volume: number;
  unit: LoadUnit;
};
