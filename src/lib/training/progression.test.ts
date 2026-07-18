import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateProgressionDecision } from "./progression";

describe("calculateProgressionDecision", () => {
  it("increases load after a successful 5x5 workout", () => {
    const decision = calculateProgressionDecision({
      completedAllReps: true,
      currentLoad: 100,
      increment: 2.5,
      consecutiveFailures: 2,
      failuresBeforeDeload: 3,
      deloadPercent: 10,
      unit: "kg",
    });

    assert.equal(decision.decision, "increase");
    assert.equal(decision.fromLoad, 100);
    assert.equal(decision.toLoad, 102.5);
    assert.equal(decision.nextConsecutiveFailures, 0);
  });

  it("tracks a failed workout without deloading before the threshold", () => {
    const decision = calculateProgressionDecision({
      completedAllReps: false,
      currentLoad: 100,
      increment: 2.5,
      consecutiveFailures: 1,
      failuresBeforeDeload: 3,
      deloadPercent: 10,
      unit: "kg",
    });

    assert.equal(decision.decision, "repeat");
    assert.equal(decision.toLoad, 100);
    assert.equal(decision.nextConsecutiveFailures, 2);
  });

  it("deloads and resets consecutive failures at the failure threshold", () => {
    const decision = calculateProgressionDecision({
      completedAllReps: false,
      currentLoad: 97.5,
      increment: 2.5,
      consecutiveFailures: 2,
      failuresBeforeDeload: 3,
      deloadPercent: 10,
      unit: "kg",
    });

    assert.equal(decision.decision, "deload");
    assert.equal(decision.fromLoad, 97.5);
    assert.equal(decision.toLoad, 88);
    assert.equal(decision.nextConsecutiveFailures, 0);
  });

  it("rounds progression targets to the nearest half unit", () => {
    const decision = calculateProgressionDecision({
      completedAllReps: true,
      currentLoad: 44.8,
      increment: 2.5,
      consecutiveFailures: 0,
      failuresBeforeDeload: 3,
      deloadPercent: 10,
      unit: "kg",
    });

    assert.equal(decision.toLoad, 47.5);
  });
});
