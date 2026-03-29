# Dnevnik Todo Calendar

Minimalist weekly calendar and todo app inspired by the `dnevnik` diary layout from Soviet and post-Soviet school planners.

Instead of a standard calendar grid, the app uses a two-page weekly spread:

- Left page: Monday, Tuesday, Wednesday
- Right page: Thursday, Friday, Saturday

The goal is simple: combine planning and task management in a compact weekly view with a strict black-and-white, low-noise design.

## Features

- Weekly two-page planner layout
- Direct inline task editing
- Rich task notes in a popup editor
- Bold, italic, bullet list, and text-size controls for notes
- Resizable notes window
- Current day highlight
- Add and delete extra task rows
- Global search across tasks and notes
- Zoomed-out year calendar with activity shading
- Separate auth screen for cloud sync
- Local browser persistence with `localStorage`
- Supabase cloud sync with local fallback
- Minimal black-and-white UI

## Design Direction

This project mixes three ideas:

- the structure of a paper `dnevnik`
- the simplicity of a minimalist todo app
- the calm editing flow of tools like Tweek or Notion

The main feature is the layout itself. The app is intentionally focused on the weekly view rather than dashboards, analytics, or complex productivity systems.

## Tech Stack

- React
- TypeScript
- Vite
- Plain CSS

## How It Works

- The current view always starts on Monday
- The planner shows Monday through Saturday
- Each day starts with 6 task rows
- Extra rows can be added and removed
- Each row stores a task title, detailed notes, and completion state
- Data is saved in `localStorage` by default
- When Supabase is configured, data syncs per signed-in user

## Local Development

```bash
cd /Users/alandautov/Desktop/dnevnik-todo-calendar
npm install
npm run dev
```

Open the local URL printed by Vite, usually [http://localhost:5173](http://localhost:5173).

## Supabase Setup

The app now supports two storage modes:

- local browser storage by default
- Supabase cloud storage when env vars are configured

1. Create a Supabase project
2. Create `.env.local`
3. Fill in:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

4. In the Supabase SQL editor, run the schema from `supabase-schema.sql`
5. Restart the dev server
6. Open the auth screen and sign in with email/password

Google and GitHub OAuth buttons are also present in the UI, but they will only work after those providers are configured in your Supabase project.

With Supabase configured, tasks are stored per user in the `tasks` table. Without it, the app falls back to `localStorage`.

If your Supabase free-tier project has been inactive for a while, it may be paused and need to wake up before auth or sync starts working again.

## Build

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

- `src/App.tsx` - app state, auth flow, week logic, search, calendar, and notes popup
- `src/styles.css` - layout system and visual styling
- `src/lib/supabase.ts` - Supabase client setup
- `supabase-schema.sql` - database schema and RLS policies
- `PRODUCT_SPEC.md` - early product planning and layout notes

## Future Ideas

- mobile-specific refinements
- drag and reorder tasks
- recurring tasks
- weekly review and carry-over tasks

## License

No license has been added yet.
