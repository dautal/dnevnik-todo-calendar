# Dnevnik Todo Calendar

## Product Idea

A weekly productivity app inspired by the Soviet/post-Soviet `dnevnik` school diary, reinterpreted through a calm, simple, Notion-like interface.

The core experience is a two-page weekly spread:

- Left page: Monday, Tuesday, Wednesday
- Right page: Thursday, Friday, Saturday

The app is not a generic calendar with a themed skin. The weekly spread is the product.

## Product Principles

1. Layout first
   The two-page week view is the primary feature and should always feel like the center of the app.

2. Minimal, not decorative
   The diary inspiration should shape the structure, not overload the interface with nostalgia.

3. Calm and direct
   Interactions should feel as simple as editing a Notion page or lightweight table.

4. Paper discipline, digital flexibility
   The visual rhythm should come from ruled rows, columns, dates, and margins, while editing stays fluid and fast.

5. Desktop-first, mobile-safe
   The spread should feel beautiful on desktop and gracefully stack on mobile.

## Core User Story

The user opens the app and immediately sees the current week as a clean two-page diary spread. Each day contains a structured task table. The user can click into a row, type a task, add a note, check it off, and move through the week without leaving the main view.

## Primary Screen

### Weekly Spread

The app opens directly into the weekly spread.

Top header:

- Month label
- Week range
- Previous week button
- Next week button
- Today button

Main body:

- Two equal sheets side by side on desktop
- Left sheet contains Monday, Tuesday, Wednesday
- Right sheet contains Thursday, Friday, Saturday
- Each day occupies a stacked block on its sheet

Bottom utility area:

- Weekly notes
- Carry-over items
- Optional weekly focus

## Layout Blueprint

### Desktop

#### Outer Frame

- Centered app shell
- Max width around 1200-1440px
- Generous outer margin
- Very subtle panel separation between left and right sheet

#### Header

- Top-left: month, for example `March`
- Top-center or below: week range, for example `Mar 9-14`
- Top-right: navigation controls

Header should feel editorial, not toolbar-heavy.

#### Spread

- Two columns
- Each column represents one paper page
- Vertical spacing between day blocks should be consistent

Suggested day arrangement:

- Left page:
  - Monday
  - Tuesday
  - Wednesday
- Right page:
  - Thursday
  - Friday
  - Saturday

#### Day Block

Each day block contains:

- Day label
- Numeric date
- Structured task table

Day label format examples:

- `Monday 09`
- `Mon 09`

The label should be compact and aligned to the page edge or left margin.

### Mobile

The spread collapses into a single vertical stream while preserving the same visual language.

- Days stack in order from Monday to Saturday
- Header remains at the top
- Each day becomes a full-width card/table
- Navigation remains sticky or easy to reach

Do not force a fake two-page spread on small screens.

## Table Structure

Each day is a simple table-like grid.

Recommended columns:

- `#` for row number
- `Task` for the main item
- `Notes` for details or reminders
- `Done` for completion state

Alternative compact version:

- `#`
- `Task`
- `Done`

Recommended default row count:

- 6-8 visible rows per day

Rows can expand as needed, but the initial view should keep the page balanced.

## Interaction Model

### Editing

- Click any task cell to edit inline
- Press `Enter` to save and move to the next row
- Press `Tab` to move across columns
- Empty rows remain visible as input affordances

### Task Completion

- The rightmost column contains a checkbox or subtle completion marker
- Completed tasks can show muted text or a faint strike-through

### Adding Tasks

- Primary pattern: type directly into an empty row
- Secondary pattern: quick add button if needed, but not visually dominant

### Notes

- Notes should be lightweight and secondary
- Avoid modal-heavy editing for simple use

### Navigation

- Previous/next week should animate or swap smoothly without heavy transitions
- `Today` jumps back to the current week

## Information Hierarchy

The visual hierarchy should be:

1. Weekly structure
2. Day and date
3. Task content
4. Notes and metadata
5. Controls

