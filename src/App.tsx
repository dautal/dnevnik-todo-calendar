import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

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

type CalendarMonth = {
  monthIndex: number;
  label: string;
  weeks: Date[][];
};

type DayData = {
  key: string;
  label: string;
  date: string;
  rows: TaskRow[];
};

type TaskRecord = {
  user_id: string;
  week_start: string;
  day_index: number;
  row_index: number;
  title: string;
  notes: string;
  completed: boolean;
};

const ROW_COUNT = 6;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STORAGE_PREFIX = 'dnevnik-week';
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function createEmptyRows(dayKey: string): TaskRow[] {
  return Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: `${dayKey}-${index}`,
    title: '',
    notes: '',
    completed: false,
  }));
}

function createEmptyRow(dayKey: string, index: number): TaskRow {
  return {
    id: `${dayKey}-${index}`,
    title: '',
    notes: '',
    completed: false,
  };
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

function getMonthCalendar(year: number, month: number): CalendarMonth {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstMonday = getMonday(firstDay);
  const weeks: Date[][] = [];
  let cursor = new Date(firstMonday);

  while (cursor <= lastDay || weeks.length < 5) {
    const week: Date[] = [];

    for (let index = 0; index < 7; index += 1) {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() + index);
      week.push(day);
    }

    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
  }

  return {
    monthIndex: month,
    label: new Date(year, month, 1).toLocaleString('en-US', { month: 'long' }),
    weeks,
  };
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

function getDayIndex(dayKey: string) {
  const weekday = dayKey.split('-')[0];
  return DAY_NAMES.findIndex((day) => day.toLowerCase() === weekday);
}

function getRowIndex(rowId: string) {
  return Number(rowId.slice(rowId.lastIndexOf('-') + 1));
}

function isRowEmpty(row: TaskRow) {
  return row.title.trim() === '' && row.notes.trim() === '' && !row.completed;
}

function mapRecordsToWeek(weekStart: Date, records: TaskRecord[]) {
  const mapped: Record<string, TaskRow[]> = {};

  for (const dayLabel of DAY_NAMES) {
    const dayIndex = DAY_NAMES.indexOf(dayLabel);
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayIndex);
    const dayKey = `${dayLabel.toLowerCase()}-${date.toISOString().slice(0, 10)}`;
    mapped[dayKey] = createEmptyRows(dayKey);
  }

  for (const record of records) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + record.day_index);
    const dayKey = `${DAY_NAMES[record.day_index].toLowerCase()}-${date.toISOString().slice(0, 10)}`;

    if (!mapped[dayKey]) {
      mapped[dayKey] = createEmptyRows(dayKey);
    }

    mapped[dayKey][record.row_index] = {
      id: `${dayKey}-${record.row_index}`,
      title: record.title,
      notes: record.notes,
      completed: record.completed,
    };
  }

  return mapped;
}

function hasAnyTaskContent(week: Record<string, TaskRow[]> | undefined) {
  if (!week) {
    return false;
  }

  return Object.values(week).some((rows) =>
    rows.some((row) => row.title.trim() !== '' || row.notes.trim() !== '' || row.completed),
  );
}

