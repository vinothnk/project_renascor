import type { ProgressionDecision, ProgressionDecisionInput } from "./types";

function roundToNearestHalf(load: number) {
  return Math.max(0, Math.round(load * 2) / 2);
}

export function calculateProgressionDecision(
  input: ProgressionDecisionInput,
): ProgressionDecision {
  if (input.completedAllReps) {
    const toLoad = roundToNearestHalf(input.currentLoad + input.increment);

    return {
      decision: "increase",
      fromLoad: input.currentLoad,
      toLoad,
      unit: input.unit,
      nextConsecutiveFailures: 0,
      reason: `Completed all prescribed reps; increase by ${input.increment} ${input.unit}.`,
    };
  }

  const nextFailures = input.consecutiveFailures + 1;

  if (nextFailures >= input.failuresBeforeDeload) {
    const toLoad = roundToNearestHalf(
      input.currentLoad * (1 - input.deloadPercent / 100),
    );

    return {
      decision: "deload",
      fromLoad: input.currentLoad,
      toLoad,
      unit: input.unit,
      nextConsecutiveFailures: 0,
      reason: `Failed ${nextFailures} times; deload by ${input.deloadPercent}%.`,
    };
  }

  return {
    decision: "repeat",
    fromLoad: input.currentLoad,
    toLoad: input.currentLoad,
    unit: input.unit,
    nextConsecutiveFailures: nextFailures,
    reason: `Missed prescribed reps; repeat ${input.currentLoad} ${input.unit}.`,
  };
}
