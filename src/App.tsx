import { useEffect, useMemo, useRef, useState } from 'react';

type TaskRow = {
  id: string;
  title: string;
  notes: string;
  completed: boolean;
};

type ActiveNotesEditor = {
  dayKey: string;
  rowId: string;
  taskTitle: string;
  notes: string;
};

type DayData = {
  key: string;
  label: string;
  date: string;
  rows: TaskRow[];
};

const ROW_COUNT = 8;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STORAGE_PREFIX = 'dnevnik-week';

function createEmptyRows(dayKey: string): TaskRow[] {
  return Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: `${dayKey}-${index}`,
    title: '',
    notes: '',
    completed: false,
  }));
}

function getMonday(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatWeekKey(monday: Date) {
  return monday.toISOString().slice(0, 10);
}

function formatSheetRange(days: DayData[]) {
  const first = days[0];
  const last = days[days.length - 1];
  const month = new Date(`${first.date}, 2026`).toLocaleString('en-US', { month: 'long' });
  const firstDay = first.date.split(' ')[1];
  const lastDay = last.date.split(' ')[1];
  return `${month.toUpperCase()} ${firstDay}-${lastDay}`;
}

function buildDays(monday: Date, saved: Record<string, TaskRow[]>): DayData[] {
  return DAY_NAMES.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = `${label.toLowerCase()}-${date.toISOString().slice(0, 10)}`;
    const rows = saved[key] ?? createEmptyRows(key);

    return {
      key,
      label,
      date: date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      rows,
    };
  });
}

function App() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [savedWeeks, setSavedWeeks] = useState<Record<string, Record<string, TaskRow[]>>>({});
  const [activeNotesEditor, setActiveNotesEditor] = useState<ActiveNotesEditor | null>(null);
  const weekKey = formatWeekKey(weekStart);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_PREFIX);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, Record<string, TaskRow[]>>;
      setSavedWeeks(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_PREFIX);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(savedWeeks));
  }, [savedWeeks]);

  const days = useMemo(() => {
    return buildDays(weekStart, savedWeeks[weekKey] ?? {});
  }, [savedWeeks, weekKey, weekStart]);

  const leftPage = days.slice(0, 3);
  const rightPage = days.slice(3);

  function updateRow(dayKey: string, rowId: string, field: keyof TaskRow, value: string | boolean) {
    setSavedWeeks((current) => {
      const currentWeek = current[weekKey] ?? {};
      const currentRows = currentWeek[dayKey] ?? createEmptyRows(dayKey);

      const nextRows = currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      );

      return {
        ...current,
        [weekKey]: {
          ...currentWeek,
          [dayKey]: nextRows,
        },
      };
    });
  }

  function openNotesEditor(dayKey: string, row: TaskRow) {
    setActiveNotesEditor({
      dayKey,
      rowId: row.id,
      taskTitle: row.title,
      notes: row.notes,
    });
  }

  function closeNotesEditor() {
    setActiveNotesEditor(null);
  }

  function updateActiveNotes(notes: string) {
    setActiveNotesEditor((current) => (current ? { ...current, notes } : current));
    if (activeNotesEditor) {
      updateRow(activeNotesEditor.dayKey, activeNotesEditor.rowId, 'notes', notes);
    }
  }

  function moveWeek(offset: number) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + offset * 7);
      return getMonday(next);
    });
  }

  function resetToCurrentWeek() {
    setWeekStart(getMonday(new Date()));
  }

  return (
    <div className="app-shell">
      <header className="top-actions">
        <div className="top-actions-group">
          <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={() => moveWeek(-1)} aria-label="Previous week">
            ←
          </button>
          <button type="button" className="nav-button nav-button-primary" onClick={resetToCurrentWeek}>
            Today
          </button>
          <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={() => moveWeek(1)} aria-label="Next week">
            →
          </button>
        </div>
      </header>

      <main className="spread">
        <PageSheet
          headerLabel={formatSheetRange(leftPage)}
          days={leftPage}
          onUpdateRow={updateRow}
          onOpenNotes={openNotesEditor}
        />
        <PageSheet
          headerLabel={formatSheetRange(rightPage)}
          days={rightPage}
          onUpdateRow={updateRow}
          onOpenNotes={openNotesEditor}
        />
      </main>

      {activeNotesEditor ? (
        <NotesDialog
          activeNotesEditor={activeNotesEditor}
          onClose={closeNotesEditor}
          onChangeNotes={updateActiveNotes}
        />
      ) : null}
    </div>
  );
}

type PageSheetProps = {
  headerLabel: string;
  days: DayData[];
  onUpdateRow: (dayKey: string, rowId: string, field: keyof TaskRow, value: string | boolean) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
};