function getNotePreview(notes: string) {
  if (!notes.trim()) {
    return '';
  }

  return notes
    .replace(/<li>/g, '• ')
    .replace(/<\/li>/g, ' ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<\/(p|div|h1|h2|h3|ul|ol)>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function App() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [savedWeeks, setSavedWeeks] = useState<Record<string, Record<string, TaskRow[]>>>({});
  const [activeNotesEditor, setActiveNotesEditor] = useState<ActiveNotesEditor | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() => new Date().getFullYear());
  const [hasHydratedLocalCache, setHasHydratedLocalCache] = useState(false);
  const weekKey = formatWeekKey(weekStart);
  const yearMonths = useMemo(
    () => MONTH_NAMES.map((_, monthIndex) => getMonthCalendar(visibleYear, monthIndex)),
    [visibleYear],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_PREFIX);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, Record<string, TaskRow[]>>;
        setSavedWeeks(parsed);
      } catch {
        window.localStorage.removeItem(STORAGE_PREFIX);
      }
    }

    setHasHydratedLocalCache(true);

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setUser(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedLocalCache || !isSupabaseConfigured || !supabase || !user) {
      return;
    }

    let ignore = false;
    const client = supabase;
    const activeUser = user;

    async function loadWeek() {
      setIsWeekLoading(true);
      setStorageError('');

      const { data, error } = await client
        .from('tasks')
        .select('user_id, week_start, day_index, row_index, title, notes, completed')
        .eq('user_id', activeUser.id)
        .eq('week_start', weekKey)
        .order('day_index', { ascending: true })
        .order('row_index', { ascending: true });

      if (ignore) {
        return;
      }

      if (error) {
        setStorageError(error.message);
      } else {
        setSavedWeeks((current) => ({
          ...current,
          [weekKey]:
            (data ?? []).length > 0 || !hasAnyTaskContent(current[weekKey])
              ? mapRecordsToWeek(weekStart, (data ?? []) as TaskRecord[])
              : current[weekKey],
        }));
      }

      setIsWeekLoading(false);
    }

    void loadWeek();

    return () => {
      ignore = true;
    };
  }, [hasHydratedLocalCache, user, weekKey, weekStart]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(savedWeeks));
  }, [savedWeeks]);

  const days = useMemo(() => {
    return buildDays(weekStart, savedWeeks[weekKey] ?? {});
  }, [savedWeeks, weekKey, weekStart]);

  const leftPage = days.slice(0, 3);
  const rightPage = days.slice(3);
  const todayWeekKey = formatWeekKey(getMonday(new Date()));
  const todayDayIndex = (() => {
    const day = new Date().getDay();
    if (day === 0) {
      return 5;
    }

    return Math.min(day - 1, 5);
  })();

  async function persistRow(dayKey: string, row: TaskRow) {
    if (!supabase || !user) {
      return;
    }

    const dayIndex = getDayIndex(dayKey);
    const rowIndex = getRowIndex(row.id);

    if (dayIndex < 0 || Number.isNaN(rowIndex)) {
      return;
    }

    if (isRowEmpty(row)) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start', weekKey)
        .eq('day_index', dayIndex)
        .eq('row_index', rowIndex);

      if (error) {
        setStorageError(error.message);
      }

      return;
    }

    const { error } = await supabase
      .from('tasks')
      .upsert(
        {
          user_id: user.id,
          week_start: weekKey,
          day_index: dayIndex,
          row_index: rowIndex,
          title: row.title,
          notes: row.notes,
          completed: row.completed,
        },
        {
          onConflict: 'user_id,week_start,day_index,row_index',
        },
      );

    if (error) {
      setStorageError(error.message);
    }
  }

  function addRow(dayKey: string) {
    setSavedWeeks((current) => {
      const currentWeek = current[weekKey] ?? {};
      const currentRows = currentWeek[dayKey] ?? createEmptyRows(dayKey);
      const nextRow = createEmptyRow(dayKey, currentRows.length);
      const nextState = {
        ...current,
        [weekKey]: {
          ...currentWeek,
          [dayKey]: [...currentRows, nextRow],
        },
      };

      window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(nextState));
      return nextState;
    });
  }

  function updateRow(dayKey: string, rowId: string, field: keyof TaskRow, value: string | boolean) {
    const currentWeek = savedWeeks[weekKey] ?? {};
    const currentRows = currentWeek[dayKey] ?? createEmptyRows(dayKey);
    const existingRow = currentRows.find((row) => row.id === rowId);

    if (!existingRow) {
      return;
    }

    const updatedRow: TaskRow = {
      ...existingRow,
      [field]: value,
    };

    setSavedWeeks((current) => {
      const currentWeekState = current[weekKey] ?? {};
      const currentRowsState = currentWeekState[dayKey] ?? createEmptyRows(dayKey);

      const nextRows = currentRowsState.map((row) => (row.id === rowId ? updatedRow : row));

      const nextState = {
        ...current,
        [weekKey]: {
          ...currentWeekState,
          [dayKey]: nextRows,
        },
      };

      window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(nextState));

      return nextState;
    });

    if (supabase && user) {
      void persistRow(dayKey, updatedRow);
    }
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

  function jumpToWeek(target: Date) {
    setWeekStart(getMonday(target));
    setIsCalendarOpen(false);
  }

  async function signInWithPassword() {
    if (!supabase || !authEmail.trim() || !authPassword) {
      return;
    }

    setIsAuthLoading(true);
    setAuthMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });

    if (error) {
      setAuthMessage(error.message);
    } else {
      setAuthMessage(`Signed in as ${authEmail.trim()}.`);
    }

    setIsAuthLoading(false);
  }

  async function signUpWithPassword() {
    if (!supabase || !authEmail.trim() || !authPassword) {
      return;
    }

    setIsAuthLoading(true);
    setAuthMessage('');

    const { error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthMessage(error.message);
    } else {
      setAuthMessage(`Account created for ${authEmail.trim()}. Check your email if confirmation is required.`);
    }

    setIsAuthLoading(false);
  }

  async function signInWithProvider(provider: 'google' | 'github') {
    if (!supabase) {
      return;
    }

    setAuthMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthMessage(error.message);
    }
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSavedWeeks({});
    setAuthMessage('');
  }

  if (isSupabaseConfigured && !user) {
    return (
      <AuthScreen
        authEmail={authEmail}
        authPassword={authPassword}
        authMessage={authMessage}
        isAuthLoading={isAuthLoading}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSignIn={signInWithPassword}
        onSignUp={signUpWithPassword}
        onOAuth={(provider) => void signInWithProvider(provider)}
      />
    );
  }

  return (
    <div className="app-shell">
      <section className="storage-bar">
        <div>
          <p className="storage-label">{isSupabaseConfigured ? 'Cloud Mode' : 'Local Mode'}</p>
          <p className="storage-copy">
            {isSupabaseConfigured
              ? `Connected as ${user?.email ?? user?.id ?? 'Unknown user'}`
              : 'Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local` to enable cloud sync.'}
          </p>
        </div>

        {isSupabaseConfigured && user ? (
          <button type="button" className="nav-button" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </section>

      {authMessage ? <p className="status-banner">{authMessage}</p> : null}
      {storageError ? <p className="status-banner status-banner-error">{storageError}</p> : null}
      {isWeekLoading ? <p className="status-banner">Loading this week from Supabase...</p> : null}

      <header className="top-actions">
        <div className="top-actions-group">
          <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={() => moveWeek(-1)} aria-label="Previous week">
            ←
          </button>
          <button type="button" className="nav-button" onClick={() => setIsCalendarOpen(true)}>
            Zoom Out
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
          onAddRow={addRow}
          onOpenNotes={openNotesEditor}
          activeDayIndex={weekKey === todayWeekKey ? todayDayIndex : null}
        />
        <PageSheet
          headerLabel={formatSheetRange(rightPage)}
          days={rightPage}
          onUpdateRow={updateRow}
          onAddRow={addRow}
          onOpenNotes={openNotesEditor}
          activeDayIndex={weekKey === todayWeekKey ? todayDayIndex : null}
        />
      </main>

      {activeNotesEditor ? (
        <NotesDialog
          activeNotesEditor={activeNotesEditor}
          onClose={closeNotesEditor}
          onChangeNotes={updateActiveNotes}
        />
      ) : null}

      {isCalendarOpen ? (
        <CalendarNavigator
          visibleYear={visibleYear}
          months={yearMonths}
          selectedWeekKey={weekKey}
          onClose={() => setIsCalendarOpen(false)}
          onPickWeek={jumpToWeek}
          onPreviousYear={() => setVisibleYear((current) => current - 1)}
          onNextYear={() => setVisibleYear((current) => current + 1)}
        />
      ) : null}
    </div>
  );
}

type AuthScreenProps = {
  authEmail: string;
  authPassword: string;
  authMessage: string;
  isAuthLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onOAuth: (provider: 'google' | 'github') => void;
};

function AuthScreen({
  authEmail,
  authPassword,
  authMessage,
  isAuthLoading,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onSignUp,
  onOAuth,
}: AuthScreenProps) {
  return (
    <div className="auth-page">
      <section className="auth-card">
        <p className="storage-label">Dnevnik Todo Calendar</p>
        <h1 className="auth-title">Sign in to sync your weekly planner</h1>
        <p className="auth-copy">
          Your tasks, notes, and weekly spreads will be stored in Supabase and tied to your account.
        </p>

        <div className="auth-form auth-form-vertical">
          <input
            className="auth-input"
            type="email"
            value={authEmail}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="Email"
          />
          <input
            className="auth-input"
            type="password"
            value={authPassword}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Password"
          />
          <div className="auth-actions">
            <button type="button" className="nav-button" onClick={onSignIn} disabled={isAuthLoading}>
              {isAuthLoading ? 'Working...' : 'Sign in'}
            </button>
            <button type="button" className="nav-button" onClick={onSignUp} disabled={isAuthLoading}>
              Sign up
            </button>
          </div>
        </div>

        <div className="auth-divider" />

        <div className="oauth-group oauth-group-vertical">
          <button type="button" className="nav-button" onClick={() => onOAuth('google')}>
            Continue with Google
          </button>
          <button type="button" className="nav-button" onClick={() => onOAuth('github')}>
            Continue with GitHub
          </button>
        </div>

        {authMessage ? <p className="status-banner auth-status">{authMessage}</p> : null}
      </section>
    </div>
  );
}

type PageSheetProps = {
  headerLabel: string;
  days: DayData[];
  onUpdateRow: (dayKey: string, rowId: string, field: keyof TaskRow, value: string | boolean) => void;
  onAddRow: (dayKey: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  activeDayIndex: number | null;
};

function PageSheet({ headerLabel, days, onUpdateRow, onAddRow, onOpenNotes, activeDayIndex }: PageSheetProps) {
  return (
    <section className="page-sheet">
      <div className="page-header">
        <div className="page-header-top">
          <h1 className="page-month">{headerLabel}</h1>
        </div>
      </div>

      <div className="day-stack">
        {days.map((day) => (
          <DaySection
            key={day.key}
            day={day}
            onUpdateRow={onUpdateRow}
            onAddRow={onAddRow}
            onOpenNotes={onOpenNotes}
            isActive={DAY_NAMES.indexOf(day.label) === activeDayIndex}
          />
        ))}
      </div>
    </section>
  );
}

type DaySectionProps = {
  day: DayData;
  onUpdateRow: (dayKey: string, rowId: string, field: keyof TaskRow, value: string | boolean) => void;
  onAddRow: (dayKey: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  isActive: boolean;
};

function DaySection({ day, onUpdateRow, onAddRow, onOpenNotes, isActive }: DaySectionProps) {
  const dayNumber = day.date.split(' ')[1];

  return (
    <section className="day-section">
      <div className={`day-label-rail ${isActive ? 'is-active' : ''}`}>
        <div className="day-label-rail-inner">
          <p className="day-title">{day.label}</p>
          <p className="day-date">{dayNumber}</p>
        </div>
      </div>

      <div className="task-grid day-grid">
        <div className={`task-grid-head task-grid-row ${isActive ? 'is-active' : ''}`}>
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

        <button type="button" className="add-row-button" onClick={() => onAddRow(day.key)}>
          + Add row
        </button>
      </div>
    </section>
  );
}

type NotesDialogProps = {
  activeNotesEditor: ActiveNotesEditor;
  onClose: () => void;
  onChangeNotes: (notes: string) => void;
};

type CalendarNavigatorProps = {
  visibleYear: number;
  months: CalendarMonth[];
  selectedWeekKey: string;
  onClose: () => void;
  onPickWeek: (date: Date) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
};

function NotesDialog({ activeNotesEditor, onClose, onChangeNotes }: NotesDialogProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    unorderedList: false,
    block: 'body' as 'body' | 'large',
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

      let element =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as HTMLElement)
          : anchorNode.parentElement;

      let block: 'body' | 'large' = 'body';
      while (element && element !== editor) {
        if (element.tagName === 'H3') {
          block = 'large';
          break;
        }

        if (element.tagName === 'P' || element.tagName === 'DIV') {
          block = 'body';
        }

        element = element.parentElement;
      }

      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        block,
      });
    }

    document.addEventListener('selectionchange', updateActiveFormats);
    return () => document.removeEventListener('selectionchange', updateActiveFormats);
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChangeNotes(editorRef.current.innerHTML);
      editorRef.current.focus();
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
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
        </div>

        <div
          ref={editorRef}
          className="notes-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => onChangeNotes(event.currentTarget.innerHTML)}
        />

        <div className="notes-dialog-footer">
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
              •
            </button>
            <button
              type="button"
              className={`toolbar-button ${activeFormats.block === 'body' ? 'is-active' : ''}`}
              onClick={() => exec('formatBlock', '<p>')}
            >
              Body
            </button>
            <button
              type="button"
              className={`toolbar-button ${activeFormats.block === 'large' ? 'is-active' : ''}`}
              onClick={() => exec('formatBlock', '<h3>')}
            >
              Large
            </button>
          </div>
          <button type="button" className="nav-button" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

