"use client";

import { useMemo, useState, useTransition } from "react";
import { logOut } from "@/app/auth/actions";
import {
  calculateNextWorkout,
  clearRestTimer,
  completeWorkout,
  createWorkout,
  discardWorkoutSession,
  pauseWorkoutSession,
  startWorkoutSession,
  updateSetResult,
  updateUserSettings,
} from "@/app/workouts/actions";
import { DataOwnershipPanel } from "@/app/dashboard/data-ownership-panel";
import type {
  ChartDataPoint,
  NextWorkoutPreview,
  WorkoutSetView,
  WorkoutView,
} from "@/lib/training/types";

type WorkoutSummary = {
  id: string;
  templateName: string;
  status: string;
  completedAt: string | null;
  startedAt: string | null;
  exerciseCount: number;
};

type Profile = {
  displayName: string | null;
  unitSystem: "metric" | "imperial";
};

type TrainingAppProps = {
  email: string;
  profile: Profile;
  openWorkout: WorkoutView | null;
  nextWorkout: NextWorkoutPreview | null;
  history: WorkoutView[];
  chartData: ChartDataPoint[];
  workoutsForDataPanel: WorkoutSummary[];
  errors: string[];
};

type Tab =
  | "dashboard"
  | "workout"
  | "weights"
  | "assist"
  | "history"
  | "charts"
  | "weight"
  | "notes"
  | "settings";

type NavItem = {
  tab: Tab;
  label: string;
  icon: "home" | "workout" | "gauge" | "spark" | "history" | "chart" | "scale" | "note" | "settings";
};

type KpiKey = "lastWorkout" | "workoutsDone" | "trackedLifts" | "personalRecords";

const navItems: NavItem[] = [
  { tab: "dashboard", label: "Dashboard", icon: "home" },
  { tab: "workout", label: "Workout", icon: "workout" },
  { tab: "weights", label: "Weights", icon: "gauge" },
  { tab: "assist", label: "Assist", icon: "spark" },
  { tab: "history", label: "History", icon: "history" },
  { tab: "charts", label: "Analytics", icon: "chart" },
  { tab: "weight", label: "Weight", icon: "scale" },
  { tab: "notes", label: "Notes", icon: "note" },
  { tab: "settings", label: "Settings", icon: "settings" },
];

function formatDate(value: string | null) {
  if (!value) return "Not finished";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string | null) {
  if (!value) return "None";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
  }).format(new Date(value));
}

function completedCount(workout: WorkoutView) {
  return workout.exercises
    .flatMap((exercise) => exercise.sets)
    .filter((set) => set.status !== "planned").length;
}

function totalSetCount(workout: WorkoutView) {
  return workout.exercises.flatMap((exercise) => exercise.sets).length;
}

function nextPlannedSet(workout: WorkoutView) {
  return workout.exercises
    .flatMap((exercise) =>
      exercise.sets.map((set) => ({ exerciseName: exercise.exerciseName, set })),
    )
    .find(({ set }) => set.status === "planned");
}

function restRemaining(workout: WorkoutView) {
  if (!workout.restStartedAt || !workout.targetRestSeconds) return null;
  const elapsed = Math.floor(
    (Date.now() - new Date(workout.restStartedAt).getTime()) / 1000,
  );
  return Math.max(0, workout.targetRestSeconds - elapsed);
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function MiniLineChart({ points }: { points: ChartDataPoint[] }) {
  if (points.length === 0) {
    return <div className="mini-empty">No data</div>;
  }

  const sorted = [...points].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
  const loads = sorted.map((point) => point.load);
  const min = Math.min(...loads);
  const max = Math.max(...loads);
  const range = Math.max(1, max - min);
  const path = sorted
    .map((point, index) => {
      const x = sorted.length === 1 ? 50 : (index / (sorted.length - 1)) * 100;
      const y = 90 - ((point.load - min) / range) * 70;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg className="mini-line" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="M0 20 H100 M0 45 H100 M0 70 H100 M0 95 H100" className="grid" />
      <path d={path} className="line" />
    </svg>
  );
}

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  const paths: Record<NavItem["icon"], React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
    workout: <path d="m6 8 3 8 3-8 3 8 3-8M4 12h16" />,
    gauge: <path d="M5 16a7 7 0 1 1 14 0M12 16l4-5" />,
    spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
    history: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 5v5h5M12 8v5l3 2" />,
    chart: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />,
    scale: <path d="M12 4v16M6 7h12M7 7l-4 7h8zm10 0-4 7h8z" />,
    note: <path d="M6 4h9l3 3v13H6zM15 4v4h4M9 12h6M9 16h6" />,
    settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v3m0 12v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="nav-icon">
      {paths[icon]}
    </svg>
  );
}

