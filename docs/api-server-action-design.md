# API / Server Action Design

Screens should call server actions by user intent rather than writing directly to
Supabase tables. Each action returns `ActionResult<T>` so UI flows can show
validation or persistence failures without decoding Supabase errors.

## Operations

| Operation | Server action | Primary writes |
| --- | --- | --- |
| Create workout | `createWorkout(input)` | `workout_sessions`, `workout_exercises`, `workout_sets` |
| Start workout session | `startWorkoutSession(workoutId)` | `workout_sessions.started_at`, `status` |
| Fetch open workout | `fetchOpenWorkout()` | None |
| Pause workout session | `pauseWorkoutSession(workoutId)` | `workout_sessions.status`, pause/timer fields |
| Discard workout session | `discardWorkoutSession(workoutId)` | `workout_sessions.status`, pause/timer fields |
| Update set result | `updateSetResult(input)` | `workout_sets`, derived `workout_exercises.status` |
| Start rest timer | `startRestTimer(input)` | `workout_sessions.rest_started_at`, `target_rest_seconds`, `rest_set_id` |
| Clear rest timer | `clearRestTimer(workoutId)` | Rest timer fields |
| Complete workout | `completeWorkout(workoutId)` | `workout_sessions`, progression/failure/deload events, training states |
| Calculate next workout | `calculateNextWorkout()` | None |
| Apply progression | `applyProgression(workoutExerciseId)` | `progression_decisions`, `failure_events`, `deload_events`, `exercise_training_states` |
| Apply deload | `applyDeload(input)` | `deload_events`, `exercise_training_states` |
| Fetch history | `fetchHistory(limit)` | None |
| Fetch chart data | `fetchChartData()` | None |
| Update user settings | `updateUserSettings(input)` | `profiles` |

## Design Notes

- V1 workout logging is set-by-set draft persistence. `createWorkout` returns
  an existing open workout when one exists; otherwise it creates an
  `in_progress` workout and materializes exercises and sets from the current
  training state. Future state changes never rewrite historical set loads.
- `updateSetResult` is the autosave boundary for workout logging. Once a set is
  saved, it is durable even if the browser closes.
- Pausing is represented by `workout_sessions.status = 'paused'`; resuming moves
  the same workout back to `in_progress`.
- Rest timers are timestamp-derived from `rest_started_at` and
  `target_rest_seconds`, so countdown state survives navigation and refresh.
- `completeWorkout` applies progression per workout exercise, records explicit
  events, clears pause/rest fields, then advances the enrollment to the next
  workout template.
- `calculateNextWorkout`, `fetchHistory`, and `fetchChartData` are read-only.
- All actions use the authenticated Supabase server client and rely on RLS for
  ownership checks.
- V1 does not include offline queueing or conflict resolution. Brief browser or
  navigation interruptions are handled by persisted server state.
