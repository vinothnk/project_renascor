# Domain ER Diagram

This diagram shows the domain model relationships. It is intentionally more conceptual than the database schema: domain entities describe how the app thinks, not necessarily how rows are stored.

```mermaid
erDiagram
  ATHLETE ||--o{ PROGRAM_ENROLLMENT : enrolls_in
  PROGRAM ||--o{ PROGRAM_ENROLLMENT : has
  PROGRAM ||--o{ WORKOUT_TEMPLATE : defines
  PROGRAM ||--o{ PROGRAM_EXERCISE_RULE : configures
  EXERCISE ||--o{ PROGRAM_EXERCISE_RULE : receives_rules

  WORKOUT_TEMPLATE ||--o{ TEMPLATE_EXERCISE : includes
  EXERCISE ||--o{ TEMPLATE_EXERCISE : appears_as

  PROGRAM_ENROLLMENT ||--o{ EXERCISE_TRAINING_STATE : tracks
  EXERCISE ||--o{ EXERCISE_TRAINING_STATE : has_state

  PROGRAM_ENROLLMENT ||--o{ WORKOUT_SESSION : schedules
  WORKOUT_TEMPLATE ||--o{ WORKOUT_SESSION : instantiates

  WORKOUT_SESSION ||--o{ EXERCISE_PERFORMANCE : contains
  EXERCISE ||--o{ EXERCISE_PERFORMANCE : performed_as
  EXERCISE_PERFORMANCE ||--o{ SET_PERFORMANCE : contains

  EXERCISE_PERFORMANCE ||--o| FAILURE_EVENT : may_create
  EXERCISE_PERFORMANCE ||--o| PROGRESSION_DECISION : evaluated_by
  FAILURE_EVENT ||--o| DELOAD_EVENT : may_trigger
  PROGRESSION_DECISION ||--o| DELOAD_EVENT : may_create
  PROGRESSION_DECISION ||--o| EXERCISE_TRAINING_STATE : updates

  ATHLETE {
    uuid id
    string displayName
    string unitSystem
  }

  PROGRAM {
    uuid id
    string name
    string progressionPolicy
  }

  PROGRAM_ENROLLMENT {
    uuid id
    string status
    date startedOn
    date endedOn
  }

  EXERCISE {
    uuid id
    string name
    string category
    string defaultUnit
  }

  PROGRAM_EXERCISE_RULE {
    uuid id
    int defaultSets
    int defaultReps
    decimal increment
    decimal deloadPercent
    int failuresBeforeDeload
  }

  WORKOUT_TEMPLATE {
    uuid id
    string code
    string name
    int sortOrder
  }

  TEMPLATE_EXERCISE {
    uuid id
    int sortOrder
    int targetSets
    int targetReps
  }

  EXERCISE_TRAINING_STATE {
    uuid id
    decimal currentLoad
    string unit
    int consecutiveFailures
  }

  WORKOUT_SESSION {
    uuid id
    string status
    date scheduledFor
    datetime startedAt
    datetime completedAt
  }

  EXERCISE_PERFORMANCE {
    uuid id
    int targetSets
    int targetReps
    decimal plannedLoad
    string status
  }

  SET_PERFORMANCE {
    uuid id
    int setNumber
    int targetReps
    int completedReps
    decimal load
    string status
  }

  FAILURE_EVENT {
    uuid id
    string reason
    datetime failedAt
  }

  DELOAD_EVENT {
    uuid id
    decimal fromLoad
    decimal toLoad
    string reason
  }

  PROGRESSION_DECISION {
    uuid id
    string decision
    decimal fromLoad
    decimal toLoad
    string reason
  }
```

## Reading Notes

- `ExerciseTrainingState` is current state, while workout/session/set entities are history.
- `ProgressionDecision`, `FailureEvent`, and `DeloadEvent` are explicit domain events so the app can explain why a weight changed.
- `WorkoutTemplate` describes the intended pattern; `WorkoutSession` records an actual occurrence.
- `ExercisePerformance` summarizes a movement inside a workout; `SetPerformance` records the atomic result.
