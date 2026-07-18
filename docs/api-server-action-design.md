# API / Server Action Design

Screens should call server actions by user intent rather than writing directly to
Supabase tables. Each action returns `ActionResult<T>` so UI flows can show
validation or persistence failures without decoding Supabase errors.

## Operations

| Operation | Server action | Primary writes |
| --- | --- | --- |
| Create workout | `createWorkout(input)` | `workout_sessions`, `workout_exercises`, `workout_sets` |
| Start workout session | `startWorkoutSession(workoutId)` | `workout_sessions.started_at`, `status` |
| Update set result | `updateSetResult(input)` | `workout_sets`, derived `workout_exercises.status` |
| Complete workout | `completeWorkout(workoutId)` | `workout_sessions`, progression/failure/deload events, training states |
| Calculate next workout | `calculateNextWorkout()` | None |
| Apply progression | `applyProgression(workoutExerciseId)` | `progression_decisions`, `failure_events`, `deload_events`, `exercise_training_states` |
| Apply deload | `applyDeload(input)` | `deload_events`, `exercise_training_states` |
| Fetch history | `fetchHistory(limit)` | None |
| Fetch chart data | `fetchChartData()` | None |
| Update user settings | `updateUserSettings(input)` | `profiles` |

## Design Notes

- `createWorkout` materializes planned exercises and sets from the current
  training state. Future state changes never rewrite historical set loads.
- `completeWorkout` applies progression per workout exercise, records explicit
  events, then advances the enrollment to the next workout template.
- `calculateNextWorkout`, `fetchHistory`, and `fetchChartData` are read-only.
- All actions use the authenticated Supabase server client and rely on RLS for
  ownership checks.
