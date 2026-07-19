"use client";

import { useTransition, useState } from "react";
import {
  deleteAccountAndAppData,
  deleteAllTrainingData,
  deleteWorkoutSession,
  exportMyData,
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

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={runExport}
          disabled={isPending}
          className="border border-[#171512] px-4 py-3 text-sm font-semibold transition hover:bg-[#171512] hover:text-[#f7f5ef] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Export JSON
        </button>
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
