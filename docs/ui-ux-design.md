# UI/UX Design

This document defines how Project Renascor should look, feel, and behave in
real use, especially on a phone during a workout.

## Design Principles

- Mobile-first: the workout flow is designed for a phone before desktop.
- Fast under fatigue: common workout actions should take one tap and little
  precision.
- Quiet confidence: the app should feel like a training dashboard, not a
  marketing page.
- Dense but readable: show useful training data without making screens feel
  crowded.
- Clear state over decoration: current workout, current exercise, current set,
  timer state, and save state must always be easy to understand.
- Neutral language: missed reps are training data, not moral failure.
- Recoverable actions: destructive or session-ending actions require clear
  confirmation.
- Durable progress: logged sets and active rest timers should survive refresh,
  navigation, and accidental app switching.

## Target Device Priority

| Priority | Device | Expectations |
| --- | --- | --- |
| 1 | Mobile phone | Primary experience. One-handed operation, large tap targets, sticky workout actions, minimal typing. |
| 2 | Small tablet | Same information architecture as mobile, with roomier spacing and side-by-side summary panels where helpful. |
| 3 | Desktop | Efficient review, settings, history, and chart exploration. Do not turn the app into a marketing layout after login. |

Minimum workout ergonomics:

- Primary set actions should be at least 48px tall.
- Critical buttons should be reachable near the lower half of the screen on
  mobile.
- The active workout screen should avoid horizontal scrolling.
- Numeric entry should use number inputs, steppers, segmented controls, or
  preset chips instead of free text whenever possible.

## Page Layouts

### Dashboard

Purpose: authenticated hub for the next useful training action.

Mobile layout:

- Top app bar with product name, account/settings entry, and optional sync
  state.
- Primary panel for active workout if one exists.
- Next workout preview when no active workout exists.
- Compact recent history list.
- Compact progress snapshot.
- Bottom navigation or persistent app navigation with Dashboard, Workout,
  History, Charts, and Settings.

Desktop layout:

- Constrained content width with a two-column dashboard grid.
- Primary workout panel should remain visually dominant.
- History and chart previews can sit beside or below the workout panel.

### Workout Session

Purpose: log the current workout with minimal friction.

Mobile layout:

- Sticky top context: workout name, elapsed state, current exercise.
- Current exercise block with target load, target sets/reps, and unit.
- Large set rows or buttons for each prescribed set.
- Sticky bottom action area for the next set, quick failure entry, and timer.
- Secondary actions such as pause, discard, and finish live in a menu or lower
  priority area.

Required visual emphasis:

- Current exercise is the strongest heading on the screen.
- Current set is obvious without reading the full page.
- Completed sets look settled.
- Failed or skipped sets are visible but not alarm-colored unless action is
  required.

### Workout Summary

Purpose: confirm what happened and explain what changes next.

Layout:

- Completion state at top with date, duration, and workout name.
- Exercise summary grouped by exercise.
- Progression decisions displayed as plain explanations: increased, repeated,
  or deloaded.
- Notes or failed-rep reasons shown as supporting detail.
- Primary action returns to dashboard or starts planning the next workout.

### History

Purpose: review completed workouts and inspect set-level detail.

Layout:

- Newest workouts first.
- Each session row shows date, template, duration/status, and top exercise
  outcomes.
- Expandable detail or detail route for set-level records.
- Delete is available but visually secondary and requires confirmation.

### Progress Charts

Purpose: make training trends readable.

Layout:

- Exercise selector near the top.
- Weight progression chart first.
- Workout frequency chart below or in a sibling tab.
- Empty state explains that charts appear after completed workouts.
- Chart labels must preserve units and dates.

### Settings

Purpose: manage profile, units, training preferences, and data ownership.

Layout:

- Group settings into Profile, Training, Data, and Account sections.
- Use compact forms with clear labels and saved/error states.
- Destructive data actions live in a separated danger area.
- Export/delete actions include consequences before confirmation.

