import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

type TaskRow = {
  id: string;
  title: string;
  notes: string;
  status: RowStatus;
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
  status: RowStatus;
};

type LegacyTaskRecord = {
  user_id: string;
  week_start: string;
  day_index: number;
  row_index: number;
  title: string;
  notes: string;
  completed: boolean;
};

type ThemeName = 'white' | 'paper' | 'night' | 'sepia' | 'blueprint';
type LanguageCode = 'en' | 'ru';
type RowStatus = 'none' | 'low' | 'urgent' | 'critical' | 'done';

const ROW_COUNT = 6;
const MAX_ROW_COUNT = 16;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STORAGE_PREFIX = 'dnevnik-week';
const THEME_STORAGE_KEY = 'dnevnik-theme';
const LANGUAGE_STORAGE_KEY = 'dnevnik-language';
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

const UI_TEXT = {
  en: {
    plannerSettings: 'Planner Settings',
    signedInUser: 'Signed in user',
    weeklyPlanner: 'Weekly Planner',
    loadingWeek: 'Loading this week from Supabase...',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    today: 'Today',
    calendar: 'Calendar',
    searchPlaceholder: 'Search tasks and notes',
    noMatchingTasks: 'No matching tasks',
    openAccount: 'Open account and settings',
    accountSettings: 'Account and settings',
    cloudMode: 'Cloud Mode',
    localMode: 'Local Mode',
    connectedAccount: 'Connected account',
    enableCloudSync: 'Add Supabase env vars to enable cloud sync.',
    theme: 'Theme',
    language: 'Language',
    languageNote: 'Interface language only. Your tasks and notes stay unchanged.',
    languageEnglish: 'English',
    languageRussian: 'Russian',
    themeWhite: 'White',
    themePaper: 'Paper',
    themeNight: 'Night',
    themeSepia: 'Sepia',
    themeBlueprint: 'Blueprint',
    signOut: 'Sign out',
    appName: 'Dnevnik Todo Calendar',
    authTitle: 'Sign in to sync your weekly planner',
    authCopy: 'Your tasks, notes, and weekly spreads will be stored in Supabase and tied to your account.',
    email: 'Email',
    password: 'Password',
    working: 'Working...',
    signIn: 'Sign in',
    signUp: 'Sign up',
    continueWithGoogle: 'Continue with Google',
    continueWithGithub: 'Continue with GitHub',
    signedInAs: (email: string) => `Signed in as ${email}.`,
    accountCreated: (email: string) => `Account created for ${email}. Check your email if confirmation is required.`,
    task: 'Task',
    notes: 'Notes',
    status: 'Status',
    done: 'Done',
    del: 'Del',
    statusSet: 'Set',
    statusSortLabel: 'Status',
    statusSortManual: 'Manual',
    statusSortUrgency: 'Urgency',
    statusSortAria: 'Toggle status sorting',
    statusLow: 'Low',
    statusUrgent: 'Urgent',
    statusCritical: 'Critical',
    statusDone: 'Done',
    deleteRow: (index: number) => `Delete row ${index}`,
    addRow: '+ Add row',
    rowLimitReached: (limit: number) => `Row limit reached (${limit})`,
    taskNotes: 'Task Notes',
    untitledTask: 'Untitled task',
    body: 'Body',
    large: 'Large',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    close: 'Close',
  },
  ru: {
    plannerSettings: 'Настройки планера',
    signedInUser: 'Пользователь',
    weeklyPlanner: 'Еженедельник',
    loadingWeek: 'Загрузка недели из Supabase...',
    previousWeek: 'Предыдущая неделя',
    nextWeek: 'Следующая неделя',
    today: 'Сегодня',
    calendar: 'Календарь',
    searchPlaceholder: 'Поиск по задачам и заметкам',
    noMatchingTasks: 'Ничего не найдено',
    openAccount: 'Открыть аккаунт и настройки',
    accountSettings: 'Аккаунт и настройки',
    cloudMode: 'Облако',
    localMode: 'Локально',
    connectedAccount: 'Подключенный аккаунт',
    enableCloudSync: 'Добавьте переменные Supabase, чтобы включить облачную синхронизацию.',
    theme: 'Тема',
    language: 'Язык',
    languageNote: 'Меняется только интерфейс. Задачи и заметки остаются без изменений.',
    languageEnglish: 'English',
    languageRussian: 'Русский',
    themeWhite: 'Белая',
    themePaper: 'Бумага',
    themeNight: 'Ночь',
    themeSepia: 'Сепия',
    themeBlueprint: 'Чертеж',
    signOut: 'Выйти',
    appName: 'Dnevnik Todo Calendar',
    authTitle: 'Войдите, чтобы синхронизировать ваш еженедельник',
    authCopy: 'Ваши задачи, заметки и недельные развороты будут храниться в Supabase и привязаны к аккаунту.',
    email: 'Почта',
    password: 'Пароль',
    working: 'Загрузка...',
    signIn: 'Войти',
    signUp: 'Регистрация',
    continueWithGoogle: 'Продолжить через Google',
    continueWithGithub: 'Продолжить через GitHub',
    signedInAs: (email: string) => `Вы вошли как ${email}.`,
    accountCreated: (email: string) => `Аккаунт для ${email} создан. Проверьте почту, если требуется подтверждение.`,
    task: 'Задача',
    notes: 'Заметки',
    status: 'Статус',
    done: 'Сделано',
    del: 'Удал.',
    statusSet: 'Выбрать',
    statusSortLabel: 'Статус',
    statusSortManual: 'Вручную',
    statusSortUrgency: 'По срочности',
    statusSortAria: 'Переключить сортировку по статусу',
    statusLow: 'Низкий',
    statusUrgent: 'Срочно',
    statusCritical: 'Критично',
    statusDone: 'Сделано',
    deleteRow: (index: number) => `Удалить строку ${index}`,
    addRow: '+ Добавить строку',
    rowLimitReached: (limit: number) => `Достигнут лимит строк (${limit})`,
    taskNotes: 'Заметки к задаче',
    untitledTask: 'Без названия',
    body: 'Обычный',
    large: 'Крупный',
    previousYear: 'Предыдущий год',
    nextYear: 'Следующий год',
    close: 'Закрыть',
  },
} as const;

