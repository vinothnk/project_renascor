import { redirect } from "next/navigation";
import { fetchAssistanceLibrary } from "@/app/assist/actions";
import {
  calculateNextWorkout,
  fetchChartData,
  fetchHistory,
  fetchOpenWorkout,
  fetchWorkingWeights,
} from "@/app/workouts/actions";
import { TrainingApp } from "@/app/dashboard/training-app";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login?message=Log in to view the dashboard.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? claimsData.claims.email ?? "Signed in";
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, unit_system")
    .eq("user_id", userData.user?.id ?? claimsData.claims.sub)
    .maybeSingle<{ display_name: string | null; unit_system: "metric" | "imperial" }>();
  const [
    openWorkoutResult,
    nextWorkoutResult,
    historyResult,
    chartResult,
    assistanceResult,
    workingWeightsResult,
  ] =
    await Promise.all([
      fetchOpenWorkout(),
      calculateNextWorkout(),
      fetchHistory(20),
      fetchChartData(),
      fetchAssistanceLibrary(),
      fetchWorkingWeights(),
    ]);
  const history = historyResult.ok ? historyResult.data : [];
  const errors = [
    openWorkoutResult.ok ? null : openWorkoutResult.error,
    nextWorkoutResult.ok ? null : nextWorkoutResult.error,
    historyResult.ok ? null : historyResult.error,
    chartResult.ok ? null : chartResult.error,
    assistanceResult.ok ? null : assistanceResult.error,
    workingWeightsResult.ok ? null : workingWeightsResult.error,
  ].filter((error): error is string => Boolean(error));
  const workoutsForDataPanel = history.map((workout) => ({
    id: workout.id,
    templateName: workout.templateName ?? "Workout",
    status: workout.status,
    completedAt: workout.completedAt,
    startedAt: workout.startedAt,
    exerciseCount: workout.exercises.length,
  }));

  return (
    <TrainingApp
      email={email}
      profile={{
        displayName: profile?.display_name ?? null,
        unitSystem: profile?.unit_system ?? "metric",
      }}
      openWorkout={openWorkoutResult.ok ? openWorkoutResult.data : null}
      nextWorkout={nextWorkoutResult.ok ? nextWorkoutResult.data : null}
      history={history}
      chartData={chartResult.ok ? chartResult.data : []}
      workingWeights={workingWeightsResult.ok ? workingWeightsResult.data : []}
      assistanceLibrary={
        assistanceResult.ok
          ? assistanceResult.data
          : { exercises: [], templates: [] }
      }
      workoutsForDataPanel={workoutsForDataPanel}
      errors={errors}
    />
  );
}