function SetRow({
  set,
  onComplete,
  onMiss,
  disabled,
}: {
  set: WorkoutSetView;
  onComplete: () => void;
  onMiss: (reps: number) => void;
  disabled: boolean;
}) {
  const missedOptions = Array.from({ length: set.targetReps }, (_, index) => index);

  return (
    <div className={`set-row set-${set.status}`}>
      <div>
        <strong>Set {set.setNumber}</strong>
        <span>
          {set.completedReps || set.targetReps}/{set.targetReps} reps at{" "}
          {set.load} {set.unit}
        </span>
      </div>
      <div className="set-actions">
        <button disabled={disabled} onClick={onComplete}>
          Done
        </button>
        <select
          aria-label={`Missed reps for set ${set.setNumber}`}
          disabled={disabled}
          defaultValue=""
          onChange={(event) => {
            if (event.target.value !== "") onMiss(Number(event.target.value));
            event.currentTarget.value = "";
          }}
        >
          <option value="">Missed</option>
          {missedOptions.map((reps) => (
            <option key={reps} value={reps}>
              {reps} reps
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function TrainingApp(props: TrainingAppProps) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedKpi, setSelectedKpi] = useState<KpiKey>("lastWorkout");
  const [workout, setWorkout] = useState(props.openWorkout);
  const [profile, setProfile] = useState(props.profile);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeWorkout = workout ?? props.openWorkout;
  const history = useMemo(
    () =>
      activeWorkout
        ? [activeWorkout, ...props.history.filter((item) => item.id !== activeWorkout.id)]
        : props.history,
    [activeWorkout, props.history],
  );

  const chartExercises = Array.from(
    new Set(props.chartData.map((point) => point.exerciseName)),
  );
  const completedHistory = history.filter((item) => item.status === "completed");
  const lastCompleted = completedHistory
    .filter((item) => item.completedAt)
    .sort(
      (left, right) =>
        new Date(right.completedAt ?? 0).getTime() -
        new Date(left.completedAt ?? 0).getTime(),
    )[0];
  const personalRecords = chartExercises
    .map((exerciseName) => {
      const points = props.chartData.filter((point) => point.exerciseName === exerciseName);
      const best = points.reduce<ChartDataPoint | null>(
        (record, point) => (!record || point.load > record.load ? point : record),
        null,
      );

      return best;
    })
    .filter((point): point is ChartDataPoint => Boolean(point))
    .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName));
  const kpiDetails: Record<KpiKey, { title: string; body: string; rows: Array<[string, string]> }> = {
    lastWorkout: {
      title: "Last workout",
      body: lastCompleted
        ? `${lastCompleted.templateName ?? "Workout"} finished on ${formatDate(lastCompleted.completedAt)}.`
        : "No completed workout has been logged yet.",
      rows: lastCompleted
        ? lastCompleted.exercises.map((exercise) => [
            exercise.exerciseName,
            `${exercise.sets.map((set) => `${set.completedReps}/${set.targetReps}`).join(", ")} at ${exercise.plannedLoad} ${exercise.unit}`,
          ])
        : [["Next step", "Start or manually add your first workout."]],
    },
    workoutsDone: {
      title: "Workouts done",
      body: `${completedHistory.length} completed workouts are currently counted in history and analytics.`,
      rows: completedHistory.slice(0, 5).map((item) => [
        item.templateName ?? "Workout",
        formatShortDate(item.completedAt),
      ]),
    },
    trackedLifts: {
      title: "Tracked lifts",
      body: `${chartExercises.length} lifts have chart data from completed workouts.`,
      rows: chartExercises.map((exercise) => {
        const points = props.chartData.filter((point) => point.exerciseName === exercise);
        const latest = points[points.length - 1];
        return [exercise, latest ? `${latest.load} ${latest.unit}` : "No load"];
      }),
    },
    personalRecords: {
      title: "Personal records",
      body: `${personalRecords.length} current best training loads are available.`,
      rows: personalRecords.map((record) => [
        record.exerciseName,
        `${record.load} ${record.unit}`,
      ]),
    },
  };
  const kpis: Array<{ key: KpiKey; label: string; value: string; helper: string; icon: NavItem["icon"] }> = [
    {
      key: "lastWorkout",
      label: "Last workout",
      value: formatShortDate(lastCompleted?.completedAt ?? null),
      helper: lastCompleted?.templateName ?? "No completed sessions",
      icon: "history",
    },
    {
      key: "workoutsDone",
      label: "Workouts done",
      value: String(completedHistory.length),
      helper: "Completed sessions",
      icon: "workout",
    },
    {
      key: "trackedLifts",
      label: "Tracked lifts",
      value: String(chartExercises.length),
      helper: "With chart data",
      icon: "chart",
    },
    {
      key: "personalRecords",
      label: "Personal records",
      value: String(personalRecords.length),
      helper: "Best loads saved",
      icon: "spark",
    },
  ];
  const workoutFrequency = completedHistory.reduce<Record<string, number>>((months, item) => {
    if (!item.completedAt) {
      return months;
    }

    const date = new Date(item.completedAt);
    const key = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    months[key] = (months[key] ?? 0) + 1;
    return months;
  }, {});

  function runWorkoutAction(action: () => Promise<{ ok: true; data: WorkoutView } | { ok: false; error: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setWorkout(result.data);
      setMessage(result.ok ? "Saved." : result.error);
    });
  }

  function startWorkout() {
    runWorkoutAction(() => createWorkout({ defaultStartingLoad: 20 }));
    setTab("workout");
  }

  function saveSet(set: WorkoutSetView, completedReps: number) {
    runWorkoutAction(() =>
      updateSetResult({
        setId: set.id,
        completedReps,
        status: completedReps >= set.targetReps ? "completed" : "failed",
        failureReason:
          completedReps >= set.targetReps ? undefined : "Missed prescribed reps.",
        targetRestSeconds: 180,
      }),
    );
  }

  function finishWorkout() {
    if (!activeWorkout) return;
    runWorkoutAction(() => completeWorkout(activeWorkout.id));
  }

  function saveUnitSettings(formData: FormData) {
    setMessage(null);
    const unitSystem = String(formData.get("unitSystem")) as "metric" | "imperial";

    startTransition(async () => {
      const result = await updateUserSettings({ unitSystem });
      if (result.ok) {
        setProfile((current) => ({
          ...current,
          unitSystem: result.data.unitSystem ?? unitSystem,
        }));
      }
      setMessage(result.ok ? "Metric setting saved." : result.error);
    });
  }

  const planned = activeWorkout ? nextPlannedSet(activeWorkout) : null;
  const remainingRest = activeWorkout ? restRemaining(activeWorkout) : null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">5</span>
          <strong>StrongLifts</strong>
        </div>
        <nav className="sidebar-nav" aria-label="Application sections">
          {navItems.map((item) => (
            <button
              key={item.tab}
              className={tab === item.tab ? "active" : ""}
              onClick={() => setTab(item.tab)}
              type="button"
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <span>{props.email}</span>
          <form action={logOut}>
            <button type="submit">Log out</button>
          </form>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="brand">RENASCOR</p>
            <h1>{profile.displayName ? `${profile.displayName}'s training` : "Training dashboard"}</h1>
          </div>
        </header>

        {message ? <p className="notice">{message}</p> : null}
        {props.errors.map((error) => (
          <p className="notice error" key={error}>{error}</p>
        ))}

        {tab === "dashboard" ? (
          <section className="renascor-dashboard">
            <div className="dashboard-hero">
              <div>
                <p className="brand">TODAY</p>
                <h2>{activeWorkout?.templateName ?? props.nextWorkout?.templateName ?? "Workout A"}</h2>
                <p>
                  Next up: {props.nextWorkout?.templateName ?? "StrongLifts session"}.
                  {" "}
                  Last completed: {formatDate(lastCompleted?.completedAt ?? null)}.
                </p>
              </div>
              <button disabled={isPending} onClick={activeWorkout ? () => setTab("workout") : startWorkout}>
                {activeWorkout ? "Open workout" : "Start workout"}
              </button>
            </div>

            <div className="kpi-grid">
              {kpis.map((kpi) => (
                <button
                  type="button"
                  className={`kpi-card ${selectedKpi === kpi.key ? "active" : ""}`}
                  key={kpi.key}
                  onClick={() => setSelectedKpi(kpi.key)}
                >
                  <NavIcon icon={kpi.icon} />
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                  <small>{kpi.helper}</small>
                </button>
              ))}
            </div>

            <div className="metric-detail">
              <div>
                <p className="eyebrow">Metric detail</p>
                <h3>{kpiDetails[selectedKpi].title}</h3>
                <p>{kpiDetails[selectedKpi].body}</p>
              </div>
              <div className="metric-detail-list">
                {kpiDetails[selectedKpi].rows.length ? (
                  kpiDetails[selectedKpi].rows.map(([label, value]) => (
                    <div className="metric-row" key={`${label}-${value}`}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">No metric rows yet.</p>
                )}
              </div>
            </div>

            <div className="dashboard-panels">
              <section className="panel chart-panel weight-progress-panel">
                <h3>Weight progression</h3>
                <div className="mini-chart-grid">
                  {chartExercises.length ? chartExercises.map((exercise) => {
                    const points = props.chartData.filter((point) => point.exerciseName === exercise);
                    return (
                      <article className="mini-chart-card" key={exercise}>
                        <div>
                          <strong>{exercise}</strong>
                          <span>{points[points.length - 1]?.load ?? 0} {points[points.length - 1]?.unit ?? "kg"}</span>
                        </div>
                        <MiniLineChart points={points} />
                      </article>
                    );
                  }) : <p className="muted">Complete or import workouts to build lift charts.</p>}
                </div>
              </section>

              <section className="panel chart-panel frequency-panel">
                <h3>Workout frequency</h3>
                <div className="frequency-bars">
                  {Object.entries(workoutFrequency).length ? Object.entries(workoutFrequency).map(([month, count]) => (
                    <div key={month}>
                      <span style={{ height: `${Math.max(16, count * 42)}px` }} />
                      <small>{formatMonth(month)}</small>
                    </div>
                  )) : <p className="muted">No completed workouts yet.</p>}
                </div>
              </section>

              <section className="panel pr-panel">
                <h3>Personal records</h3>
                {personalRecords.length ? personalRecords.map((record) => (
                  <div className="pr-row" key={record.exerciseId}>
                    <div>
                      <strong>{record.exerciseName}</strong>
                      <span>{record.totalReps} total reps logged</span>
                    </div>
                    <strong>{record.load} {record.unit}</strong>
                  </div>
                )) : <p className="muted">Your best loads will appear here.</p>}
              </section>
            </div>
          </section>
        ) : null}

        {tab === "workout" ? (
          <section className="workout-layout">
          {activeWorkout ? (
            <>
              <div className="sticky-context">
                <div>
                  <p className="eyebrow">{activeWorkout.status}</p>
                  <h2>{activeWorkout.templateName ?? "Workout"}</h2>
                </div>
                {remainingRest !== null ? (
                  <button onClick={() => runWorkoutAction(() => clearRestTimer(activeWorkout.id))}>
                    Rest {formatSeconds(remainingRest)}
                  </button>
                ) : null}
              </div>
              {activeWorkout.exercises.map((exercise) => (
                <article className="exercise-card" key={exercise.id}>
                  <div className="exercise-head">
                    <h3>{exercise.exerciseName}</h3>
                    <span>{exercise.targetSets}x{exercise.targetReps} at {exercise.plannedLoad} {exercise.unit}</span>
                  </div>
                  {exercise.sets.map((set) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      disabled={isPending || activeWorkout.status === "completed"}
                      onComplete={() => saveSet(set, set.targetReps)}
                      onMiss={(reps) => saveSet(set, reps)}
                    />
                  ))}
                </article>
              ))}
              <div className="bottom-actions">
                <button disabled={isPending} onClick={() => runWorkoutAction(() => startWorkoutSession(activeWorkout.id))}>Resume</button>
                <button disabled={isPending} onClick={() => runWorkoutAction(() => pauseWorkoutSession(activeWorkout.id))}>Pause</button>
                <button disabled={isPending} onClick={finishWorkout}>Finish</button>
                <button disabled={isPending} className="danger" onClick={() => {
                  if (window.confirm("Discard this active workout? Progression will not be applied.")) {
                    runWorkoutAction(() => discardWorkoutSession(activeWorkout.id));
                  }
                }}>Discard</button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>No active workout</h2>
              <p>Start the next planned session when you are ready.</p>
              <button disabled={isPending} onClick={startWorkout}>Start workout</button>
            </div>
          )}
          </section>
        ) : null}

        {tab === "weights" ? (
          <section className="panel-list">
            <h2>Weights</h2>
            <div className="panel">
              <p className="muted">Your current training loads are shown in the next workout preview and imported history.</p>
              {props.nextWorkout?.exercises.map((exercise) => (
                <div className="metric-row" key={exercise.exerciseId}>
                  <span>{exercise.exerciseName}</span>
                  <strong>{exercise.plannedLoad} {exercise.unit}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "assist" ? (
          <section className="panel-list">
            <h2>Assist</h2>
            <div className="panel">
              <p className="muted">Training assistance will collect rest guidance, missed-rep context, and next-session suggestions here.</p>
            </div>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="panel-list">
          <h2>History</h2>
          {history.length ? history.map((item) => (
            <details className="history-detail" key={item.id}>
              <summary>
                <strong>{item.templateName ?? "Workout"}</strong>
                <span>{formatDate(item.completedAt ?? item.startedAt)} - {item.status}</span>
              </summary>
              {item.exercises.map((exercise) => (
                <div className="history-exercise" key={exercise.id}>
                  <strong>{exercise.exerciseName}</strong>
                  <span>{exercise.sets.map((set) => `${set.completedReps || 0}/${set.targetReps}`).join(", ")}</span>
                </div>
              ))}
            </details>
          )) : <p className="muted">No sessions yet.</p>}
          </section>
        ) : null}

        {tab === "charts" ? (
          <section className="panel-list">
          <h2>Charts</h2>
          {chartExercises.length ? chartExercises.map((exercise) => {
            const points = props.chartData.filter((point) => point.exerciseName === exercise);
            const max = Math.max(...points.map((point) => point.load), 1);
            return (
              <div className="chart-block" key={exercise}>
                <h3>{exercise}</h3>
                <div className="bars">
                  {points.map((point) => (
                    <span
                      key={`${point.date}-${point.load}`}
                      style={{ height: `${Math.max(12, (point.load / max) * 120)}px` }}
                      title={`${formatDate(point.date)}: ${point.load} ${point.unit}`}
                    />
                  ))}
                </div>
              </div>
            );
          }) : <p className="muted">Charts appear after completed workouts.</p>}
          <div className="panel">
            <h3>Workout Frequency</h3>
            {Object.entries(workoutFrequency).length ? Object.entries(workoutFrequency).map(([month, count]) => (
              <div className="metric-row" key={month}><span>{formatMonth(month)}</span><strong>{count}</strong></div>
            )) : <p className="muted">No completed weeks yet.</p>}
          </div>
          </section>
        ) : null}

        {tab === "weight" ? (
          <section className="panel-list">
            <h2>Body Weight</h2>
            <div className="panel">
              <p className="muted">Body-weight tracking is reserved here so it can sit beside barbell progress without crowding workout logging.</p>
            </div>
          </section>
        ) : null}

        {tab === "notes" ? (
          <section className="panel-list">
            <h2>Notes</h2>
            <div className="panel">
              <p className="muted">Workout notes entered during imports and manual history entry remain attached to their sessions.</p>
            </div>
          </section>
        ) : null}

        {tab === "settings" ? (
          <section className="settings-page">
            <form action={saveUnitSettings} className="settings-unit-panel">
              <div>
                <p className="eyebrow">Metric selection</p>
                <h2>Units</h2>
                <p className="muted">
                  Choose how future workout loads should be displayed.
                </p>
              </div>
              <label>
                Units
                <select name="unitSystem" defaultValue={profile.unitSystem}>
                  <option value="metric">Metric</option>
                  <option value="imperial">Imperial</option>
                </select>
              </label>
              <button disabled={isPending}>Save units</button>
            </form>
            <DataOwnershipPanel workouts={props.workoutsForDataPanel} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