const DAY_LABELS = {
  en: DAY_NAMES,
  ru: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
} satisfies Record<LanguageCode, string[]>;

const CALENDAR_WEEKDAY_LABELS = {
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  ru: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'],
} satisfies Record<LanguageCode, string[]>;

type UiText = (typeof UI_TEXT)[LanguageCode];

function getDateLocale(language: LanguageCode) {
  return language === 'ru' ? 'ru-RU' : 'en-US';
}

function getStatusLabel(status: RowStatus, ui: UiText) {
  switch (status) {
    case 'low':
      return ui.statusLow;
    case 'urgent':
      return ui.statusUrgent;
    case 'critical':
      return ui.statusCritical;
    case 'done':
      return ui.statusDone;
    default:
      return ui.statusSet;
  }
}

function getStatusSortWeight(status: RowStatus) {
  switch (status) {
    case 'critical':
      return 0;
    case 'urgent':
      return 1;
    case 'low':
      return 2;
    case 'none':
      return 3;
    case 'done':
      return 4;
    default:
      return 5;
  }
}

function createEmptyRows(dayKey: string): TaskRow[] {
  return Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: `${dayKey}-${index}`,
    title: '',
    notes: '',
    status: 'none',
  }));
}

function createEmptyRow(dayKey: string, index: number): TaskRow {
  return {
    id: `${dayKey}-${index}`,
    title: '',
    notes: '',
    status: 'none',
  };
}

function normalizeStatus(value: unknown, completed?: unknown): RowStatus {
  if (value === 'none' || value === 'low' || value === 'urgent' || value === 'critical' || value === 'done') {
    return value;
  }

  if (completed === true) {
    return 'done';
  }

  return 'none';
}

function normalizeTaskRow(row: Partial<TaskRow> & { completed?: boolean }, dayKey: string, index: number): TaskRow {
  return {
    id: typeof row.id === 'string' ? row.id : `${dayKey}-${index}`,
    title: typeof row.title === 'string' ? row.title : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    status: normalizeStatus(row.status, row.completed),
  };
}

