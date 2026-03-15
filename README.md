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
- Local browser persistence with `localStorage`
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
- Each day has fixed task rows
- Each row stores a task title, detailed notes, and completion state
- Data is currently saved in the browser using `localStorage`

## Local Development

```bash
cd /Users/alandautov/Desktop/dnevnik-todo-calendar
npm install
npm run dev
```

Open the local URL printed by Vite, usually [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

- `src/App.tsx` - app state, week logic, task grid, and notes popup
- `src/styles.css` - layout system and visual styling
- `PRODUCT_SPEC.md` - early product planning and layout notes

## Future Ideas

- Supabase auth and cloud sync
- user accounts
- mobile-specific refinements
- drag and reorder tasks
- recurring tasks
- weekly review and carry-over tasks

## License

No license has been added yet.
