# Dnevnik Todo Calendar

Minimalist weekly planner built with React, TypeScript, and Vite.

The app is inspired by a Soviet and post-Soviet `dnevnik`: a structured paper planner with a calm weekly spread instead of a dense dashboard. It combines task planning, notes, lightweight priority management, and optional cloud sync in a compact two-page layout.

## Overview

Instead of a standard month grid, the planner uses a weekly spread:

- left page: Monday, Tuesday, Wednesday
- right page: Thursday, Friday, Saturday

The interface is intentionally restrained, paper-like, and low-noise, with optional themes and a matching rounded UI system across the planner, dialogs, settings, and calendar.

## Features

- weekly two-page planner layout
- Monday through Saturday spread
- current day highlight
- editable planner title
- global search across task titles and note previews
- year calendar view with GitHub-style green activity shading
- page-turn-inspired week transition
- large side hit-zones to move between weeks
- `Home` jump back to the current week

### Tasks

- inline task editing
- each day starts with 6 rows
- can expand up to 16 rows per day
- hover controls on the last row to add or delete rows
- drag and drop tasks within a day
- drag and drop tasks between days

### Priority

- dedicated `Priority` column
- popup priority picker instead of browser-native dropdowns
- built-in options: `Low`, `Urgent`, `Critical`, `Done`, and `None`
- custom priority/detail values with color selection
- `Set Priority` prompt for new tasks
- empty priority cells after explicitly choosing `None`, with hover-to-reveal prompt

### Notes

- notes open in a popup editor
- notes dialog uses the same rounded visual system as the rest of the app
- editable task title inside the notes dialog
- rich text controls:
  - bold
  - italic
  - body
  - large
  - bullet list
- resizable notes window
- closes with `Done`, `Esc`, `Cmd/Ctrl+Enter`, or the close button
- outside click does not close dialogs

### Miscellaneous Task Inbox

- footer inbox for miscellaneous tasks you do not want to place immediately
- add misc tasks by typing and pressing `Enter`
- misc tasks persist by week
- drag misc tasks into planner rows later
- delete misc tasks on hover

### Personalization

- multiple themes:
  - White
  - Paper
  - Night
  - Sepia
  - Blueprint
- interface language switcher:
  - English
  - Russian
- language setting translates the interface only, not task content or notes
- account/settings menu in the header

### Storage and Sync

- local browser persistence by default
- Supabase cloud sync when configured
- email/password authentication
- Google and GitHub OAuth buttons in the auth UI
- local fallback behavior when Supabase is not configured or unavailable

## Tech Stack

- React
- TypeScript
- Vite
- CSS
- Supabase

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually [http://localhost:5173](http://localhost:5173).

## Supabase Setup

The app supports two storage modes:

- local browser storage by default
- Supabase cloud sync when environment variables are configured

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Then:

1. Create a Supabase project.
2. Run the SQL in `supabase-schema.sql`.
3. Restart the dev server.
4. Sign in through the app.

Notes:

- Google and GitHub OAuth buttons are already in the UI, but they only work after those providers are configured in Supabase.
- If a Supabase free-tier project has been inactive for a while, it may be paused and need time to wake up.
- The app includes local fallback behavior, so you can still use it without a working Supabase connection.

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

- `src/App.tsx` - main application state, planner logic, dialogs, auth flow, search, calendar, drag and drop, and settings
- `src/styles.css` - planner layout, themes, dialogs, calendar styling, and overall visual system
- `src/lib/supabase.ts` - Supabase client setup
- `supabase-schema.sql` - database schema and RLS policies
- `docs/ARCHITECTURE.md` - implementation notes, state flow, persistence model, and refactor guidance

## Product Direction

The app is intentionally not a full productivity suite. It focuses on:

- a readable weekly planning surface
- quick task capture and movement
- lightweight prioritization
- calm notes editing
- low-friction local use with optional cloud sync

## License

No license has been added yet.
