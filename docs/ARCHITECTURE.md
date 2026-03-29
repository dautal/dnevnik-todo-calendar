# Dnevnik Todo Calendar Architecture

## Purpose

This document explains how the app is structured, how data flows through it, and which parts are most important when making changes.

The application is intentionally centered around one primary screen:

- a two-page weekly planner
- optional cloud sync through Supabase
- local-first behavior so the planner still works when cloud sync is unavailable

## Main Files

- `src/App.tsx`
  The main application component and almost all planner logic:
  - auth flow
  - weekly state
  - local persistence
  - Supabase reads and writes
  - search
  - calendar view
  - notes dialog
  - priority dialog
  - misc task inbox
  - drag and drop

- `src/styles.css`
  The visual system:
  - planner layout
  - themes
  - dialogs
  - top bar and footer
  - calendar styling
  - responsive behavior

- `src/lib/supabase.ts`
  Minimal Supabase client setup based on `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

- `supabase-schema.sql`
  The intended database schema and migration path for the `tasks` table.

## Data Model

### In-memory planner row

Each visible planner row uses the `TaskRow` shape:

- `id`
- `title`
- `notes`
- `status`
- `time`
- `detailColor`
- `priorityDismissed`

Important note:

- Built-in priority values such as `low`, `urgent`, `critical`, `done`, and `none` live in `status`.
- Custom priority/detail text currently lives in `time`.
- `detailColor` controls the color used for custom details.
- `priorityDismissed` is local-only UI state. It is not currently stored in Supabase.

This split exists because the app grew from an earlier simpler schema and still supports older Supabase tables during migration.

### Supabase row

The current intended database columns are:

- `user_id`
- `week_start`
- `day_index`
- `row_index`
- `title`
- `notes`
- `status`
- `task_time`
- `detail_color`

The app still contains compatibility logic for older projects that may still use:

- `completed`
- no `task_time`
- no `detail_color`

## State Layers

The app has three important state layers:

### UI state

Examples:

- open dialogs
- active search row
- week page-turn animation
- selected theme
- selected language
- account menu open/closed

This state only matters to the current browser session and view.

### Local persistence

Stored in `localStorage`:

- planner weeks
- miscellaneous tasks by week
- planner title override
- theme
- language

This is the default storage mode and also acts as a fallback when Supabase is unavailable.

### Cloud persistence

When Supabase is configured and the user is signed in:

- planner rows are read from Supabase
- row updates are pushed back to Supabase
- row reorders rewrite an entire day slice in row-index order

The app is intentionally local-first on startup, then overlays cloud data after auth and loading complete.

## Weekly Data Flow

### Startup

On mount, the app:

1. loads local planner state from `localStorage`
2. loads misc tasks from `localStorage`
3. loads the planner title override
4. restores theme and language from storage
5. initializes Supabase auth session if configured

This lets the interface appear quickly before cloud state is available.

### Building the visible week

The selected Monday is converted into six `DayData` entries:

- Monday through Saturday

Each day is built from the stored week slice and normalized into `TaskRow[]`.

### Cloud read behavior

When a signed-in user is present, the app loads the current week from Supabase.

Because live projects may still be on older schemas, reads use progressive fallback:

1. try the newest column set
2. fall back if `task_time` is missing
3. fall back if `detail_color` is missing
4. fall back again if only the old `completed` boolean exists

If the remote schema is still old, the app preserves richer local detail values during merge so cloud reads do not accidentally wipe custom priority data.

## Editing Flow

### Task title

Task titles are edited inline in the planner grid.

Special priority behavior:

- when a new task is created, `Set Priority` stays visible
- once the user chooses an actual priority, it shows normally
- if the user explicitly chooses `None`, the priority cell becomes visually empty again
- hovering the cell later reveals `Set Priority`

### Notes

Notes are edited in a popup dialog using `contentEditable`.

Supported formatting:

- bold
- italic
- bullet list
- body
- large

The notes dialog also lets the user rename the task directly.

### Notes security model

Because notes use editable HTML, all note HTML is sanitized before:

- saving
- restoring into the editor
- rendering preview text

Allowed formatting is intentionally limited to a small safe subset of tags.

## Priority Flow

The priority column no longer uses a native browser dropdown.

Instead:

1. clicking the cell opens a modal priority picker
2. choosing a built-in option selects it temporarily
3. pressing `Apply` commits it
4. choosing `Custom...` opens the custom detail dialog

Custom detail values:

- are limited in length
- support color selection
- are stored as the flexible custom detail slot

## Drag and Drop

### Planner rows

Users can drag tasks:

- within the same day to reorder them
- across days to move or swap them

Same-day drag:

- preserves row content
- changes row order only

Cross-day drag:

- swaps with the target row if it is occupied
- moves into place and leaves an empty row behind if the target is empty

### Misc tasks

Misc tasks live in the footer inbox for tasks that are not assigned to a specific day yet.

They can be:

- added with the footer input
- deleted
- dragged into planner rows

## Search

Global search scans:

- task titles
- note preview text

Search results identify:

- week
- day
- row

Selecting a result navigates to the relevant week and highlights the matching row.

## Calendar View

The calendar is a year-level overview, not a full editing surface.

It is used to:

- navigate to a week
- view activity shading by week

The shading is derived from the number of non-empty rows in each saved week.

## Themes and Language

Themes are implemented entirely through CSS variables in `src/styles.css`.

Current themes:

- White
- Paper
- Night
- Sepia
- Blueprint

Language switching changes interface text only:

- English
- Russian

Task titles and notes are not translated automatically.

## Deployment Notes

The project is configured for Vercel through `vercel.json`.

For cloud sync to work in production:

1. set Vercel environment variables for Supabase
2. run `supabase-schema.sql` in the target Supabase project
3. configure auth redirect URLs in Supabase

## Known Tradeoffs

- `src/App.tsx` is still a large single-file application and could eventually be split into feature modules.
- The notes editor still uses `contentEditable`, even though its HTML is now sanitized.
- `priorityDismissed` is local-only UI state and is not yet synced to Supabase.

## Suggested Future Refactors

- split planner state and persistence into custom hooks
- move dialogs into separate components/files
- separate Supabase compatibility logic from UI logic
- add automated tests for:
  - note sanitization
  - priority behavior
  - Supabase legacy schema fallback
  - drag-and-drop row movement