function normalizeSavedWeeks(raw: Record<string, Record<string, Array<Partial<TaskRow> & { completed?: boolean }>>>) {
  const normalized: Record<string, Record<string, TaskRow[]>> = {};

  for (const [weekKey, week] of Object.entries(raw)) {
    normalized[weekKey] = {};

    for (const [dayKey, rows] of Object.entries(week)) {
      normalized[weekKey][dayKey] = rows.map((row, index) => normalizeTaskRow(row, dayKey, index));
    }
  }

  return normalized;
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

function formatSheetRange(days: DayData[], language: LanguageCode) {
  const first = days[0];
  const last = days[days.length - 1];
  const [, ...firstDateParts] = first.key.split('-');
  const firstDate = new Date(`${firstDateParts.join('-')}T00:00:00`);
  const month = firstDate.toLocaleString(getDateLocale(language), { month: 'long' });
  const firstDay = String(firstDate.getDate());
  const [, ...lastDateParts] = last.key.split('-');
  const lastDate = new Date(`${lastDateParts.join('-')}T00:00:00`);
  const lastDay = String(lastDate.getDate());
  return `${month.toUpperCase()} ${firstDay}-${lastDay}`;
}

function formatTopBarRange(weekStart: Date, language: LanguageCode) {
  const locale = getDateLocale(language);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5);

  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const sameMonth = sameYear && weekStart.getMonth() === weekEnd.getMonth();

  if (sameMonth) {
    return `${weekStart.toLocaleDateString(locale, { month: 'long' })} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  }

  if (sameYear) {
    return `${weekStart.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  return `${weekStart.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })} - ${weekEnd.toLocaleDateString(
    locale,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  )}`;
}

function getUserDisplayName(user: User | null) {
  if (!user) {
    return UI_TEXT.en.plannerSettings;
  }

  const metadataName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    (typeof user.user_metadata?.user_name === 'string' && user.user_metadata.user_name);

  return metadataName || user.email || UI_TEXT.en.signedInUser;
}

function getPlannerTitle(user: User | null, language: LanguageCode) {
  const displayName = getUserDisplayName(user);
  const firstSegment = displayName.split(/[\s@._-]+/).find(Boolean);

  if (!user || !firstSegment) {
    return UI_TEXT[language].weeklyPlanner;
  }

  const normalizedName = firstSegment.slice(0, 1).toUpperCase() + firstSegment.slice(1);
  const suffix = normalizedName.endsWith('s') ? "'" : "'s";

  return `${normalizedName}${suffix} ${UI_TEXT[language].weeklyPlanner}`;
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

function getMonthCalendar(year: number, month: number, language: LanguageCode): CalendarMonth {
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
    label: new Date(year, month, 1).toLocaleString(getDateLocale(language), { month: 'long' }),
    weeks,
  };
}

function buildDays(monday: Date, saved: Record<string, TaskRow[]>, language: LanguageCode): DayData[] {
  return DAY_NAMES.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = `${label.toLowerCase()}-${date.toISOString().slice(0, 10)}`;
    const rows = saved[key] ?? createEmptyRows(key);

    return {
      key,
      label: DAY_LABELS[language][index],
      date: date.toLocaleString(getDateLocale(language), {
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
  return row.title.trim() === '' && row.notes.trim() === '' && row.status === 'none';
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
      status: normalizeStatus(record.status),
    };
  }

  return mapped;
}

function hasAnyTaskContent(week: Record<string, TaskRow[]> | undefined) {
  if (!week) {
    return false;
  }

  return Object.values(week).some((rows) =>
    rows.some((row) => row.title.trim() !== '' || row.notes.trim() !== '' || row.status !== 'none'),
  );
}

function buildActivityMap(savedWeeks: Record<string, Record<string, TaskRow[]>>) {
  const activity = new Map<string, number>();

  for (const week of Object.values(savedWeeks)) {
    for (const [dayKey, rows] of Object.entries(week)) {
      const dateKey = dayKey.split('-').slice(1).join('-');
      const count = rows.reduce((total, row) => {
        return row.title.trim() !== '' || row.notes.trim() !== '' || row.status !== 'none' ? total + 1 : total;
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

function buildSearchResults(savedWeeks: Record<string, Record<string, TaskRow[]>>, query: string, language: LanguageCode) {
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
      const dayIndex = DAY_NAMES.findIndex((dayName) => dayName.toLowerCase() === weekday);
      const dayLabel =
        dayIndex >= 0 ? DAY_LABELS[language][dayIndex] : `${weekday[0].toUpperCase()}${weekday.slice(1)}`;
      const dateLabel = labelDate.toLocaleDateString(getDateLocale(language), {
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
          title: row.title || UI_TEXT[language].untitledTask,
          notesPreview,
          dayLabel,
          dateLabel,
        });
      }
    }
  }

  return results.slice(0, 24);
}

function getActiveDayIndexForWeek(weekKey: string, todayWeekKey: string, todayDayIndex: number) {
  return weekKey === todayWeekKey ? todayDayIndex : null;
}

function App() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [savedWeeks, setSavedWeeks] = useState<Record<string, Record<string, TaskRow[]>>>({});
  const [activeNotesEditor, setActiveNotesEditor] = useState<ActiveNotesEditor | null>(null);
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return savedLanguage === 'ru' ? 'ru' : 'en';
  });
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
  const [usesLegacyCompletedColumn, setUsesLegacyCompletedColumn] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() => new Date().getFullYear());
  const [hasHydratedLocalCache, setHasHydratedLocalCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);
  const [pageTurn, setPageTurn] = useState<{ weekStart: Date; direction: 'forward' | 'backward' } | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const previousWeekStartRef = useRef(weekStart);
  const ui = UI_TEXT[language];
  const weekKey = formatWeekKey(weekStart);
  const yearMonths = useMemo(
    () => MONTH_NAMES.map((_, monthIndex) => getMonthCalendar(visibleYear, monthIndex, language)),
    [visibleYear, language],
  );
  const activityMap = useMemo(() => buildActivityMap(savedWeeks), [savedWeeks]);
  const searchResults = useMemo(() => buildSearchResults(savedWeeks, searchQuery, language), [savedWeeks, searchQuery, language]);
  const topBarRange = useMemo(() => formatTopBarRange(weekStart, language), [weekStart, language]);
  const userDisplayName = useMemo(() => getUserDisplayName(user), [user]);
  const userAvatarUrl = useMemo(() => getUserAvatarUrl(user), [user]);
  const userInitials = useMemo(() => getUserInitials(user), [user]);
  const plannerTitle = useMemo(() => getPlannerTitle(user, language), [user, language]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_PREFIX);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, Record<string, Array<Partial<TaskRow> & { completed?: boolean }>>>;
        setSavedWeeks(normalizeSavedWeeks(parsed));
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
      let data: TaskRecord[] | null = null;
      let error: { message: string } | null = null;

      if (usesLegacyCompletedColumn) {
        const legacyResult = await client
          .from('tasks')
          .select('user_id, week_start, day_index, row_index, title, notes, completed')
          .eq('user_id', activeUser.id)
          .eq('week_start', weekKey)
          .order('day_index', { ascending: true })
          .order('row_index', { ascending: true });

        error = legacyResult.error;
        data = (legacyResult.data ?? []).map((record) => ({
          ...record,
          status: normalizeStatus(undefined, (record as LegacyTaskRecord).completed),
        })) as TaskRecord[];
      } else {
        const statusResult = await client
          .from('tasks')
          .select('user_id, week_start, day_index, row_index, title, notes, status')
          .eq('user_id', activeUser.id)
          .eq('week_start', weekKey)
          .order('day_index', { ascending: true })
          .order('row_index', { ascending: true });

        error = statusResult.error;
        data = (statusResult.data ?? []) as TaskRecord[];

        if (error?.message.includes('column tasks.status does not exist')) {
          const legacyResult = await client
            .from('tasks')
            .select('user_id, week_start, day_index, row_index, title, notes, completed')
            .eq('user_id', activeUser.id)
            .eq('week_start', weekKey)
            .order('day_index', { ascending: true })
            .order('row_index', { ascending: true });

          error = legacyResult.error;
          data = (legacyResult.data ?? []).map((record) => ({
            ...record,
            status: normalizeStatus(undefined, (record as LegacyTaskRecord).completed),
          })) as TaskRecord[];
          setUsesLegacyCompletedColumn(true);
        }
      }

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
              ? mapRecordsToWeek(weekStart, data ?? [])
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
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

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
    return buildDays(weekStart, savedWeeks[weekKey] ?? {}, language);
  }, [savedWeeks, weekKey, weekStart, language]);

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
  const outgoingWeekKey = pageTurn ? formatWeekKey(pageTurn.weekStart) : '';
  const outgoingDays = useMemo(() => {
    if (!pageTurn) {
      return [];
    }

    return buildDays(pageTurn.weekStart, savedWeeks[outgoingWeekKey] ?? {}, language);
  }, [language, outgoingWeekKey, pageTurn, savedWeeks]);
  const outgoingLeftPage = outgoingDays.slice(0, 3);
  const outgoingRightPage = outgoingDays.slice(3);

  useEffect(() => {
    const previousWeekStart = previousWeekStartRef.current;

    if (formatWeekKey(previousWeekStart) === weekKey) {
      return;
    }

    setPageTurn({
      weekStart: previousWeekStart,
      direction: weekStart.getTime() > previousWeekStart.getTime() ? 'forward' : 'backward',
    });
    previousWeekStartRef.current = weekStart;

    const timeout = window.setTimeout(() => setPageTurn(null), 280);
    return () => window.clearTimeout(timeout);
  }, [weekKey, weekStart]);

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

    const payload = {
      user_id: user.id,
      week_start: weekKey,
      day_index: dayIndex,
      row_index: rowIndex,
      title: row.title,
      notes: row.notes,
    };

    const { error } = usesLegacyCompletedColumn
      ? await supabase.from('tasks').upsert(
          {
            ...payload,
            completed: row.status === 'done',
          },
          {
            onConflict: 'user_id,week_start,day_index,row_index',
          },
        )
      : await supabase.from('tasks').upsert(
          {
            ...payload,
            status: row.status,
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
        ...(usesLegacyCompletedColumn
          ? { completed: row.status === 'done' }
          : { status: row.status }),
      }))
      .filter((row) => row.title.trim() !== '' || row.notes.trim() !== '' || ('status' in row ? row.status !== 'none' : row.completed));

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
      status: row.status,
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

  function updateRow(dayKey: string, rowId: string, field: keyof TaskRow, value: string) {
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
      setAuthMessage(ui.signedInAs(authEmail.trim()));
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
      setAuthMessage(ui.accountCreated(authEmail.trim()));
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
        ui={ui}
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
      {showWeekLoadingBanner ? <p className="status-banner">{ui.loadingWeek}</p> : null}

      <header className="top-actions">
        <div className="top-toolbar">
          <div className="top-toolbar-controls">
            <div>
              <h2 className="top-toolbar-title">{plannerTitle}</h2>
              <p className="top-toolbar-range">{topBarRange}</p>
            </div>

            <div className="top-toolbar-group" aria-label="Week navigation">
              <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={() => moveWeek(-1)} aria-label={ui.previousWeek}>
                ←
              </button>
              <button type="button" className="nav-button nav-button-primary" onClick={resetToCurrentWeek}>
                {ui.today}
              </button>
              <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={() => moveWeek(1)} aria-label={ui.nextWeek}>
                →
              </button>
            </div>

            <div className="top-toolbar-group" aria-label="Planner actions">
              <button type="button" className="nav-button" onClick={() => setIsCalendarOpen(true)}>
                {ui.calendar}
              </button>
            </div>
          </div>

          <div className="top-toolbar-summary">
            <div className="search-shell">
              <input
                className="search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={ui.searchPlaceholder}
                aria-label={ui.searchPlaceholder}
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
                    <div className="search-empty">{ui.noMatchingTasks}</div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="account-menu-shell" ref={accountMenuRef}>
              <button
                type="button"
                className={`account-trigger ${isAccountMenuOpen ? 'is-open' : ''}`}
                onClick={() => setIsAccountMenuOpen((current) => !current)}
                aria-label={ui.openAccount}
                aria-expanded={isAccountMenuOpen}
              >
                {userAvatarUrl ? (
                  <img className="account-trigger-image" src={userAvatarUrl} alt={userDisplayName} />
                ) : (
                  <span>{userInitials}</span>
                )}
              </button>

              {isAccountMenuOpen ? (
                <div className="account-menu-panel" role="menu" aria-label={ui.accountSettings}>
                  <div className="account-menu-header">
                    <div className="account-menu-avatar">
                      {userAvatarUrl ? (
                        <img className="account-trigger-image" src={userAvatarUrl} alt={userDisplayName} />
                      ) : (
                        <span>{userInitials}</span>
                      )}
                    </div>
                    <div>
                      <p className="account-menu-label">{isSupabaseConfigured ? ui.cloudMode : ui.localMode}</p>
                      <p className="account-menu-title">{userDisplayName}</p>
                      <p className="account-menu-copy">
                        {isSupabaseConfigured
                          ? user?.email ?? user?.id ?? ui.connectedAccount
                          : ui.enableCloudSync}
                      </p>
                    </div>
                  </div>

                  <div className="account-menu-section">
                    <label className="account-menu-field">
                      <span className="top-toolbar-group-label">{ui.theme}</span>
                      <select className="theme-select" value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)} aria-label={ui.theme}>
                        <option value="white">{ui.themeWhite}</option>
                        <option value="paper">{ui.themePaper}</option>
                        <option value="night">{ui.themeNight}</option>
                        <option value="sepia">{ui.themeSepia}</option>
                        <option value="blueprint">{ui.themeBlueprint}</option>
                      </select>
                    </label>
                  </div>

                  <div className="account-menu-section">
                    <label className="account-menu-field">
                      <span className="top-toolbar-group-label">{ui.language}</span>
                      <select className="theme-select" value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)} aria-label={ui.language}>
                        <option value="en">{ui.languageEnglish}</option>
                        <option value="ru">{ui.languageRussian}</option>
                      </select>
                      <span className="account-menu-copy">{ui.languageNote}</span>
                    </label>
                  </div>

                  {isSupabaseConfigured && user ? (
                    <div className="account-menu-section">
                      <button type="button" className="nav-button account-menu-action" onClick={signOut}>
                        {ui.signOut}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="spread-stage">
        {pageTurn ? (
          <div className={`spread spread-turn-layer spread-outgoing is-${pageTurn.direction}`} aria-hidden="true">
            <PageSheet
              headerLabel={formatSheetRange(outgoingLeftPage, language)}
              days={outgoingLeftPage}
              ui={ui}
              onUpdateRow={updateRow}
              onAddRow={addRow}
              onDeleteRow={deleteRow}
              onOpenNotes={openNotesEditor}
              activeDayIndex={getActiveDayIndexForWeek(outgoingWeekKey, todayWeekKey, todayDayIndex)}
              activeSearchRowId={activeSearchRowId}
            />
            <PageSheet
              headerLabel={formatSheetRange(outgoingRightPage, language)}
              days={outgoingRightPage}
              ui={ui}
              onUpdateRow={updateRow}
              onAddRow={addRow}
              onDeleteRow={deleteRow}
              onOpenNotes={openNotesEditor}
              activeDayIndex={getActiveDayIndexForWeek(outgoingWeekKey, todayWeekKey, todayDayIndex)}
              activeSearchRowId={activeSearchRowId}
            />
          </div>
        ) : null}

        <div className={`spread spread-current ${pageTurn ? `is-turning is-${pageTurn.direction}` : ''}`}>
          <PageSheet
            headerLabel={formatSheetRange(leftPage, language)}
            days={leftPage}
            ui={ui}
            onUpdateRow={updateRow}
            onAddRow={addRow}
            onDeleteRow={deleteRow}
            onOpenNotes={openNotesEditor}
            activeDayIndex={getActiveDayIndexForWeek(weekKey, todayWeekKey, todayDayIndex)}
            activeSearchRowId={activeSearchRowId}
          />
          <PageSheet
            headerLabel={formatSheetRange(rightPage, language)}
            days={rightPage}
            ui={ui}
            onUpdateRow={updateRow}
            onAddRow={addRow}
            onDeleteRow={deleteRow}
            onOpenNotes={openNotesEditor}
            activeDayIndex={getActiveDayIndexForWeek(weekKey, todayWeekKey, todayDayIndex)}
            activeSearchRowId={activeSearchRowId}
          />
        </div>
      </main>

      {activeNotesEditor ? (
        <NotesDialog
          activeNotesEditor={activeNotesEditor}
          ui={ui}
          onClose={closeNotesEditor}
          onChangeNotes={updateActiveNotes}
        />
      ) : null}

      {isCalendarOpen ? (
        <CalendarNavigator
          language={language}
          ui={ui}
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
  ui: UiText;
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
  ui,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onSignUp,
  onOAuth,
}: AuthScreenProps) {
  return (
    <div className="auth-page">
      <section className="auth-card">
        <p className="storage-label">{ui.appName}</p>
        <h1 className="auth-title">{ui.authTitle}</h1>
        <p className="auth-copy">{ui.authCopy}</p>

        <div className="auth-form auth-form-vertical">
          <input
            className="auth-input"
            type="email"
            value={authEmail}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder={ui.email}
          />
          <input
            className="auth-input"
            type="password"
            value={authPassword}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder={ui.password}
          />
          <div className="auth-actions">
            <button type="button" className="nav-button" onClick={onSignIn} disabled={isAuthLoading}>
              {isAuthLoading ? ui.working : ui.signIn}
            </button>
            <button type="button" className="nav-button" onClick={onSignUp} disabled={isAuthLoading}>
              {ui.signUp}
            </button>
          </div>
        </div>

        <div className="auth-divider" />

        <div className="oauth-group oauth-group-vertical">
          <button type="button" className="nav-button" onClick={() => onOAuth('google')}>
            {ui.continueWithGoogle}
          </button>
          <button type="button" className="nav-button" onClick={() => onOAuth('github')}>
            {ui.continueWithGithub}
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
  ui: UiText;
  onUpdateRow: (dayKey: string, rowId: string, field: keyof TaskRow, value: string) => void;
  onAddRow: (dayKey: string) => void;
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  activeDayIndex: number | null;
  activeSearchRowId: string | null;
};

function PageSheet({
  headerLabel,
  days,
  ui,
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
            ui={ui}
            onUpdateRow={onUpdateRow}
            onAddRow={onAddRow}
            onDeleteRow={onDeleteRow}
            onOpenNotes={onOpenNotes}
            isActive={getDayIndex(day.key) === activeDayIndex}
            activeSearchRowId={activeSearchRowId}
          />
        ))}
      </div>
    </section>
  );
}