function PageSheet({ headerLabel, days, onUpdateRow, onOpenNotes }: PageSheetProps) {
  return (
    <section className="page-sheet">
      <div className="page-header">
        <div className="page-header-top">
          <h1 className="page-month">{headerLabel}</h1>
        </div>
      </div>

      <div className="day-stack">
        {days.map((day) => (
          <DaySection key={day.key} day={day} onUpdateRow={onUpdateRow} onOpenNotes={onOpenNotes} />
        ))}
      </div>
    </section>
  );
}

type DaySectionProps = {
  day: DayData;
  onUpdateRow: (dayKey: string, rowId: string, field: keyof TaskRow, value: string | boolean) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
};

function DaySection({ day, onUpdateRow, onOpenNotes }: DaySectionProps) {
  const dayNumber = day.date.split(' ')[1];

  return (
    <section className="day-section">
      <div className="day-label-rail">
        <div className="day-label-rail-inner">
          <p className="day-title">{day.label}</p>
          <p className="day-date">{dayNumber}</p>
        </div>
      </div>

      <div className="task-grid day-grid">
        <div className="task-grid-head task-grid-row">
          <span>#</span>
          <span>Task</span>
          <span>Notes</span>
          <span>Done</span>
        </div>

        {day.rows.map((row, index) => (
          <div key={row.id} className="task-grid-row">
            <span className="row-number">{index + 1}</span>
            <input
              className={`cell-input ${row.completed ? 'is-complete' : ''}`}
              value={row.title}
              onChange={(event) => onUpdateRow(day.key, row.id, 'title', event.target.value)}
            />
            <button
              type="button"
              className={`notes-trigger ${row.notes ? 'has-notes' : ''}`}
              onClick={() => onOpenNotes(day.key, row)}
            >
              <span
                className="notes-preview"
                dangerouslySetInnerHTML={{ __html: getNotePreview(row.notes) }}
              />
            </button>
            <label className="checkbox-cell">
              <input
                type="checkbox"
                checked={row.completed}
                onChange={(event) => onUpdateRow(day.key, row.id, 'completed', event.target.checked)}
              />
              <span />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function getNotePreview(notes: string) {
  if (!notes.trim()) {
    return '';
  }

  const plain = notes
    .replace(/<li>/g, '• ')
    .replace(/<\/li>/g, ' ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<\/(p|div|h1|h2|h3|ul|ol)>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return plain;
}

type NotesDialogProps = {
  activeNotesEditor: ActiveNotesEditor;
  onClose: () => void;
  onChangeNotes: (notes: string) => void;
};

function NotesDialog({ activeNotesEditor, onClose, onChangeNotes }: NotesDialogProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    unorderedList: false,
  });

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== activeNotesEditor.notes) {
      editorRef.current.innerHTML = activeNotesEditor.notes;
    }
  }, [activeNotesEditor]);

  useEffect(() => {
    function updateActiveFormats() {
      const selection = window.getSelection();
      const editor = editorRef.current;

      if (!selection || !editor || selection.rangeCount === 0) {
        return;
      }

      const anchorNode = selection.anchorNode;
      if (!anchorNode || !editor.contains(anchorNode)) {
        return;
      }

      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
      });
    }

    document.addEventListener('selectionchange', updateActiveFormats);
    return () => document.removeEventListener('selectionchange', updateActiveFormats);
  }, []);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChangeNotes(editorRef.current.innerHTML);
      editorRef.current.focus();
    }

    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="notes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="notes-dialog-header">
          <div>
            <p className="dialog-label">Task Notes</p>
            <h2 id="notes-dialog-title" className="dialog-title">
              {activeNotesEditor.taskTitle || 'Untitled task'}
            </h2>
          </div>
          <button type="button" className="nav-button nav-button-inline" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
          <button
            type="button"
            className={`toolbar-button ${activeFormats.bold ? 'is-active' : ''}`}
            onClick={() => exec('bold')}
          >
            B
          </button>
          <button
            type="button"
            className={`toolbar-button toolbar-button-italic ${activeFormats.italic ? 'is-active' : ''}`}
            onClick={() => exec('italic')}
          >
            I
          </button>
          <button
            type="button"
            className={`toolbar-button ${activeFormats.unorderedList ? 'is-active' : ''}`}
            onClick={() => exec('insertUnorderedList')}
          >
            • List
          </button>
          <button type="button" className="toolbar-button" onClick={() => exec('formatBlock', '<h3>')}>
            Large
          </button>
          <button type="button" className="toolbar-button" onClick={() => exec('formatBlock', '<p>')}>
            Body
          </button>
        </div>

        <div
          ref={editorRef}
          className="notes-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => onChangeNotes(event.currentTarget.innerHTML)}
        />
      </section>
    </div>
  );
}

export default App;