### Auth Pages

Purpose: get users into the protected app clearly.

Layout:

- Simple centered form on mobile and desktop.
- Product name and concise context, not a full marketing page.
- Email/password labels remain visible.
- Auth errors are displayed near the form and avoid sensitive internals.

## Component Inventory

Core navigation:

- App shell
- Top app bar
- Mobile bottom navigation
- Tab navigation for dashboard sections when routes are consolidated
- Account/settings menu

Workout components:

- Workout status banner
- Current exercise header
- Set logging row
- One-tap complete button
- Failed-rep quick entry
- Rest timer
- Pause/resume control
- Finish workout confirmation
- Discard workout confirmation

Data components:

- Next workout preview
- Recent workout list
- Workout detail accordion
- Progression explanation row
- Empty state
- Error callout
- Loading skeleton
- Chart container
- Exercise selector

Form components:

- Text field
- Number input
- Stepper
- Segmented control
- Select/menu
- Checkbox/toggle
- Submit button
- Inline field error
- Form-level error
- Success toast or saved indicator

Feedback components:

- Toast
- Modal dialog
- Alert dialog for destructive actions
- Inline save indicator
- Section-level retry panel

## Interaction States

Every interactive control should define:

- Default
- Hover where supported
- Pressed
- Focus-visible
- Disabled
- Loading/pending
- Success, when a mutation completes
- Error, when a mutation fails

Workout-specific states:

- Set pending
- Set saving
- Set completed
- Set failed with completed reps
- Set skipped
- Set save failed with retry
- Rest timer active
- Rest timer paused or cleared
- Workout paused
- Workout ready to finish
- Workout blocked from finishing because unresolved sets remain

## Form Behavior

- Prefer selection controls over typing.
- Use mobile numeric keyboards for load, reps, and timer values.
- Keep labels visible; placeholders are examples, not labels.
- Validate on submit and, where helpful, after field blur.
- Preserve user-entered values after errors.
- Disable submit only while the request is pending or the form is invalid.
- Show save state close to the changed control for settings that autosave.
- Unit labels should be visible beside load inputs.
- Destructive forms require confirmation and should not be mixed with routine
  preference editing.

## Confirmation Patterns

Use confirmation for:

- Finish workout when unresolved sets remain.
- Discard active workout.
- Delete completed workout.
- Delete training data.
- Delete account and app data.

Confirmation dialogs should include:

- Plain-language consequence.
- Object being affected, such as workout date or account email.
- Primary destructive action with specific label.
- Cancel action that is easy to find.

Do not use confirmation for ordinary one-tap set completion. Instead, make the
set state easy to undo or edit.

## Error Handling

Error copy should be calm, specific, and actionable.

Patterns:

- Section errors should not blank the entire dashboard when other sections can
  still render.
- Failed set saves should remain visible on the affected row with a retry
  action.
- Auth errors should not reveal sensitive system details.
- RLS or permission failures should say the data could not be accessed and
  prompt the user to sign in again if appropriate.
- Network errors during workout logging should preserve local UI state until
  the user retries or refreshes.
- Empty data is not an error.

Avoid language such as "failed workout" as a judgment. Use precise labels such
as "missed reps", "repeat weight next time", or "set not completed".

## Loading And Skeleton States

- Use section-level skeletons on Dashboard, History, Charts, and Settings.
- On Workout Session, keep already-loaded workout data visible while individual
  set mutations are pending.
- Use button-level spinners or disabled text for mutation states.
- Avoid full-screen loading after the workout has started unless auth/session
  state is unknown.
- Skeletons should match the approximate final layout to prevent large layout
  shifts.

## Accessibility Expectations

- All interactive elements must be keyboard reachable.
- Use visible focus states with strong contrast.
- Form fields require programmatic labels.
- Icon-only buttons require accessible names and tooltips where helpful.
- Color cannot be the only signal for complete, failed, skipped, or error
  states.
