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

type SearchResult = {
  weekKey: string;
  dayKey: string;
  rowId: string;
  title: string;
  notesPreview: string;
  dayLabel: string;
  dateLabel: string;
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

type ThemeName = 'white' | 'paper' | 'night' | 'sepia' | 'blueprint';

const ROW_COUNT = 6;
const MAX_ROW_COUNT = 16;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STORAGE_PREFIX = 'dnevnik-week';
const THEME_STORAGE_KEY = 'dnevnik-theme';
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

function parseWeekKey(weekKey: string) {
  return new Date(`${weekKey}T00:00:00`);
}

function formatSheetRange(days: DayData[]) {
  const first = days[0];
  const last = days[days.length - 1];
  const [, ...firstDateParts] = first.key.split('-');
  const firstDate = new Date(`${firstDateParts.join('-')}T00:00:00`);
  const month = firstDate.toLocaleString('en-US', { month: 'long' });
  const firstDay = String(firstDate.getDate());
  const [, ...lastDateParts] = last.key.split('-');
  const lastDate = new Date(`${lastDateParts.join('-')}T00:00:00`);
  const lastDay = String(lastDate.getDate());
  return `${month.toUpperCase()} ${firstDay}-${lastDay}`;
}

function formatTopBarRange(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5);

  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const sameMonth = sameYear && weekStart.getMonth() === weekEnd.getMonth();

  if (sameMonth) {
    return `${weekStart.toLocaleDateString('en-US', { month: 'long' })} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  }

  if (sameYear) {
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${weekEnd.toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  )}`;
}

function getUserDisplayName(user: User | null) {
  if (!user) {
    return 'Planner Settings';
  }

  const metadataName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    (typeof user.user_metadata?.user_name === 'string' && user.user_metadata.user_name);

  return metadataName || user.email || 'Signed in user';
}

function getPlannerTitle(user: User | null) {
  const displayName = getUserDisplayName(user);
  const firstSegment = displayName.split(/[\s@._-]+/).find(Boolean);

  if (!user || !firstSegment) {
    return 'Weekly Planner';
  }

  const normalizedName = firstSegment.slice(0, 1).toUpperCase() + firstSegment.slice(1);
  const suffix = normalizedName.endsWith('s') ? "'" : "'s";

  return `${normalizedName}${suffix} Weekly Planner`;
}

function getUserAvatarUrl(user: User | null) {
  if (!user) {
    return '';
  }

  const avatarUrl =
    (typeof user.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url) ||
    (typeof user.user_metadata?.picture === 'string' && user.user_metadata.picture);

  return avatarUrl || '';
}

function getUserInitials(user: User | null) {
  const label = getUserDisplayName(user);
  const parts = label
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return 'DN';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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

function buildActivityMap(savedWeeks: Record<string, Record<string, TaskRow[]>>) {
  const activity = new Map<string, number>();

  for (const week of Object.values(savedWeeks)) {
    for (const [dayKey, rows] of Object.entries(week)) {
      const dateKey = dayKey.split('-').slice(1).join('-');
      const count = rows.reduce((total, row) => {
        return row.title.trim() !== '' || row.notes.trim() !== '' || row.completed ? total + 1 : total;
      }, 0);

      if (count > 0) {
        activity.set(dateKey, count);
      }
    }
  }

  return activity;
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

function buildSearchResults(savedWeeks: Record<string, Record<string, TaskRow[]>>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const [weekKey, week] of Object.entries(savedWeeks)) {
    for (const [dayKey, rows] of Object.entries(week)) {
      const weekday = dayKey.split('-')[0];
      const date = dayKey.split('-').slice(1).join('-');
      const labelDate = new Date(`${date}T00:00:00`);
      const dayLabel = `${weekday[0].toUpperCase()}${weekday.slice(1)}`;
      const dateLabel = labelDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      for (const row of rows) {
        const notesPreview = getNotePreview(row.notes);
        const haystack = `${row.title} ${notesPreview}`.toLowerCase();

        if (!haystack.includes(normalizedQuery)) {
          continue;
        }

        results.push({
          weekKey,
          dayKey,
          rowId: row.id,
          title: row.title || 'Untitled task',
          notesPreview,
          dayLabel,
          dateLabel,
        });
      }
    }
  }

  return results.slice(0, 24);
}

function App() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [savedWeeks, setSavedWeeks] = useState<Record<string, Record<string, TaskRow[]>>>({});
  const [activeNotesEditor, setActiveNotesEditor] = useState<ActiveNotesEditor | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (
      savedTheme === 'white' ||
      savedTheme === 'paper' ||
      savedTheme === 'night' ||
      savedTheme === 'sepia' ||
      savedTheme === 'blueprint'
    ) {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
  });
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [showWeekLoadingBanner, setShowWeekLoadingBanner] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() => new Date().getFullYear());
  const [hasHydratedLocalCache, setHasHydratedLocalCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const weekKey = formatWeekKey(weekStart);
  const yearMonths = useMemo(
    () => MONTH_NAMES.map((_, monthIndex) => getMonthCalendar(visibleYear, monthIndex)),
    [visibleYear],
  );
  const activityMap = useMemo(() => buildActivityMap(savedWeeks), [savedWeeks]);
  const searchResults = useMemo(() => buildSearchResults(savedWeeks, searchQuery), [savedWeeks, searchQuery]);
  const topBarRange = useMemo(() => formatTopBarRange(weekStart), [weekStart]);
  const userDisplayName = useMemo(() => getUserDisplayName(user), [user]);
  const userAvatarUrl = useMemo(() => getUserAvatarUrl(user), [user]);
  const userInitials = useMemo(() => getUserInitials(user), [user]);
  const plannerTitle = useMemo(() => getPlannerTitle(user), [user]);

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isWeekLoading) {
      setShowWeekLoadingBanner(false);
      return;
    }

    const timeout = window.setTimeout(() => setShowWeekLoadingBanner(true), 250);
    return () => window.clearTimeout(timeout);
  }, [isWeekLoading]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  async function syncDayRows(dayKey: string, rows: TaskRow[]) {
    if (!supabase || !user) {
      return;
    }

    const dayIndex = getDayIndex(dayKey);
    if (dayIndex < 0) {
      return;
    }

    const client = supabase;
    const activeUser = user;

    const { error: deleteError } = await client
      .from('tasks')
      .delete()
      .eq('user_id', activeUser.id)
      .eq('week_start', weekKey)
      .eq('day_index', dayIndex);

    if (deleteError) {
      setStorageError(deleteError.message);
      return;
    }

    const populatedRows = rows
      .map((row, rowIndex) => ({
        user_id: activeUser.id,
        week_start: weekKey,
        day_index: dayIndex,
        row_index: rowIndex,
        title: row.title,
        notes: row.notes,
        completed: row.completed,
      }))
      .filter((row) => row.title.trim() !== '' || row.notes.trim() !== '' || row.completed);

    if (populatedRows.length === 0) {
      return;
    }

    const { error: insertError } = await client.from('tasks').insert(populatedRows);

    if (insertError) {
      setStorageError(insertError.message);
    }
  }

  function addRow(dayKey: string) {
    setSavedWeeks((current) => {
      const currentWeek = current[weekKey] ?? {};
      const currentRows = currentWeek[dayKey] ?? createEmptyRows(dayKey);

      if (currentRows.length >= MAX_ROW_COUNT) {
        return current;
      }

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

  function deleteRow(dayKey: string, rowId: string) {
    const currentWeek = savedWeeks[weekKey] ?? {};
    const currentRows = currentWeek[dayKey] ?? createEmptyRows(dayKey);

    if (currentRows.length <= ROW_COUNT) {
      return;
    }

    const filteredRows = currentRows.filter((row) => row.id !== rowId);
    const remainingRows = filteredRows.map((row, index) => ({
      ...createEmptyRow(dayKey, index),
      title: row.title,
      notes: row.notes,
      completed: row.completed,
    }));

    setSavedWeeks((current) => {
      const week = current[weekKey] ?? {};
      const nextState = {
        ...current,
        [weekKey]: {
          ...week,
          [dayKey]: remainingRows,
        },
      };

      window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(nextState));
      return nextState;
    });

    if (supabase && user) {
      void syncDayRows(dayKey, remainingRows);
    }
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

  function jumpToSearchResult(result: SearchResult) {
    setWeekStart(parseWeekKey(result.weekKey));
    setActiveSearchRowId(result.rowId);
    setSearchQuery('');
  }

  useEffect(() => {
    if (!activeSearchRowId) {
      return;
    }

    const timeout = window.setTimeout(() => setActiveSearchRowId(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [activeSearchRowId]);

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
      {authMessage ? <p className="status-banner">{authMessage}</p> : null}
      {storageError ? <p className="status-banner status-banner-error">{storageError}</p> : null}
      {showWeekLoadingBanner ? <p className="status-banner">Loading this week from Supabase...</p> : null}

      <header className="top-actions">
        <div className="top-toolbar">
          <div className="top-toolbar-summary">
            <div>
              <h2 className="top-toolbar-title">{plannerTitle}</h2>
              <p className="top-toolbar-range">{topBarRange}</p>
            </div>
          </div>

          <div className="top-toolbar-controls">
            <div className="top-toolbar-group" aria-label="Week navigation">
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

            <div className="search-shell">
              <input
                className="search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tasks and notes"
                aria-label="Search tasks and notes"
              />
              {searchQuery.trim() ? (
                <div className="search-results">
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={`${result.rowId}-${result.weekKey}`}
                        type="button"
                        className="search-result"
                        onClick={() => jumpToSearchResult(result)}
                      >
                        <span className="search-result-title">{result.title}</span>
                        <span className="search-result-meta">
                          {result.dayLabel} · {result.dateLabel}
                        </span>
                        {result.notesPreview ? <span className="search-result-preview">{result.notesPreview}</span> : null}
                      </button>
                    ))
                  ) : (
                    <div className="search-empty">No matching tasks</div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="top-toolbar-group" aria-label="Planner actions">
              <button type="button" className="nav-button" onClick={() => setIsCalendarOpen(true)}>
                Calendar
              </button>
            </div>

            <div className="account-menu-shell" ref={accountMenuRef}>
              <button
                type="button"
                className={`account-trigger ${isAccountMenuOpen ? 'is-open' : ''}`}
                onClick={() => setIsAccountMenuOpen((current) => !current)}
                aria-label="Open account and settings"
                aria-expanded={isAccountMenuOpen}
              >
                {userAvatarUrl ? (
                  <img className="account-trigger-image" src={userAvatarUrl} alt={userDisplayName} />
                ) : (
                  <span>{userInitials}</span>
                )}
              </button>

              {isAccountMenuOpen ? (
                <div className="account-menu-panel" role="menu" aria-label="Account and settings">
                  <div className="account-menu-header">
                    <div className="account-menu-avatar">
                      {userAvatarUrl ? (
                        <img className="account-trigger-image" src={userAvatarUrl} alt={userDisplayName} />
                      ) : (
                        <span>{userInitials}</span>
                      )}
                    </div>
                    <div>
                      <p className="account-menu-label">{isSupabaseConfigured ? 'Cloud Mode' : 'Local Mode'}</p>
                      <p className="account-menu-title">{userDisplayName}</p>
                      <p className="account-menu-copy">
                        {isSupabaseConfigured
                          ? user?.email ?? user?.id ?? 'Connected account'
                          : 'Add Supabase env vars to enable cloud sync.'}
                      </p>
                    </div>
                  </div>

                  <div className="account-menu-section">
                    <label className="account-menu-field">
                      <span className="top-toolbar-group-label">Theme</span>
                      <select className="theme-select" value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)} aria-label="Theme">
                        <option value="white">White</option>
                        <option value="paper">Paper</option>
                        <option value="night">Night</option>
                        <option value="sepia">Sepia</option>
                        <option value="blueprint">Blueprint</option>
                      </select>
                    </label>
                  </div>

                  {isSupabaseConfigured && user ? (
                    <div className="account-menu-section">
                      <button type="button" className="nav-button account-menu-action" onClick={signOut}>
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="spread">
        <PageSheet
          headerLabel={formatSheetRange(leftPage)}
          days={leftPage}
          onUpdateRow={updateRow}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          onOpenNotes={openNotesEditor}
          activeDayIndex={weekKey === todayWeekKey ? todayDayIndex : null}
          activeSearchRowId={activeSearchRowId}
        />
        <PageSheet
          headerLabel={formatSheetRange(rightPage)}
          days={rightPage}
          onUpdateRow={updateRow}
          onAddRow={addRow}
          onDeleteRow={deleteRow}
          onOpenNotes={openNotesEditor}
          activeDayIndex={weekKey === todayWeekKey ? todayDayIndex : null}
          activeSearchRowId={activeSearchRowId}
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
          activityMap={activityMap}
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
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  activeDayIndex: number | null;
  activeSearchRowId: string | null;
};

function PageSheet({
  headerLabel,
  days,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
  onOpenNotes,
  activeDayIndex,
  activeSearchRowId,
}: PageSheetProps) {
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
            onDeleteRow={onDeleteRow}
            onOpenNotes={onOpenNotes}
            isActive={DAY_NAMES.indexOf(day.label) === activeDayIndex}
            activeSearchRowId={activeSearchRowId}
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
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  isActive: boolean;
  activeSearchRowId: string | null;
};

function DaySection({ day, onUpdateRow, onAddRow, onDeleteRow, onOpenNotes, isActive, activeSearchRowId }: DaySectionProps) {
  const dayNumber = day.date.split(' ')[1];
  const hasReachedRowLimit = day.rows.length >= MAX_ROW_COUNT;

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
          <span>Del</span>
        </div>

        {day.rows.map((row, index) => (
          <div key={row.id} className={`task-grid-row ${activeSearchRowId === row.id ? 'is-search-hit' : ''}`}>
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
            <button
              type="button"
              className="delete-row-button"
              onClick={() => onDeleteRow(day.key, row.id)}
              disabled={day.rows.length <= ROW_COUNT}
              aria-label={`Delete row ${index + 1}`}
            >
              ×
            </button>
          </div>
        ))}

        <button type="button" className="add-row-button" onClick={() => onAddRow(day.key)} disabled={hasReachedRowLimit}>
          {hasReachedRowLimit ? `Row limit reached (${MAX_ROW_COUNT})` : '+ Add row'}
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
  activityMap: Map<string, number>;
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
  activityMap,
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
                  const weekActivity = week.reduce(
                    (total, day) => total + (activityMap.get(day.toISOString().slice(0, 10)) ?? 0),
                    0,
                  );

                  return (
                    <button
                      key={weekKey}
                      type="button"
                      className={`calendar-week ${isSelected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''} ${
                        weekActivity > 0 ? 'has-activity' : ''
                      }`}
                      onClick={() => onPickWeek(week[0])}
                    >
                      {week.map((day) => {
                        const dateKey = day.toISOString().slice(0, 10);
                        const activity = activityMap.get(dateKey) ?? 0;
                        const intensity =
                          activity >= 6 ? 'activity-4' : activity >= 4 ? 'activity-3' : activity >= 2 ? 'activity-2' : activity >= 1 ? 'activity-1' : '';

                        return (
                          <span
                            key={day.toISOString()}
                            className={`${day.getMonth() === month.monthIndex ? '' : 'is-outside-month'} ${intensity}`.trim()}
                          >
                            {day.getDate()}
                          </span>
                        );
                      })}
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