Controls should not visually overpower the page.

## Visual Direction

### Overall Feel

Keywords:

- editorial
- quiet
- structured
- tactile
- disciplined
- modern

The product should feel closer to a thoughtfully designed workspace than a retro novelty app.

### Color System

Suggested direction:

- Background: warm paper off-white
- Surface: slightly lighter or darker paper tone
- Text primary: charcoal
- Text secondary: muted gray-brown
- Grid lines: soft gray
- Accent: one understated ink color such as dark olive, slate blue, or brick

Avoid:

- stark white with harsh black lines
- overly vintage sepia styling
- bright SaaS accent colors

### Typography

Use typography with editorial restraint.

Recommended pairing:

- Primary UI font: clean sans-serif
- Optional accent font: subtle serif for month or section headings

Typography rules:

- Day labels should be compact and clear
- Month label can carry more personality
- Body task text should be highly readable

### Borders and Surfaces

- Thin grid lines
- Light page boundaries
- Minimal shadow or no shadow
- Slight radius only if it helps modernize the feel

### Motion

- Soft page-load reveal
- Gentle highlight on active cell
- Minimal hover behavior

Motion should support clarity, not become a feature.

## Suggested Component Set

Core components:

- `WeekHeader`
- `WeekRangeNav`
- `WeeklySpread`
- `PageSheet`
- `DaySection`
- `TaskGrid`
- `TaskRow`
- `WeeklyNotes`

Low-level interaction components:

- `InlineEditableCell`
- `CheckboxCell`
- `DateBadge`
- `IconButton`

## Data Model

### Week

- id
- startDate
- endDate

### Day

- id
- date
- weekday
- weekId

### Task

- id
- dayId
- rowIndex
- title
- notes
- completed
- createdAt
- updatedAt

Optional later fields:

- priority
- category
- carryOver
- dueTime

## MVP Scope

Version 1 should include:

- Weekly spread desktop layout
- Responsive stacked mobile layout
- Week navigation
- Auto-generated dates for Monday-Saturday
- Inline task editing
- Checkbox completion
- Local persistence

Version 1 should exclude:

- Month view as primary screen
- Complex recurring tasks
- Notifications
- Collaboration
- Overbuilt tagging/filter systems

## UX Decisions To Keep

- The app opens directly into the week
- Empty rows are always visible
- Saturday is included in the main spread
- Sunday is omitted from the first version unless a strong use case appears
- The month and exact weekly dates are always visible

## UX Decisions To Validate Later

- Whether to include a bottom notes section
- Whether Sunday should appear as a compact footer block
- Whether `Notes` deserves its own column or expands inline
- Whether row count should be fixed or flexible

## Responsive Rules

### Desktop

- Preserve the two-sheet metaphor
- Keep left/right pages balanced in height

### Tablet

- Maintain two pages if space allows
- Reduce margins and row height slightly

### Mobile

- Collapse to one column
- Keep day/date headers pinned or visually strong
- Retain the same table language, just simplified

## Design Reference Translation

From the original diary reference, preserve:

- weekly spread logic
- stacked daily sections
- ruled rows
- day/date labeling
- disciplined layout rhythm

From Notion-like simplicity, preserve:

- minimal controls
- inline editing
- clean typography
- calm spacing
- low visual noise

## Build Sequence

1. Create a static desktop weekly spread mock
2. Add the visual system: type, colors, spacing, lines
3. Implement day sections and row grid
4. Add inline editing and completion
5. Add week navigation and generated dates
6. Add local persistence
7. Tune mobile layout

## Success Criteria

The app is succeeding if:

- the weekly spread feels instantly understandable
- the layout feels distinct from generic planner apps
- task entry feels frictionless
- the interface feels calm and intentional
- the design still works well without decorative assets

## One-Sentence Product Positioning

A minimal weekly productivity planner that reimagines the classic `dnevnik` diary spread as a clean digital workspace.
