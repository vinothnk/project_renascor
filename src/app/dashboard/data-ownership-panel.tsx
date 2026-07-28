"use client";

import { useTransition, useState } from "react";
import {
  deleteAccountAndAppData,
  deleteAllTrainingData,
  deleteWorkoutSession,
  exportMyData,
  importWorkoutJson,
  type UserDataExport,
} from "@/app/data/actions";

type WorkoutSummary = {
  id: string;
  templateName: string;
  status: string;
  completedAt: string | null;
  startedAt: string | null;
  exerciseCount: number;
};

type DataOwnershipPanelProps = {
  workouts: WorkoutSummary[];
};

const workoutPresets = {
  a: ["Squat", "Bench Press", "Barbell Row"],
  b: ["Squat", "Overhead Press", "Deadlift"],
};

const liftOptions = [
  "Squat",
  "Bench Press",
  "Barbell Row",
  "Overhead Press",
  "Deadlift",
];

function downloadExport(data: UserDataExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = data.exportedAt.slice(0, 10);

  link.href = url;
  link.download = `project-renascor-export-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not completed";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DataOwnershipPanel({ workouts }: DataOwnershipPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [manualTemplate, setManualTemplate] = useState<"a" | "b" | "custom">("a");
  const [manualLifts, setManualLifts] = useState(workoutPresets.a);
  const [isPending, startTransition] = useTransition();

  function runExport() {
    setMessage(null);
    startTransition(async () => {
      const result = await exportMyData();

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      downloadExport(result.data);
      setMessage("Export downloaded as JSON.");
    });
  }

  function runImport(file: File | null) {
    if (!file) {
      return;
    }

    setMessage(null);
    const reader = new FileReader();

    reader.onload = () => {
      startTransition(async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const result = await importWorkoutJson(parsed);

          if (!result.ok) {
            setMessage(result.error);
            return;
          }

          const warningText =
            result.data.warnings.length > 0
              ? ` ${result.data.warnings.slice(0, 3).join(" ")}`
              : "";

          setMessage(
            `Imported ${result.data.importedWorkouts} workouts, ${result.data.importedExercises} exercises, and ${result.data.importedSets} sets.${warningText}`,
          );
        } catch {
          setMessage("That file is not valid JSON.");
        }
      });
    };

    reader.onerror = () => {
      setMessage("Could not read that file.");
    };

    reader.readAsText(file);
  }

  function setPreset(template: "a" | "b" | "custom") {
    setManualTemplate(template);

    if (template !== "custom") {
      setManualLifts(workoutPresets[template]);
    }
  }

  function updateManualLift(index: number, lift: string) {
    setManualTemplate("custom");
    setManualLifts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? lift : item)),
    );
  }

  function runManualImport(formData: FormData) {
    setMessage(null);
    const date = String(formData.get("manualDate") ?? "");
    const unit = String(formData.get("manualUnit") ?? "kg");
    const notes = String(formData.get("manualNotes") ?? "").trim();
    const exercises = manualLifts
      .map((lift, index) => {
        const load = Number(formData.get(`load-${index}`) ?? 0);
        const targetSets = Number(formData.get(`sets-${index}`) ?? 5);
        const targetReps = Number(formData.get(`reps-${index}`) ?? 5);
        const completed = String(formData.get(`completed-${index}`) ?? "")
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value));
        const setCount = Math.max(1, Math.trunc(targetSets || completed.length || 1));
        const completedReps =
          completed.length > 0 ? completed : Array(setCount).fill(targetReps || 5);

        return {
          exerciseName: lift,
          load,
          unit,
          targetSets: setCount,
          targetReps: Math.max(1, Math.trunc(targetReps || 5)),
          sets: Array.from({ length: setCount }, (_, setIndex) => ({
            setNumber: setIndex + 1,
            targetReps: Math.max(1, Math.trunc(targetReps || 5)),
            completedReps: Math.max(0, Math.trunc(completedReps[setIndex] ?? targetReps ?? 5)),
            load,
            unit,
          })),
        };
      })
      .filter((exercise) => exercise.exerciseName && exercise.load >= 0);

    if (!date) {
      setMessage("Choose the workout date before adding it.");
      return;
    }

    startTransition(async () => {
      const result = await importWorkoutJson({
        workouts: [
          {
            date,
            templateName:
              manualTemplate === "a"
                ? "Workout A"
                : manualTemplate === "b"
                  ? "Workout B"
                  : "Workout",
            notes: notes || null,
            exercises,
          },
        ],
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage(
        `Added ${result.data.importedWorkouts} old workout with ${result.data.importedSets} sets.`,
      );
    });
  }

  function runWorkoutDelete(workoutId: string) {
    if (!window.confirm("Delete this workout session and its set history?")) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteWorkoutSession(workoutId);
      setMessage(result.ok ? "Workout deleted." : result.error);
    });
  }

  function runTrainingDelete() {
    if (
      !window.confirm(
        "Delete all workout history, progression state, failures, and deload events while keeping your account?",
      )
    ) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteAllTrainingData();
      setMessage(result.ok ? "Training data deleted." : result.error);
    });
  }

  function runAccountDelete() {
    if (
      !window.confirm(
        "Delete your account and all app data? This requires server-side account deletion to be configured.",
      )
    ) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteAccountAndAppData();

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      window.location.assign("/login?message=Your account has been deleted.");
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a6f5d]">
          Data ownership
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Privacy controls</h2>
        <p className="mt-3 max-w-2xl leading-7 text-[#6b6256]">
          Export your account data, delete individual sessions, or remove your
          training history while keeping the account shell.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={runExport}
          disabled={isPending}
          className="border border-[#171512] px-4 py-3 text-sm font-semibold transition hover:bg-[#171512] hover:text-[#f7f5ef] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Export JSON
        </button>
        <label className="flex min-h-11 cursor-pointer items-center justify-center border border-[#171512] px-4 py-3 text-sm font-semibold text-[#171512] transition hover:bg-[#171512] hover:text-[#f7f5ef]">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={isPending}
            onChange={(event) => {
              runImport(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={runTrainingDelete}
          disabled={isPending}
          className="border border-[#9b3b2f] px-4 py-3 text-sm font-semibold text-[#9b3b2f] transition hover:bg-[#9b3b2f] hover:text-[#fffaf4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete training data
        </button>
        <button
          type="button"
          onClick={runAccountDelete}
          disabled={isPending}
          className="bg-[#171512] px-4 py-3 text-sm font-semibold text-[#f7f5ef] transition hover:bg-[#3a1712] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete account
        </button>
      </div>

      {message ? (
        <p className="border-y border-[#ddd4c3] py-3 text-sm text-[#6b6256]">
          {message}
        </p>
      ) : null}

      <form action={runManualImport} className="manual-entry">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a6f5d]">
            Manual entry
          </p>
          <h3 className="mt-3 text-lg font-semibold">Add an old workout</h3>
        </div>

        <div className="manual-grid">
          <label>
            Date
            <input name="manualDate" type="date" required />
          </label>
          <label>
            Template
            <select
              value={manualTemplate}
              onChange={(event) =>
                setPreset(event.currentTarget.value as "a" | "b" | "custom")
              }
            >
              <option value="a">Workout A</option>
              <option value="b">Workout B</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            Unit
            <select name="manualUnit" defaultValue="kg">
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
        </div>

        <div className="manual-lifts">
          {manualLifts.map((lift, index) => (
            <div className="manual-lift-row" key={index}>
              <label>
                Lift
                <select
                  value={lift}
                  onChange={(event) => updateManualLift(index, event.currentTarget.value)}
                >
                  {liftOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Load
                <input
                  name={`load-${index}`}
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={index === 2 && lift === "Deadlift" ? 40 : 20}
                  required
                />
              </label>
              <label>
                Sets
                <input
                  name={`sets-${index}`}
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={lift === "Deadlift" ? 1 : 5}
                  required
                />
              </label>
              <label>
                Reps
                <input
                  name={`reps-${index}`}
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="5"
                  required
                />
              </label>
              <label>
                Completed reps
                <input
                  name={`completed-${index}`}
                  placeholder={lift === "Deadlift" ? "5" : "5,5,5,5,5"}
                />
              </label>
            </div>
          ))}
        </div>

        <label>
          Notes
          <input name="manualNotes" placeholder="Optional notes from the old log" />
        </label>

        <button type="submit" disabled={isPending}>
          Add old workout
        </button>
      </form>

      <div>
        <h3 className="text-lg font-semibold">Recent sessions</h3>
        <div className="mt-4 divide-y divide-[#ddd4c3] border-y border-[#ddd4c3]">
          {workouts.length > 0 ? (
            workouts.map((workout) => (
              <div
                key={workout.id}
                className="grid gap-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold">
                    {workout.templateName} - {workout.status}
                  </p>
                  <p className="mt-1 text-sm text-[#6b6256]">
                    {formatDate(workout.completedAt ?? workout.startedAt)} -{" "}
                    {workout.exerciseCount} exercises
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runWorkoutDelete(workout.id)}
                  disabled={isPending}
                  className="border border-[#9b3b2f] px-3 py-2 text-sm font-semibold text-[#9b3b2f] transition hover:bg-[#9b3b2f] hover:text-[#fffaf4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <p className="py-4 text-sm text-[#6b6256]">
              No workout sessions yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
