# Database ER Diagram

This diagram shows the proposed Supabase/Postgres storage model. Unlike the domain ER diagram, this one is table-oriented and includes user ownership, reference data, current state, historical workout facts, and explainable training events.

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : owns
  AUTH_USERS ||--o{ PROGRAM_ENROLLMENTS : owns
  AUTH_USERS ||--o{ EXERCISE_TRAINING_STATES : owns
  AUTH_USERS ||--o{ WORKOUT_SESSIONS : owns
  AUTH_USERS ||--o{ WORKOUT_EXERCISES : owns
  AUTH_USERS ||--o{ WORKOUT_SETS : owns
  AUTH_USERS ||--o{ FAILURE_EVENTS : owns
  AUTH_USERS ||--o{ DELOAD_EVENTS : owns
  AUTH_USERS ||--o{ PROGRESSION_DECISIONS : owns

  PROGRAMS ||--o{ PROGRAM_EXERCISES : configures
  EXERCISES ||--o{ PROGRAM_EXERCISES : configured_for

  PROGRAMS ||--o{ WORKOUT_TEMPLATES : defines
  WORKOUT_TEMPLATES ||--o{ WORKOUT_TEMPLATE_EXERCISES : contains
  EXERCISES ||--o{ WORKOUT_TEMPLATE_EXERCISES : appears_in

  PROGRAMS ||--o{ PROGRAM_ENROLLMENTS : selected_by
  WORKOUT_TEMPLATES ||--o{ PROGRAM_ENROLLMENTS : next_template

  PROGRAM_ENROLLMENTS ||--o{ EXERCISE_TRAINING_STATES : tracks
  EXERCISES ||--o{ EXERCISE_TRAINING_STATES : state_for
  PROGRESSION_DECISIONS ||--o{ EXERCISE_TRAINING_STATES : latest_decision

  PROGRAM_ENROLLMENTS ||--o{ WORKOUT_SESSIONS : contains
  WORKOUT_TEMPLATES ||--o{ WORKOUT_SESSIONS : instantiated_as

  WORKOUT_SESSIONS ||--o{ WORKOUT_EXERCISES : contains
  EXERCISES ||--o{ WORKOUT_EXERCISES : performed_as
  WORKOUT_EXERCISES ||--o{ WORKOUT_SETS : contains

  PROGRAM_ENROLLMENTS ||--o{ FAILURE_EVENTS : records
  WORKOUT_EXERCISES ||--o{ FAILURE_EVENTS : creates
  EXERCISES ||--o{ FAILURE_EVENTS : failure_for

  PROGRAM_ENROLLMENTS ||--o{ DELOAD_EVENTS : records
  EXERCISES ||--o{ DELOAD_EVENTS : deload_for

  PROGRAM_ENROLLMENTS ||--o{ PROGRESSION_DECISIONS : records
  WORKOUT_EXERCISES ||--o{ PROGRESSION_DECISIONS : evaluated_from
  EXERCISES ||--o{ PROGRESSION_DECISIONS : decision_for

  AUTH_USERS {
    uuid id PK
  }

  PROFILES {
    uuid user_id PK,FK
    text display_name
    text unit_system
    timestamptz created_at
    timestamptz updated_at
  }

  PROGRAMS {
    uuid id PK
    text slug UK
    text name
    text description
    boolean is_system
    timestamptz created_at
    timestamptz updated_at
  }

  EXERCISES {
    uuid id PK
    text slug UK
    text name
    text category
    text default_unit
    timestamptz created_at
    timestamptz updated_at
  }

  PROGRAM_EXERCISES {
    uuid id PK
    uuid program_id FK
    uuid exercise_id FK
    int default_sets
    int default_reps
    numeric increment
    numeric deload_percent
    int failures_before_deload
    timestamptz created_at
    timestamptz updated_at
  }

  WORKOUT_TEMPLATES {
    uuid id PK
    uuid program_id FK
    text code
    text name
    int sort_order
    timestamptz created_at
    timestamptz updated_at
  }

  WORKOUT_TEMPLATE_EXERCISES {
    uuid id PK
    uuid workout_template_id FK
    uuid exercise_id FK
    int sort_order
    int target_sets
    int target_reps
    timestamptz created_at
    timestamptz updated_at
  }

  PROGRAM_ENROLLMENTS {
    uuid id PK
    uuid user_id FK
    uuid program_id FK
    text status
    date started_on
    date ended_on
    uuid next_template_id FK
    timestamptz created_at
    timestamptz updated_at
  }

  EXERCISE_TRAINING_STATES {
    uuid id PK
    uuid user_id FK
    uuid program_enrollment_id FK
    uuid exercise_id FK
    numeric current_load
    text unit
    int consecutive_failures
    uuid last_progression_decision_id FK
    timestamptz created_at
    timestamptz updated_at
  }

  WORKOUT_SESSIONS {
    uuid id PK
    uuid user_id FK
    uuid program_enrollment_id FK
    uuid workout_template_id FK
    text status
    date scheduled_for
    timestamptz started_at
    timestamptz completed_at
    text notes
    timestamptz created_at
    timestamptz updated_at
  }

  WORKOUT_EXERCISES {
    uuid id PK
    uuid user_id FK
    uuid workout_session_id FK
    uuid exercise_id FK
    int sort_order
    int target_sets
    int target_reps
    numeric planned_load
    text unit
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  WORKOUT_SETS {
    uuid id PK
    uuid user_id FK
    uuid workout_exercise_id FK
    int set_number
    int target_reps
    int completed_reps
    numeric load
    text unit
    text status
    text failure_reason
    text notes
    timestamptz created_at
    timestamptz updated_at
  }

  FAILURE_EVENTS {
    uuid id PK
    uuid user_id FK
    uuid program_enrollment_id FK
    uuid workout_exercise_id FK
    uuid exercise_id FK
    text reason
    timestamptz failed_at
    timestamptz created_at
  }

  DELOAD_EVENTS {
    uuid id PK
    uuid user_id FK
    uuid program_enrollment_id FK
    uuid exercise_id FK
    numeric from_load
    numeric to_load
    text unit
    text reason
    timestamptz created_at
  }

  PROGRESSION_DECISIONS {
    uuid id PK
    uuid user_id FK
    uuid program_enrollment_id FK
    uuid workout_exercise_id FK
    uuid exercise_id FK
    text decision
    numeric from_load
    numeric to_load
    text unit
    text reason
    timestamptz created_at
  }
```

## Storage Notes

- `AUTH_USERS` represents Supabase `auth.users`; app data should reference it but not duplicate authentication state.
- `PROGRAMS`, `EXERCISES`, workout templates, and program exercise rules are reference/configuration data.
- `PROGRAM_ENROLLMENTS` connects a user to a program and anchors their training history.
- `EXERCISE_TRAINING_STATES` is the current mutable state for next load and consecutive failures.
- `WORKOUT_SESSIONS`, `WORKOUT_EXERCISES`, and `WORKOUT_SETS` are immutable historical facts once a workout is completed.
- `FAILURE_EVENTS`, `DELOAD_EVENTS`, and `PROGRESSION_DECISIONS` preserve why the app changed or repeated a load.
- User-owned tables should have RLS policies using `auth.uid() = user_id`.