- Tap targets should be at least 44px, with 48px preferred in workout logging.
- Dialogs must trap focus and restore focus to the triggering control.
- Timers should expose readable text, not only animated visuals.
- Respect reduced motion preferences.
- Maintain strong contrast for text, controls, charts, and status indicators.

## Mobile-First Workout Ergonomics

The workout session is the most important mobile surface.

Rules:

- One-tap completion is the default path.
- Failed-rep entry should require no more than two taps for common cases.
- The active set action should sit near thumb reach.
- Rest timer should remain visible or quickly reachable after every set.
- Timer state must survive refresh and navigation by deriving from persisted
  timestamps.
- Finishing and discarding should never be adjacent to set completion in a way
  that invites accidental taps.
- Notes are optional and secondary.
- Keyboard opening should not hide the active action without a way to continue.
- The screen should be usable in short glances between sets.

Suggested failed-rep flow:

1. User taps a set's missed-reps control.
2. A compact picker shows completed reps from 0 to target reps minus 1.
3. Optional note/reason is available but not required.
4. Saving starts the rest timer and updates the set state.

## Visual Hierarchy

Hierarchy from strongest to weakest:

1. Current workout action or current exercise.
2. Current set and rest timer.
3. Target load, sets, reps, and progression impact.
4. Secondary workout actions.
5. Historical or explanatory details.

Dashboard hierarchy:

- Active workout beats next workout.
- Next workout beats history.
- History beats chart previews.
- Settings and data ownership are available but not visually dominant.

## Color, Type, And Spacing Rules

Color:

- Use a restrained neutral base with strong text contrast.
- Use one primary action color consistently.
- Use success, warning, and danger colors sparingly and semantically.
- Failed-rep states should be clear without looking punitive.
- Avoid decorative gradients, oversized hero treatments, and marketing-style
  panels inside authenticated app screens.

Type:

- Use a readable sans-serif system or configured app font.
- Avoid viewport-based font scaling.
- Use compact headings inside dashboard panels.
- Reserve large display type for public/auth entry moments only.
- Numeric workout values should be easy to scan.

Spacing:

- Use an 8px spacing rhythm.
- Prefer compact vertical spacing in repeated workout rows.
- Preserve enough spacing around primary workout actions to prevent mistaps.
- Avoid nested cards; use cards for repeated items, dialogs, and framed tools
  only.
- Use full-width sections or unframed layouts for major page regions.

## Reusable UI Patterns

### Primary Action Panel

Used for active workout and next workout. Contains the key state, the next
action, and a small amount of supporting detail.

### Section Header With Action

Used across dashboard sections. Title on the left, small action or menu on the
right.

### Set Logging Row

Stable row height with:

- Set number
- Target reps/load
- Current state
- Primary action
- Secondary edit/missed-reps action

Rows should not resize dramatically after completion.

### Inline Mutation Feedback

For set saves and settings changes, show pending/error state where the action
happened. Avoid redirecting or showing unrelated global errors.

### Empty State With Next Action

Empty states should explain what is missing and offer the next useful action:

- No workouts: start setup or first workout.
- No history: complete a workout.
- No charts: complete workouts to create chart data.

### Destructive Action Zone

Use for delete training data and account deletion. Keep it visually separate
from normal settings and require explicit confirmation.

## Screen Acceptance Criteria

- The app can be operated on mobile during a workout without routine typing.
- A user can complete a prescribed set with one tap.
- A user can record missed reps quickly without shame-oriented language.
- The active exercise, active set, and rest timer are always clear.
- Refreshing or navigating away does not lose logged sets or active timer
  state.
- Finish, discard, delete, and account/data deletion use confirmations.
- Authenticated screens feel like a quiet training dashboard, not a landing
  page.
- Loading, empty, error, and success states are defined for every core screen.
