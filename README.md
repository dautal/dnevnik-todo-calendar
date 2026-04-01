# Nev

Live app: [https://dnevnik-todo-calendar.vercel.app/](https://dnevnik-todo-calendar.vercel.app/)

Minimalist planner built with React, TypeScript, Vite, and Supabase.

The app is inspired by a Soviet and post-Soviet `dnevnik`: a structured paper planner with a calm weekly spread instead of a dense dashboard. It keeps the interface notebook-like and low-noise, while adding search, notes, sync, themes, localization, and a public demo flow.

## Overview

The planner currently supports three views:

- `weekly planner`
- `monthly planner`
- `yearly planner`

The main weekly layout is a two-page spread:

- left page: Monday, Tuesday, Wednesday
- right page: Thursday, Friday, Saturday

Instead of feeling like a generic task app, the product is intentionally shaped like a paper planning surface: floating day blocks, restrained controls, and customizable typography/gridline styles.

## Live Product Behavior

- public Vercel landing page opens in `demo mode`
- demo mode is explorable without an account
- synced access is behind an invite-only Google beta flow
- `sign up` opens the beta access screen
- signed-in users sync planner data through Supabase

## Features

### Planner

- weekly, monthly, and yearly planner modes
- `home` jumps back to the current week in weekly view
- current day highlighting
- page-turn-style week navigation
- large side hit-zones for previous/next week
- half-week month/date headers
- one project row by default per day
- the single default row uses the height of the old six-row block
- days grow taller once project count exceeds the initial visual capacity
- project rows can be reordered or moved across days with drag and drop

### Projects and Notes

- `project` column instead of `task`
- inline project editing
- `Enter` from a project cell opens notes
- notes popup with matching rounded app styling
- editable project title inside the notes window
- rich text controls:
  - bold
  - italic
  - body
  - large
  - bullet list
- `Tab` indentation inside notes
- notes can be applied with `Cmd/Ctrl+Enter`
- priority is managed from the notes UI instead of a dedicated table column
- separate deadline time control inside notes

### Unassigned Tasks

- centered `what's on your mind?` capture input in the header
- typing reveals the inline cue `drag later with Enter`
- unassigned task chips stay at the bottom lane
- unassigned tasks can be dragged into planner rows later

### Search

- header `search` button with dropdown search panel
- keyboard shortcut: `Cmd/Ctrl+F`
- searches project titles and note content/previews

### Personalization

- themes:
  - White
  - Paper
  - Night
  - Sepia
  - Blueprint
- interface languages:
  - English
  - Russian
- `text form` customization:
  - formal
  - informal
- informal mode lowercases interface copy and date labels
- `gridlines` customization:
  - formal labels: `Gridlines`, `No gridlines`
  - informal labels: `ugly gridlines`, `big4 trauma`
- account/settings menu for theme, language, text form, and gridline style

### Visual System

- floating month and day blocks
- configurable notebook/gridline feel
- `big4 trauma` mode replaces hard gridlines with soft grey band separation
- header and footer chrome stretched edge-to-edge with planner-aligned content

### Storage and Sync

- local browser persistence
- Supabase cloud sync for signed-in users
- Google OAuth beta sign-in
- invite-only gating with `VITE_ALLOWED_EMAILS`
- visible `Saving... / Saved` sync feedback

## Tech Stack

- React
- TypeScript
- Vite
- custom CSS
- Supabase
- Vercel

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Environment Variables

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_ALLOWED_EMAILS=you@example.com,friend@example.com
```

Notes:

- `VITE_ALLOWED_EMAILS` is optional for local demo work, but required if you want to mirror invite-only beta behavior locally.
- after changing env vars, restart the Vite dev server

## Supabase Setup

The app supports:

- local browser demo/persistence behavior
- Supabase sync for authenticated users

To connect Supabase:

1. Create a Supabase project.
2. Run the SQL in `supabase-schema.sql`.
3. Add the required env vars.
4. Restart the dev server.
5. Configure Google auth in Supabase if you want beta sign-in.

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment

The app is deployed on Vercel:

- live app: [https://dnevnik-todo-calendar.vercel.app/](https://dnevnik-todo-calendar.vercel.app/)

For deploys, Vercel needs:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ALLOWED_EMAILS` for invite-only beta gating

## Project Structure

- `src/App.tsx` - planner state, auth/demo flow, dialogs, search, planner modes, sync logic, and settings
- `src/styles.css` - layout, themes, planner surfaces, dialogs, header/footer chrome, and customization styles
- `src/lib/supabase.ts` - Supabase client setup
- `supabase-schema.sql` - database schema and RLS policies
- `docs/ARCHITECTURE.md` - implementation notes, persistence flow, and architecture guidance

## Product Direction

Nev is still intentionally focused and calm, but it is being shaped as a foundation for a larger planning system over time. The current product centers on personal planning, notes, visual rhythm, and lightweight sync, while leaving room for future collaboration, assignments, reminders, and richer planning analytics.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

## Policies

- [Privacy Policy](./PRIVACY.md)
- [Terms of Service](./TERMS.md)