function CalendarNavigator({
  visibleYear,
  months,
  selectedWeekKey,
  onClose,
  onPickWeek,
  onPreviousYear,
  onNextYear,
}: CalendarNavigatorProps) {
  const todayKey = formatWeekKey(getMonday(new Date()));

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="calendar-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="calendar-dialog-header">
          <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={onPreviousYear} aria-label="Previous year">
            ←
          </button>
          <h2 id="calendar-dialog-title" className="dialog-title">
            {visibleYear}
          </h2>
          <div className="calendar-dialog-actions">
            <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={onNextYear} aria-label="Next year">
              →
            </button>
            <button type="button" className="nav-button nav-button-inline" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          {months.map((month) => (
            <section key={month.label} className="calendar-month">
              <h3 className="calendar-month-title">{month.label}</h3>
              <div className="calendar-weekdays">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
              <div className="calendar-weeks">
                {month.weeks.map((week) => {
                  const weekKey = formatWeekKey(getMonday(week[0]));
                  const isSelected = weekKey === selectedWeekKey;
                  const isCurrent = weekKey === todayKey;

                  return (
                    <button
                      key={weekKey}
                      type="button"
                      className={`calendar-week ${isSelected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''}`}
                      onClick={() => onPickWeek(week[0])}
                    >
                      {week.map((day) => (
                        <span
                          key={day.toISOString()}
                          className={day.getMonth() === month.monthIndex ? '' : 'is-outside-month'}
                        >
                          {day.getDate()}
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