type DaySectionProps = {
  day: DayData;
  ui: UiText;
  onUpdateRow: (dayKey: string, rowId: string, field: keyof TaskRow, value: string) => void;
  onAddRow: (dayKey: string) => void;
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  isActive: boolean;
  activeSearchRowId: string | null;
};

function DaySection({ day, ui, onUpdateRow, onAddRow, onDeleteRow, onOpenNotes, isActive, activeSearchRowId }: DaySectionProps) {
  const dateKey = day.key.split('-').slice(1).join('-');
  const dayNumber = new Date(`${dateKey}T00:00:00`).getDate();
  const hasReachedRowLimit = day.rows.length >= MAX_ROW_COUNT;
  const [sortMode, setSortMode] = useState<'manual' | 'urgency'>('manual');
  const displayedRows = useMemo(() => {
    if (sortMode === 'manual') {
      return day.rows;
    }

    return day.rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const weightDifference = getStatusSortWeight(left.row.status) - getStatusSortWeight(right.row.status);
        return weightDifference !== 0 ? weightDifference : left.index - right.index;
      })
      .map(({ row }) => row);
  }, [day.rows, sortMode]);

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
          <span>{ui.task}</span>
          <span>{ui.notes}</span>
          <button
            type="button"
            className="status-sort-button"
            onClick={() => setSortMode((current) => (current === 'manual' ? 'urgency' : 'manual'))}
            aria-label={ui.statusSortAria}
          >
            <span>{ui.statusSortLabel}</span>
            <span className="status-sort-mode">{sortMode === 'manual' ? ui.statusSortManual : ui.statusSortUrgency}</span>
          </button>
        </div>

        {displayedRows.map((row, index) => (
          <div key={row.id} className={`task-grid-row ${activeSearchRowId === row.id ? 'is-search-hit' : ''}`}>
            <div className={`row-number row-number-cell ${index === displayedRows.length - 1 ? 'is-row-actions' : ''}`}>
              <span className="row-number-label">{index + 1}</span>
              {index === displayedRows.length - 1 ? (
                <span className="row-number-actions">
                  <button
                    type="button"
                    className="row-number-action"
                    onClick={() => onAddRow(day.key)}
                    disabled={hasReachedRowLimit}
                    aria-label={ui.addRow}
                  >
                    +
                  </button>
                  {day.rows.length > ROW_COUNT ? (
                    <button
                      type="button"
                      className="row-number-action"
                      onClick={() => onDeleteRow(day.key, row.id)}
                      aria-label={ui.deleteRow(index + 1)}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ) : null}
            </div>
            <input
              className={`cell-input ${row.status === 'done' ? 'is-complete' : ''}`}
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
            <div className="status-cell">
              <select
                className={`status-select status-${row.status}`}
                value={row.status}
                onChange={(event) => onUpdateRow(day.key, row.id, 'status', event.target.value)}
                aria-label={`${ui.status}: ${getStatusLabel(row.status, ui)}`}
              >
                <option value="none">{ui.statusSet}</option>
                <option value="low">{ui.statusLow}</option>
                <option value="urgent">{ui.statusUrgent}</option>
                <option value="critical">{ui.statusCritical}</option>
                <option value="done">{ui.statusDone}</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type NotesDialogProps = {
  activeNotesEditor: ActiveNotesEditor;
  ui: UiText;
  onClose: () => void;
  onChangeNotes: (notes: string) => void;
};

type CalendarNavigatorProps = {
  language: LanguageCode;
  ui: UiText;
  visibleYear: number;
  months: CalendarMonth[];
  selectedWeekKey: string;
  activityMap: Map<string, number>;
  onClose: () => void;
  onPickWeek: (date: Date) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
};

function NotesDialog({ activeNotesEditor, ui, onClose, onChangeNotes }: NotesDialogProps) {
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
            <p className="dialog-label">{ui.taskNotes}</p>
            <h2 id="notes-dialog-title" className="dialog-title">
              {activeNotesEditor.taskTitle || ui.untitledTask}
            </h2>
          </div>
          <button type="button" className="notes-dialog-close" onClick={onClose} aria-label={ui.close}>
            ×
          </button>
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
              {ui.body}
            </button>
            <button
              type="button"
              className={`toolbar-button ${activeFormats.block === 'large' ? 'is-active' : ''}`}
              onClick={() => exec('formatBlock', '<h3>')}
            >
              {ui.large}
            </button>
          </div>
          <button type="button" className="nav-button" onClick={onClose}>
            {ui.done}
          </button>
        </div>
      </section>
    </div>
  );
}

function CalendarNavigator({
  language,
  ui,
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
          <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={onPreviousYear} aria-label={ui.previousYear}>
            ←
          </button>
          <h2 id="calendar-dialog-title" className="dialog-title">
            {visibleYear}
          </h2>
          <div className="calendar-dialog-actions">
            <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={onNextYear} aria-label={ui.nextYear}>
              →
            </button>
            <button type="button" className="nav-button nav-button-inline" onClick={onClose}>
              {ui.close}
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          {months.map((month) => (
            <section key={month.label} className="calendar-month">
              <h3 className="calendar-month-title">{month.label}</h3>
              <div className="calendar-weekdays">
                {CALENDAR_WEEKDAY_LABELS[language].map((label, index) => (
                  <span key={`${label}-${index}`}>{label}</span>
                ))}
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
