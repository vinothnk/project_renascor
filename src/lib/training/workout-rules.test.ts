import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChartDataPoints,
  completedAllPrescribedReps,
  getExerciseStatusFromSets,
  getNextTemplateId,
  inferSetStatus,
} from "./workout-rules";

describe("workout template alternation", () => {
  const templates = [
    { id: "workout-a", sortOrder: 1 },
    { id: "workout-b", sortOrder: 2 },
  ];

  it("alternates from Workout A to Workout B", () => {
    assert.equal(getNextTemplateId(templates, "workout-a"), "workout-b");
  });

  it("wraps from Workout B back to Workout A", () => {
    assert.equal(getNextTemplateId(templates, "workout-b"), "workout-a");
  });

  it("uses sort order rather than input array order", () => {
    assert.equal(getNextTemplateId([...templates].reverse(), "workout-a"), "workout-b");
  });
});

describe("set and exercise result rules", () => {
  it("detects a failed set when completed reps are below target", () => {
    assert.equal(inferSetStatus(4, 5), "failed");
  });

  it("marks a set completed when reps meet the target", () => {
    assert.equal(inferSetStatus(5, 5), "completed");
  });

  it("honors an explicit set status", () => {
    assert.equal(inferSetStatus(5, 5, "skipped"), "skipped");
  });

  it("marks an exercise completed only when every set hits its target", () => {
    assert.equal(
      getExerciseStatusFromSets([
        { status: "completed", completedReps: 5, targetReps: 5 },
        { status: "completed", completedReps: 5, targetReps: 5 },
        { status: "completed", completedReps: 5, targetReps: 5 },
        { status: "completed", completedReps: 5, targetReps: 5 },
        { status: "completed", completedReps: 5, targetReps: 5 },
      ]),
      "completed",
    );
  });

  it("marks an exercise failed after all sets are finished and one misses", () => {
    assert.equal(
      getExerciseStatusFromSets([
        { status: "completed", completedReps: 5, targetReps: 5 },
        { status: "failed", completedReps: 3, targetReps: 5 },
      ]),
      "failed",
    );
  });

  it("keeps an exercise active while planned sets remain", () => {
    assert.equal(
      getExerciseStatusFromSets([
        { status: "completed", completedReps: 5, targetReps: 5 },
        { status: "planned", completedReps: 0, targetReps: 5 },
      ]),
      "active",
    );
  });

  it("requires all prescribed reps for progression success", () => {
    assert.equal(
      completedAllPrescribedReps([
        { status: "completed", completedReps: 5, targetReps: 5 },
        { status: "completed", completedReps: 4, targetReps: 5 },
      ]),
      false,
    );
  });
});

describe("chart data generation", () => {
  it("builds load, reps, and volume points from completed workout exercises", () => {
    assert.deepEqual(
      buildChartDataPoints("2026-07-18T08:30:00.000Z", [
        {
          exerciseId: "squat",
          exerciseName: "Squat",
          plannedLoad: 100,
          unit: "kg",
          sets: [
            { completedReps: 5 },
            { completedReps: 5 },
            { completedReps: 5 },
            { completedReps: 5 },
            { completedReps: 3 },
          ],
        },
      ]),
      [
        {
          date: "2026-07-18T08:30:00.000Z",
          exerciseId: "squat",
          exerciseName: "Squat",
          load: 100,
          totalReps: 23,
          volume: 2300,
          unit: "kg",
        },
      ],
    );
  });
});

describe("workout history edits", () => {
  it("recalculates progression after editing a completed workout", { todo: true });
  it("removes deleted workouts from chart data and history", { todo: true });
});
