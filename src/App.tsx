import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

// A single planner row intentionally keeps both preset priority state and a free-form
// detail slot. Built-in priorities live in `status`, while custom priority/detail text
// currently reuses `time` so older Supabase schemas can still degrade gracefully.
type TaskRow = {
  id: string;
  title: string;
  notes: string;
  status: RowStatus;
  time: string;
  detailColor: DetailColor;
  priorityDismissed: boolean;
};

type MiscTask = {
  id: string;
  text: string;
};

type DraggedTaskRow = {
  dayKey: string;
  rowId: string;
};

type ActiveNotesEditor = {
  dayKey: string;
  rowId: string;
  taskTitle: string;
  notes: string;
};

type ActiveStatusEditor = {
  dayKey: string;
  rowId: string;
  status: string;
  color: DetailColor;
};

type ActivePriorityPicker = {
  dayKey: string;
  rowId: string;
  value: string;
  color: DetailColor;
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
  task_time: string;
  detail_color: DetailColor;
};

type LegacyTaskRecord = {
  user_id: string;
  week_start: string;
  day_index: number;
  row_index: number;
  title: string;
  notes: string;
  completed: boolean;
  task_time?: string;
  detail_color?: DetailColor;
};

type ThemeName = 'white' | 'paper' | 'night' | 'sepia' | 'blueprint';
type LanguageCode = 'en' | 'ru';
type RowStatus = string;
type DetailColor = 'default' | 'blue' | 'green' | 'amber' | 'pink' | 'violet';

const ROW_COUNT = 6;
const MAX_ROW_COUNT = 16;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STORAGE_PREFIX = 'dnevnik-week';
const MISC_STORAGE_PREFIX = 'dnevnik-misc';
const PLANNER_TITLE_STORAGE_KEY = 'dnevnik-planner-title';
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
    savingStatus: 'Saving...',
    savedStatus: 'Saved',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    today: 'Home',
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
    inviteOnlyAuthTitle: 'Invite-only beta access',
    inviteOnlyAuthCopy: 'Sign in with an approved Google account to open your planner. Unapproved accounts will be signed out automatically.',
    email: 'Email',
    password: 'Password',
    working: 'Working...',
    signIn: 'Sign in',
    signUp: 'Sign up',
    continueWithGoogle: 'Continue with Google',
    continueWithGithub: 'Continue with GitHub',
    inviteOnlyMessage: 'This beta is invite-only. Ask for access before signing in.',
    signedInAs: (email: string) => `Signed in as ${email}.`,
    accountCreated: (email: string) => `Account created for ${email}. Check your email if confirmation is required.`,
    task: 'Task',
    taskEnterHint: 'Open notes with Enter',
    notes: 'Notes',
    status: 'Status',
    done: 'Done',
    del: 'Del',
    statusSet: 'Set Priority',
    statusNone: 'None',
    statusCustom: 'Custom...',
    statusSortLabel: 'Priority',
    statusSortManual: 'Manual',
    statusSortUrgency: 'Urgency',
    statusSortAria: 'Toggle status sorting',
    statusLow: 'Low',
    statusUrgent: 'Urgent',
    statusCritical: 'Critical',
    statusDone: 'Done',
    priorityApply: 'Apply',
    time: 'Time',
    customStatusTitle: 'Custom detail',
    customStatusPlaceholder: 'Enter a custom detail',
    customStatusSave: 'Save',
    customStatusCancel: 'Cancel',
    detailColor: 'Color',
    colorDefault: 'Default',
    colorBlue: 'Blue',
    colorGreen: 'Green',
    colorAmber: 'Amber',
    colorPink: 'Pink',
    colorViolet: 'Violet',
    timeTitle: 'Task time',
    timeSave: 'Save time',
    timeClear: 'Clear time',
    deleteRow: (index: number) => `Delete row ${index}`,
    addRow: '+ Add row',
    rowLimitReached: (limit: number) => `Row limit reached (${limit})`,
    taskNotes: 'Task Notes',
    notesShortcutHint: 'Save and close with Cmd/Ctrl+Enter',
    untitledTask: 'Untitled task',
    body: 'Body',
    large: 'Large',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    close: 'Close',
    miscTasksTitle: 'Miscellaneous tasks',
    miscTasksPlaceholder: 'Unassigned tasks, drag them later',
    miscTasksSend: 'Add task',
    miscTasksEmpty: 'Misc tasks you add here will wait below until you assign them.',
    deleteMiscTask: 'Delete misc task',
  },
  ru: {
    plannerSettings: 'Настройки планера',
    signedInUser: 'Пользователь',
    weeklyPlanner: 'Еженедельник',
    loadingWeek: 'Загрузка недели из Supabase...',
    savingStatus: 'Сохранение...',
    savedStatus: 'Сохранено',
    previousWeek: 'Предыдущая неделя',
    nextWeek: 'Следующая неделя',
    today: 'Домой',
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
    inviteOnlyAuthTitle: 'Бета-доступ по приглашению',
    inviteOnlyAuthCopy: 'Войдите через одобренный Google-аккаунт, чтобы открыть планер. Неодобренные аккаунты будут автоматически выходить из системы.',
    email: 'Почта',
    password: 'Пароль',
    working: 'Загрузка...',
    signIn: 'Войти',
    signUp: 'Регистрация',
    continueWithGoogle: 'Продолжить через Google',
    continueWithGithub: 'Продолжить через GitHub',
    inviteOnlyMessage: 'Это закрытая бета по приглашениям. Сначала добавьте почту в список доступа.',
    signedInAs: (email: string) => `Вы вошли как ${email}.`,
    accountCreated: (email: string) => `Аккаунт для ${email} создан. Проверьте почту, если требуется подтверждение.`,
    task: 'Задача',
    taskEnterHint: 'Открыть заметки через Enter',
    notes: 'Заметки',
    status: 'Статус',
    done: 'Сделано',
    del: 'Удал.',
    statusSet: 'Задать приоритет',
    statusNone: 'Без приоритета',
    statusCustom: 'Свое...',
    statusSortLabel: 'Приоритет',
    statusSortManual: 'Вручную',
    statusSortUrgency: 'По срочности',
    statusSortAria: 'Переключить сортировку по статусу',
    statusLow: 'Низкий',
    statusUrgent: 'Срочно',
    statusCritical: 'Критично',
    statusDone: 'Сделано',
    priorityApply: 'Применить',
    time: 'Время',
    customStatusTitle: 'Своя деталь',
    customStatusPlaceholder: 'Введите свою деталь',
    customStatusSave: 'Сохранить',
    customStatusCancel: 'Отмена',
    detailColor: 'Цвет',
    colorDefault: 'Базовый',
    colorBlue: 'Синий',
    colorGreen: 'Зеленый',
    colorAmber: 'Янтарный',
    colorPink: 'Розовый',
    colorViolet: 'Фиолетовый',
    timeTitle: 'Время задачи',
    timeSave: 'Сохранить время',
    timeClear: 'Очистить время',
    deleteRow: (index: number) => `Удалить строку ${index}`,
    addRow: '+ Добавить строку',
    rowLimitReached: (limit: number) => `Достигнут лимит строк (${limit})`,
    taskNotes: 'Заметки к задаче',
    notesShortcutHint: 'Сохранить и закрыть: Cmd/Ctrl+Enter',
    untitledTask: 'Без названия',
    body: 'Обычный',
    large: 'Крупный',
    previousYear: 'Предыдущий год',
    nextYear: 'Следующий год',
    close: 'Закрыть',
    miscTasksTitle: 'Разные задачи',
    miscTasksPlaceholder: 'Неназначенные задачи, перетащите их позже',
    miscTasksSend: 'Добавить задачу',
    miscTasksEmpty: 'Задачи, которые вы добавите сюда, будут ждать внизу, пока вы их не распределите.',
    deleteMiscTask: 'Удалить задачу',
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

// Notes are edited as HTML via `contentEditable`, so we explicitly whitelist the small
// formatting subset the app supports before saving or rendering anything back to the DOM.
const ALLOWED_NOTE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'P', 'DIV', 'BR', 'H3']);

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
    case 'none':
      return ui.statusSet;
    default:
      return status;
  }
}

function getCustomDetailValue(row: TaskRow) {
  if (row.time.trim()) {
    return row.time.trim();
  }

  if (!isPresetStatus(row.status)) {
    return row.status.trim();
  }

  return '';
}

function sanitizeNoteHtml(html: string) {
  if (!html.trim()) {
    return '';
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');

  function sanitizeNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const element = node as HTMLElement;
    Array.from(element.childNodes).forEach(sanitizeNode);

    if (!ALLOWED_NOTE_TAGS.has(element.tagName)) {
      const fragment = documentNode.createDocumentFragment();
      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }
      element.replaceWith(fragment);
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      element.removeAttribute(attribute.name);
    });
  }

  Array.from(documentNode.body.childNodes).forEach(sanitizeNode);
  return documentNode.body.innerHTML;
}

function normalizeDetailColor(value: unknown): DetailColor {
  switch (value) {
    case 'blue':
    case 'green':
    case 'amber':
    case 'pink':
    case 'violet':
      return value;
    default:
      return 'default';
  }
}

function getDetailColorLabel(color: DetailColor, ui: UiText) {
  switch (color) {
    case 'blue':
      return ui.colorBlue;
    case 'green':
      return ui.colorGreen;
    case 'amber':
      return ui.colorAmber;
    case 'pink':
      return ui.colorPink;
    case 'violet':
      return ui.colorViolet;
    default:
      return ui.colorDefault;
  }
}

function createEmptyRows(dayKey: string): TaskRow[] {
  return Array.from({ length: ROW_COUNT }, (_, index) => createEmptyRow(dayKey, index));
}

function createEmptyRow(dayKey: string, index: number): TaskRow {
  return {
    id: `${dayKey}-${index}`,
    title: '',
    notes: '',
    status: 'none',
    time: '',
    detailColor: 'default',
    priorityDismissed: false,
  };
}

function normalizeStatus(value: unknown, completed?: unknown): RowStatus {
  if (value === 'none' || value === 'low' || value === 'urgent' || value === 'critical' || value === 'done') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (completed === true) {
    return 'done';
  }

  return 'none';
}

function normalizeTaskRow(row: Partial<TaskRow> & { completed?: boolean }, dayKey: string, index: number): TaskRow {
  // Browser storage and Supabase can be on different schema versions, so every row is
  // normalized into the current in-memory shape before the UI touches it.
  return {
    id: typeof row.id === 'string' ? row.id : `${dayKey}-${index}`,
    title: typeof row.title === 'string' ? row.title : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    status: normalizeStatus(row.status, row.completed),
    time:
      typeof row.time === 'string'
        ? row.time
        : typeof (row as Partial<TaskRecord>).task_time === 'string'
          ? (row as Partial<TaskRecord>).task_time ?? ''
          : '',
    detailColor:
      typeof (row as Partial<TaskRow>).detailColor === 'string'
        ? normalizeDetailColor((row as Partial<TaskRow>).detailColor)
        : normalizeDetailColor((row as Partial<TaskRecord>).detail_color),
    priorityDismissed: Boolean((row as Partial<TaskRow>).priorityDismissed),
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

function reindexRows(dayKey: string, rows: TaskRow[]) {
  return rows.map((row, index) => ({
    ...createEmptyRow(dayKey, index),
    title: row.title,
    notes: row.notes,
    status: row.status,
    time: row.time,
    detailColor: row.detailColor,
    priorityDismissed: row.priorityDismissed,
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

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekKey(monday: Date) {
  return formatDateKey(monday);
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
    const key = `${label.toLowerCase()}-${formatDateKey(date)}`;
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

function isRowEmpty(row: TaskRow) {
  return row.title.trim() === '' && row.notes.trim() === '' && row.status === 'none' && row.time.trim() === '';
}

function mapRecordsToWeek(weekStart: Date, records: TaskRecord[]) {
  const mapped: Record<string, TaskRow[]> = {};

  for (const dayLabel of DAY_NAMES) {
    const dayIndex = DAY_NAMES.indexOf(dayLabel);
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayIndex);
    const dayKey = `${dayLabel.toLowerCase()}-${formatDateKey(date)}`;
    mapped[dayKey] = createEmptyRows(dayKey);
  }

  for (const record of records) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + record.day_index);
    const dayKey = `${DAY_NAMES[record.day_index].toLowerCase()}-${formatDateKey(date)}`;

    if (!mapped[dayKey]) {
      mapped[dayKey] = createEmptyRows(dayKey);
    }

    mapped[dayKey][record.row_index] = {
      id: `${dayKey}-${record.row_index}`,
      title: record.title,
      notes: record.notes,
      status: normalizeStatus(record.status),
      time: record.task_time ?? '',
      detailColor: normalizeDetailColor(record.detail_color),
      priorityDismissed: false,
    };
  }

  return mapped;
}

function mergeLegacyDetailFields(
  nextWeek: Record<string, TaskRow[]>,
  currentWeek: Record<string, TaskRow[]> | undefined,
  preserveDetailFields: boolean,
) {
  // If the remote database is still on an older schema, a fresh cloud read can come back
  // without custom detail text/color. Preserve the richer local values until the schema
  // migration has caught up instead of silently wiping them.
  if (!preserveDetailFields || !currentWeek) {
    return nextWeek;
  }

  const merged: Record<string, TaskRow[]> = {};

  for (const [dayKey, rows] of Object.entries(nextWeek)) {
    const currentRows = currentWeek[dayKey] ?? [];

    merged[dayKey] = rows.map((row) => {
      const currentRow = currentRows.find((candidate) => candidate.id === row.id);

      if (!currentRow) {
        return row;
      }

      return {
        ...row,
        time: currentRow.time,
        detailColor: currentRow.detailColor,
        priorityDismissed: currentRow.priorityDismissed,
      };
    });
  }

  return merged;
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

function createMiscTask(text: string): MiscTask {
  return {
    id: `misc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
  };
}

function shiftWeekKeyByOffset(weekKey: string, offset: number) {
  const date = parseWeekKey(weekKey);
  date.setDate(date.getDate() + offset * 7);
  return formatWeekKey(getMonday(date));
}

function normalizeMiscTasks(raw: Record<string, Array<Partial<MiscTask>>>) {
  const normalized: Record<string, MiscTask[]> = {};

  for (const [weekKey, tasks] of Object.entries(raw)) {
    normalized[weekKey] = tasks
      .map((task, index) => ({
        id: typeof task.id === 'string' && task.id ? task.id : `misc-${weekKey}-${index}`,
        text: typeof task.text === 'string' ? task.text.trim() : '',
      }))
      .filter((task) => task.text);
  }

  return normalized;
}

function isPresetStatus(status: RowStatus) {
  return status === 'none' || status === 'low' || status === 'urgent' || status === 'critical' || status === 'done';
}

function parseAllowedEmails(raw: string | undefined) {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAllowedBetaUser(user: User | null, allowedEmails: Set<string>) {
  if (!user || allowedEmails.size === 0) {
    return true;
  }

  const email = user.email?.trim().toLowerCase();
  return Boolean(email && allowedEmails.has(email));
}

function getAuthRedirectUrl() {
  const { origin } = window.location;
  return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') ? origin : window.location.origin;
}

const DETAIL_COLORS: DetailColor[] = ['default', 'blue', 'green', 'amber', 'pink', 'violet'];

const PRESET_PRIORITY_OPTIONS = ['none', 'low', 'urgent', 'critical', 'done'] as const;
const CUSTOM_PRIORITY_MAX_LENGTH = 24;

function App() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [savedWeeks, setSavedWeeks] = useState<Record<string, Record<string, TaskRow[]>>>({});
  const [activeNotesEditor, setActiveNotesEditor] = useState<ActiveNotesEditor | null>(null);
  const [activeStatusEditor, setActiveStatusEditor] = useState<ActiveStatusEditor | null>(null);
  const [activePriorityPicker, setActivePriorityPicker] = useState<ActivePriorityPicker | null>(null);
  const [miscTasksByWeek, setMiscTasksByWeek] = useState<Record<string, MiscTask[]>>({});
  const [miscTaskInput, setMiscTaskInput] = useState('');
  const [draggedMiscTaskId, setDraggedMiscTaskId] = useState<string | null>(null);
  const [draggedTaskRow, setDraggedTaskRow] = useState<DraggedTaskRow | null>(null);
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [storageError, setStorageError] = useState('');
  const [usesLegacyCompletedColumn, setUsesLegacyCompletedColumn] = useState(false);
  const [usesLegacyTimeColumn, setUsesLegacyTimeColumn] = useState(false);
  const [usesLegacyDetailColorColumn, setUsesLegacyDetailColorColumn] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() => new Date().getFullYear());
  const [hasHydratedLocalCache, setHasHydratedLocalCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);
  const [pageTurn, setPageTurn] = useState<{ weekStart: Date; direction: 'forward' | 'backward' } | null>(null);
  const [plannerTitleOverride, setPlannerTitleOverride] = useState('');
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const previousWeekStartRef = useRef(weekStart);
  const queuedDaySyncsRef = useRef<Record<string, TaskRow[]>>({});
  const activeDaySyncsRef = useRef<Record<string, boolean>>({});
  const saveStateTimeoutRef = useRef<number | null>(null);
  const ui = UI_TEXT[language];
  const allowedEmails = useMemo(() => parseAllowedEmails(import.meta.env.VITE_ALLOWED_EMAILS), []);
  const isInviteOnlyBeta = allowedEmails.size > 0;
  const weekKey = formatWeekKey(weekStart);
  const yearMonths = useMemo(
    () => MONTH_NAMES.map((_, monthIndex) => getMonthCalendar(visibleYear, monthIndex, language)),
    [visibleYear, language],
  );
  const activityMap = useMemo(() => buildActivityMap(savedWeeks), [savedWeeks]);
  const searchResults = useMemo(() => buildSearchResults(savedWeeks, searchQuery, language), [savedWeeks, searchQuery, language]);
  const topBarRange = useMemo(() => formatTopBarRange(weekStart, language), [weekStart, language]);
  const userDisplayName = useMemo(() => getUserDisplayName(user), [user]);
  const userInitials = useMemo(() => getUserInitials(user), [user]);
  const defaultPlannerTitle = useMemo(() => getPlannerTitle(user, language), [user, language]);
  const plannerTitle = plannerTitleOverride || defaultPlannerTitle;
  const miscTasks = miscTasksByWeek[weekKey] ?? [];

  function clearSaveStateTimeout() {
    if (saveStateTimeoutRef.current !== null) {
      window.clearTimeout(saveStateTimeoutRef.current);
      saveStateTimeoutRef.current = null;
    }
  }

  function markSavingState() {
    clearSaveStateTimeout();
    setSaveState('saving');
  }

  function markSavedState() {
    clearSaveStateTimeout();
    setSaveState('saved');
    saveStateTimeoutRef.current = window.setTimeout(() => setSaveState('idle'), 1600);
  }

  function hasPendingDaySyncs() {
    return Object.keys(queuedDaySyncsRef.current).length > 0 || Object.values(activeDaySyncsRef.current).some(Boolean);
  }

  async function enforceInviteOnly(nextUser: User | null) {
    if (isAllowedBetaUser(nextUser, allowedEmails)) {
      setAuthMessage('');
      return nextUser;
    }

    setAuthMessage(ui.inviteOnlyMessage);
    setUser(null);
    await supabase?.auth.signOut();
    return null;
  }

  useEffect(() => {
    // Hydrate all local-only state first so the app is usable immediately, even before
    // Supabase auth or cloud reads have finished.
    const raw = window.localStorage.getItem(STORAGE_PREFIX);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, Record<string, Array<Partial<TaskRow> & { completed?: boolean }>>>;
        setSavedWeeks(normalizeSavedWeeks(parsed));
      } catch {
        window.localStorage.removeItem(STORAGE_PREFIX);
      }
    }

    const rawMisc = window.localStorage.getItem(MISC_STORAGE_PREFIX);
    if (rawMisc) {
      try {
        const parsed = JSON.parse(rawMisc) as Record<string, Array<Partial<MiscTask>>>;
        setMiscTasksByWeek(normalizeMiscTasks(parsed));
      } catch {
        window.localStorage.removeItem(MISC_STORAGE_PREFIX);
      }
    }

    const rawPlannerTitle = window.localStorage.getItem(PLANNER_TITLE_STORAGE_KEY);
    if (rawPlannerTitle) {
      setPlannerTitleOverride(rawPlannerTitle);
    }

    setHasHydratedLocalCache(true);

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) {
        return;
      }

      const nextUser = await enforceInviteOnly(data.session?.user ?? null);

      if (!mounted) {
        return;
      }

      setUser(nextUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        const nextUser = await enforceInviteOnly(nextSession?.user ?? null);
        if (!mounted) {
          return;
        }

        setUser(nextUser);
      })();
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

      async function selectTasks(columns: string) {
        return client
          .from('tasks')
          .select(columns)
          .eq('user_id', activeUser.id)
          .eq('week_start', weekKey)
          .order('day_index', { ascending: true })
          .order('row_index', { ascending: true });
      }

      async function selectWithLegacyFallback(primaryColumns: string, fallbackColumns: string) {
        // The live project may still be on an older schema during beta. Try the newest
        // column set first, then progressively fall back without breaking the planner.
        let result = await selectTasks(primaryColumns);

        if (result.error?.message.includes('column tasks.detail_color does not exist')) {
          result = await selectTasks(fallbackColumns);
          setUsesLegacyDetailColorColumn(true);
        }

        if (result.error?.message.includes('column tasks.task_time does not exist')) {
          result = await selectTasks(
            fallbackColumns
              .split(',')
              .map((column) => column.trim())
              .filter((column) => column !== 'task_time')
              .join(', '),
          );
          setUsesLegacyTimeColumn(true);
          if (!usesLegacyDetailColorColumn) {
            setUsesLegacyDetailColorColumn(true);
          }
        }

        return result;
      }

      if (usesLegacyCompletedColumn) {
        const legacyPrimaryColumns =
          usesLegacyTimeColumn
            ? usesLegacyDetailColorColumn
              ? 'user_id, week_start, day_index, row_index, title, notes, completed'
              : 'user_id, week_start, day_index, row_index, title, notes, completed, detail_color'
            : usesLegacyDetailColorColumn
              ? 'user_id, week_start, day_index, row_index, title, notes, completed, task_time'
              : 'user_id, week_start, day_index, row_index, title, notes, completed, task_time, detail_color';
        const legacyFallbackColumns =
          usesLegacyTimeColumn || usesLegacyDetailColorColumn
            ? 'user_id, week_start, day_index, row_index, title, notes, completed'
            : 'user_id, week_start, day_index, row_index, title, notes, completed, task_time';

        const legacyResult = await selectWithLegacyFallback(legacyPrimaryColumns, legacyFallbackColumns);

        error = legacyResult.error;
        data = ((legacyResult.data ?? []) as unknown as LegacyTaskRecord[]).map((record) => ({
          ...record,
          status: normalizeStatus(undefined, record.completed),
          task_time: typeof record.task_time === 'string' ? record.task_time : '',
          detail_color: normalizeDetailColor(record.detail_color),
        })) as TaskRecord[];
      } else {
        const statusPrimaryColumns =
          usesLegacyTimeColumn
            ? usesLegacyDetailColorColumn
              ? 'user_id, week_start, day_index, row_index, title, notes, status'
              : 'user_id, week_start, day_index, row_index, title, notes, status, detail_color'
            : usesLegacyDetailColorColumn
              ? 'user_id, week_start, day_index, row_index, title, notes, status, task_time'
              : 'user_id, week_start, day_index, row_index, title, notes, status, task_time, detail_color';
        const statusFallbackColumns =
          usesLegacyTimeColumn || usesLegacyDetailColorColumn
            ? 'user_id, week_start, day_index, row_index, title, notes, status'
            : 'user_id, week_start, day_index, row_index, title, notes, status, task_time';

        let statusResult = await selectWithLegacyFallback(statusPrimaryColumns, statusFallbackColumns);

        error = statusResult.error;
        data = ((statusResult.data ?? []) as Array<Partial<TaskRecord>>).map((record) => ({
          ...record,
          task_time: typeof record.task_time === 'string' ? record.task_time : '',
          detail_color: normalizeDetailColor(record.detail_color),
        })) as TaskRecord[];

        if (error?.message.includes('column tasks.status does not exist')) {
          const legacyPrimaryColumns =
            usesLegacyTimeColumn
              ? usesLegacyDetailColorColumn
                ? 'user_id, week_start, day_index, row_index, title, notes, completed'
                : 'user_id, week_start, day_index, row_index, title, notes, completed, detail_color'
              : usesLegacyDetailColorColumn
                ? 'user_id, week_start, day_index, row_index, title, notes, completed, task_time'
                : 'user_id, week_start, day_index, row_index, title, notes, completed, task_time, detail_color';
          const legacyFallbackColumns =
            usesLegacyTimeColumn || usesLegacyDetailColorColumn
              ? 'user_id, week_start, day_index, row_index, title, notes, completed'
              : 'user_id, week_start, day_index, row_index, title, notes, completed, task_time';

          const legacyResult = await selectWithLegacyFallback(legacyPrimaryColumns, legacyFallbackColumns);

          error = legacyResult.error;
          data = ((legacyResult.data ?? []) as unknown as LegacyTaskRecord[]).map((record) => ({
            ...record,
            status: normalizeStatus(undefined, record.completed),
            task_time: typeof record.task_time === 'string' ? record.task_time : '',
            detail_color: normalizeDetailColor(record.detail_color),
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
          [weekKey]: mergeLegacyDetailFields(
            mapRecordsToWeek(weekStart, data ?? []),
            current[weekKey],
            usesLegacyTimeColumn || usesLegacyDetailColorColumn,
          ),
        }));
      }

      setIsWeekLoading(false);
    }

    void loadWeek();

    return () => {
      ignore = true;
    };
  }, [hasHydratedLocalCache, user, weekKey, weekStart, usesLegacyCompletedColumn, usesLegacyTimeColumn, usesLegacyDetailColorColumn]);

  useEffect(() => {
    if (!hasHydratedLocalCache) {
      return;
    }

    window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(savedWeeks));
  }, [hasHydratedLocalCache, savedWeeks]);

  useEffect(() => {
    if (!hasHydratedLocalCache) {
      return;
    }

    window.localStorage.setItem(MISC_STORAGE_PREFIX, JSON.stringify(miscTasksByWeek));
  }, [hasHydratedLocalCache, miscTasksByWeek]);

  useEffect(() => {
    if (!hasHydratedLocalCache) {
      return;
    }

    if (plannerTitleOverride.trim()) {
      window.localStorage.setItem(PLANNER_TITLE_STORAGE_KEY, plannerTitleOverride);
    } else {
      window.localStorage.removeItem(PLANNER_TITLE_STORAGE_KEY);
    }
  }, [hasHydratedLocalCache, plannerTitleOverride]);

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

  useEffect(() => {
    return () => clearSaveStateTimeout();
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

  async function syncDayRows(dayKey: string, rows: TaskRow[]) {
    if (!supabase || !user) {
      return false;
    }

    const dayIndex = getDayIndex(dayKey);
    if (dayIndex < 0) {
      return false;
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
      return false;
    }

    // Row reordering is simplest to sync by rewriting the day slice in row-index order.
    const populatedRows = rows
      .map((row, rowIndex) => ({
        user_id: activeUser.id,
        week_start: weekKey,
        day_index: dayIndex,
        row_index: rowIndex,
        title: row.title,
        notes: row.notes,
        ...(usesLegacyTimeColumn ? {} : { task_time: row.time }),
        ...(usesLegacyDetailColorColumn ? {} : { detail_color: row.detailColor }),
        ...(usesLegacyCompletedColumn
          ? { completed: row.status === 'done' }
          : { status: row.status }),
      }))
      .filter(
        (row) =>
          row.title.trim() !== '' ||
          row.notes.trim() !== '' ||
          ('task_time' in row && typeof row.task_time === 'string' && row.task_time.trim() !== '') ||
          ('status' in row ? row.status !== 'none' : row.completed),
      );

    if (populatedRows.length === 0) {
      setStorageError('');
      return true;
    }

    const { error: insertError } = await client.from('tasks').insert(populatedRows);

    if (insertError) {
      setStorageError(insertError.message);
      return false;
    }

    setStorageError('');
    return true;
  }

  async function flushDaySync(dayKey: string) {
    if (activeDaySyncsRef.current[dayKey]) {
      return;
    }

    const rows = queuedDaySyncsRef.current[dayKey];

    if (!rows) {
      return;
    }

    delete queuedDaySyncsRef.current[dayKey];
    activeDaySyncsRef.current[dayKey] = true;

    const didSave = await syncDayRows(dayKey, rows);

    activeDaySyncsRef.current[dayKey] = false;

    if (queuedDaySyncsRef.current[dayKey]) {
      void flushDaySync(dayKey);
      return;
    }

    if (didSave && !hasPendingDaySyncs()) {
      markSavedState();
    }
  }

  function queueDaySync(dayKey: string, rows: TaskRow[]) {
    if (!supabase || !user) {
      return;
    }

    queuedDaySyncsRef.current[dayKey] = rows.map((row) => ({ ...row }));
    markSavingState();
    void flushDaySync(dayKey);
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
      queueDaySync(dayKey, remainingRows);
    }
  }

  function updateRow(dayKey: string, rowId: string, field: keyof TaskRow, value: string) {
    updateRowFields(dayKey, rowId, { [field]: value } as Partial<TaskRow>);
  }

  function updateRowFields(dayKey: string, rowId: string, fields: Partial<TaskRow>) {
    let nextRowsSnapshot: TaskRow[] | null = null;
    let updatedRow: TaskRow | null = null;

    setSavedWeeks((current) => {
      const currentWeekState = current[weekKey] ?? {};
      const currentRowsState = currentWeekState[dayKey] ?? createEmptyRows(dayKey);
      const existingRow = currentRowsState.find((row) => row.id === rowId);

      if (!existingRow) {
        return current;
      }

      // Apply multiple field changes atomically so one UI action cannot overwrite
      // itself with stale row snapshots.
      updatedRow = {
        ...existingRow,
        ...fields,
      };

      const nextRows = currentRowsState.map((row) => (row.id === rowId ? (updatedRow as TaskRow) : row));
      nextRowsSnapshot = nextRows;

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

    if (supabase && user && nextRowsSnapshot) {
      queueDaySync(dayKey, nextRowsSnapshot);
    }
  }

  function openNotesEditor(dayKey: string, row: TaskRow) {
    setActiveNotesEditor({
      dayKey,
      rowId: row.id,
      taskTitle: row.title,
      notes: sanitizeNoteHtml(row.notes),
    });
  }

  function closeNotesEditor() {
    setActiveNotesEditor(null);
  }

  function closeStatusEditor() {
    setActiveStatusEditor(null);
  }

  function openPriorityPicker(dayKey: string, row: TaskRow) {
    setActivePriorityPicker({
      dayKey,
      rowId: row.id,
      value: getCustomDetailValue(row) || row.status,
      color: row.detailColor,
    });
  }

  function closePriorityPicker() {
    setActivePriorityPicker(null);
  }

  function updateActiveNotes(notes: string) {
    const sanitizedNotes = sanitizeNoteHtml(notes);
    setActiveNotesEditor((current) => (current ? { ...current, notes: sanitizedNotes } : current));
    if (activeNotesEditor) {
      updateRow(activeNotesEditor.dayKey, activeNotesEditor.rowId, 'notes', sanitizedNotes);
    }
  }

  function updateActiveTaskTitle(title: string) {
    setActiveNotesEditor((current) => (current ? { ...current, taskTitle: title } : current));
    if (activeNotesEditor) {
      updateRow(activeNotesEditor.dayKey, activeNotesEditor.rowId, 'title', title);
    }
  }

  function saveCustomStatus(status: string, color: DetailColor) {
    if (!activeStatusEditor) {
      return;
    }

    const trimmed = status.trim().slice(0, CUSTOM_PRIORITY_MAX_LENGTH);
    if (!trimmed) {
      return;
    }

    updateRowFields(activeStatusEditor.dayKey, activeStatusEditor.rowId, {
      status: 'none',
      time: trimmed,
      detailColor: color,
      priorityDismissed: false,
    });
    setActiveStatusEditor(null);
  }

  function selectPriorityOption(option: (typeof PRESET_PRIORITY_OPTIONS)[number]) {
    if (!activePriorityPicker) {
      return;
    }

    // Explicitly choosing `none` is different from "priority has never been set":
    // it hides the inline prompt until the user hovers the cell again.
    updateRowFields(activePriorityPicker.dayKey, activePriorityPicker.rowId, {
      time: '',
      status: option,
      priorityDismissed: option === 'none',
    });
    setActivePriorityPicker(null);
  }

  function openCustomFromPriorityPicker() {
    if (!activePriorityPicker) {
      return;
    }

    setActiveStatusEditor({
      dayKey: activePriorityPicker.dayKey,
      rowId: activePriorityPicker.rowId,
      status: activePriorityPicker.value === 'none' ? '' : activePriorityPicker.value,
      color: activePriorityPicker.color,
    });
    setActivePriorityPicker(null);
  }

  function addMiscTask() {
    const trimmed = miscTaskInput.trim();

    if (!trimmed) {
      return;
    }

    setMiscTasksByWeek((current) => ({
      ...current,
      [weekKey]: [...(current[weekKey] ?? []), createMiscTask(trimmed)],
    }));
    setMiscTaskInput('');
  }

  function deleteMiscTask(taskId: string) {
    setMiscTasksByWeek((current) => ({
      ...current,
      [weekKey]: (current[weekKey] ?? []).filter((task) => task.id !== taskId),
    }));
  }

  function moveMiscTaskToWeek(taskId: string, offset: number) {
    const task = (miscTasksByWeek[weekKey] ?? []).find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    const targetWeekKey = shiftWeekKeyByOffset(weekKey, offset);

    setMiscTasksByWeek((current) => ({
      ...current,
      [weekKey]: (current[weekKey] ?? []).filter((item) => item.id !== taskId),
      [targetWeekKey]: [...(current[targetWeekKey] ?? []), task],
    }));
    setDraggedMiscTaskId(null);
  }

  function assignMiscTaskToRow(dayKey: string, rowId: string, taskId: string) {
    const task = (miscTasksByWeek[weekKey] ?? []).find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    updateRow(dayKey, rowId, 'title', task.text);
    setMiscTasksByWeek((current) => ({
      ...current,
      [weekKey]: (current[weekKey] ?? []).filter((item) => item.id !== taskId),
    }));
    setDraggedMiscTaskId(null);
  }

  function moveTaskRow(sourceDayKey: string, sourceRowId: string, targetDayKey: string, targetRowId: string) {
    if (sourceDayKey === targetDayKey && sourceRowId === targetRowId) {
      return;
    }

    const currentWeek = savedWeeks[weekKey] ?? {};
    const sourceRows = [...(currentWeek[sourceDayKey] ?? createEmptyRows(sourceDayKey))];
    const targetRows = sourceDayKey === targetDayKey ? sourceRows : [...(currentWeek[targetDayKey] ?? createEmptyRows(targetDayKey))];
    const sourceIndex = sourceRows.findIndex((row) => row.id === sourceRowId);
    const targetIndex = targetRows.findIndex((row) => row.id === targetRowId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    let nextSourceRows = sourceRows;
    let nextTargetRows = targetRows;

    if (sourceDayKey === targetDayKey) {
      // Same-day drag keeps the row content intact and only changes visual order.
      const [movedRow] = nextSourceRows.splice(sourceIndex, 1);
      nextSourceRows.splice(targetIndex, 0, movedRow);
      nextSourceRows = reindexRows(sourceDayKey, nextSourceRows);
    } else {
      // Cross-day drag swaps with the target row, unless the target is empty, in which
      // case the source row is moved and its old slot becomes a fresh empty row.
      const sourceRow = sourceRows[sourceIndex];
      const targetRow = targetRows[targetIndex];

      if (isRowEmpty(targetRow)) {
        nextSourceRows[sourceIndex] = createEmptyRow(sourceDayKey, sourceIndex);
        nextTargetRows[targetIndex] = {
          ...createEmptyRow(targetDayKey, targetIndex),
          title: sourceRow.title,
          notes: sourceRow.notes,
          status: sourceRow.status,
        };
      } else {
        nextSourceRows[sourceIndex] = {
          ...createEmptyRow(sourceDayKey, sourceIndex),
          title: targetRow.title,
          notes: targetRow.notes,
          status: targetRow.status,
        };
        nextTargetRows[targetIndex] = {
          ...createEmptyRow(targetDayKey, targetIndex),
          title: sourceRow.title,
          notes: sourceRow.notes,
          status: sourceRow.status,
        };
      }

      nextSourceRows = reindexRows(sourceDayKey, nextSourceRows);
      nextTargetRows = reindexRows(targetDayKey, nextTargetRows);
    }

    setSavedWeeks((current) => {
      const week = current[weekKey] ?? {};
      const nextState = {
        ...current,
        [weekKey]: {
          ...week,
          [sourceDayKey]: nextSourceRows,
          ...(sourceDayKey === targetDayKey ? {} : { [targetDayKey]: nextTargetRows }),
        },
      };

      window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(nextState));
      return nextState;
    });

    if (supabase && user) {
      queueDaySync(sourceDayKey, nextSourceRows);
      if (sourceDayKey !== targetDayKey) {
        queueDaySync(targetDayKey, nextTargetRows);
      }
    }

    setDraggedTaskRow(null);
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

  async function signInWithProvider(provider: 'google' | 'github') {
    if (!supabase) {
      return;
    }

    setAuthMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectUrl(),
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
        isInviteOnlyBeta={isInviteOnlyBeta}
        ui={ui}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSignIn={signInWithPassword}
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
            <div className="top-toolbar-identity">
              <button type="button" className="nav-button" onClick={resetToCurrentWeek}>
                {ui.today}
              </button>

              <div>
                <input
                  className="top-toolbar-title-input"
                  value={plannerTitle}
                  onChange={(event) => setPlannerTitleOverride(event.target.value)}
                  placeholder={defaultPlannerTitle}
                  aria-label={ui.weeklyPlanner}
                />
                <p className="top-toolbar-range">{topBarRange}</p>
              </div>
            </div>
          </div>

          <div className="top-toolbar-summary">
            {isSupabaseConfigured && user && saveState !== 'idle' ? (
              <span className={`save-indicator save-indicator-${saveState}`}>
                {saveState === 'saving' ? ui.savingStatus : ui.savedStatus}
              </span>
            ) : null}

            <button type="button" className="nav-button" onClick={() => setIsCalendarOpen(true)}>
              {ui.calendar}
            </button>

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
                <span>{userInitials}</span>
              </button>

              {isAccountMenuOpen ? (
                <div className="account-menu-panel" role="menu" aria-label={ui.accountSettings}>
                  <div className="account-menu-header">
                    <div className="account-menu-avatar">
                      <span>{userInitials}</span>
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
        <button
          type="button"
          className="spread-hit-zone spread-hit-zone-left"
          onClick={() => moveWeek(-1)}
          onDragOver={(event) => {
            if (!draggedMiscTaskId) {
              return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            const taskId = event.dataTransfer.getData('text/plain') || draggedMiscTaskId;

            if (taskId) {
              moveMiscTaskToWeek(taskId, -1);
            }
          }}
          aria-label={ui.previousWeek}
        >
          <span className="spread-hit-zone-indicator" aria-hidden="true">
            {'<'}
          </span>
        </button>
        <button
          type="button"
          className="spread-hit-zone spread-hit-zone-right"
          onClick={() => moveWeek(1)}
          onDragOver={(event) => {
            if (!draggedMiscTaskId) {
              return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            const taskId = event.dataTransfer.getData('text/plain') || draggedMiscTaskId;

            if (taskId) {
              moveMiscTaskToWeek(taskId, 1);
            }
          }}
          aria-label={ui.nextWeek}
        >
          <span className="spread-hit-zone-indicator" aria-hidden="true">
            {'>'}
          </span>
        </button>

        <div className="spread-frame">
          {pageTurn ? (
            <div className={`spread spread-turn-layer spread-outgoing is-${pageTurn.direction}`} aria-hidden="true">
              <PageSheet
                headerLabel={formatSheetRange(outgoingLeftPage, language)}
                days={outgoingLeftPage}
                ui={ui}
                onUpdateRow={updateRow}
                onUpdateRowFields={updateRowFields}
                onAddRow={addRow}
                onDeleteRow={deleteRow}
                onMoveTaskRow={moveTaskRow}
                onOpenNotes={openNotesEditor}
                onOpenPriorityPicker={openPriorityPicker}
                onAssignMiscTask={assignMiscTaskToRow}
                draggedMiscTaskId={draggedMiscTaskId}
                draggedTaskRow={draggedTaskRow}
                onSetDraggedTaskRow={setDraggedTaskRow}
                activeDayIndex={getActiveDayIndexForWeek(outgoingWeekKey, todayWeekKey, todayDayIndex)}
                activeSearchRowId={activeSearchRowId}
              />
              <PageSheet
                headerLabel={formatSheetRange(outgoingRightPage, language)}
                days={outgoingRightPage}
                ui={ui}
                onUpdateRow={updateRow}
                onUpdateRowFields={updateRowFields}
                onAddRow={addRow}
                onDeleteRow={deleteRow}
                onMoveTaskRow={moveTaskRow}
                onOpenNotes={openNotesEditor}
                onOpenPriorityPicker={openPriorityPicker}
                onAssignMiscTask={assignMiscTaskToRow}
                draggedMiscTaskId={draggedMiscTaskId}
                draggedTaskRow={draggedTaskRow}
                onSetDraggedTaskRow={setDraggedTaskRow}
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
              onUpdateRowFields={updateRowFields}
              onAddRow={addRow}
              onDeleteRow={deleteRow}
              onMoveTaskRow={moveTaskRow}
              onOpenNotes={openNotesEditor}
              onOpenPriorityPicker={openPriorityPicker}
              onAssignMiscTask={assignMiscTaskToRow}
              draggedMiscTaskId={draggedMiscTaskId}
              draggedTaskRow={draggedTaskRow}
              onSetDraggedTaskRow={setDraggedTaskRow}
              activeDayIndex={getActiveDayIndexForWeek(weekKey, todayWeekKey, todayDayIndex)}
              activeSearchRowId={activeSearchRowId}
            />
            <PageSheet
              headerLabel={formatSheetRange(rightPage, language)}
              days={rightPage}
              ui={ui}
              onUpdateRow={updateRow}
              onUpdateRowFields={updateRowFields}
              onAddRow={addRow}
              onDeleteRow={deleteRow}
              onMoveTaskRow={moveTaskRow}
              onOpenNotes={openNotesEditor}
              onOpenPriorityPicker={openPriorityPicker}
              onAssignMiscTask={assignMiscTaskToRow}
              draggedMiscTaskId={draggedMiscTaskId}
              draggedTaskRow={draggedTaskRow}
              onSetDraggedTaskRow={setDraggedTaskRow}
              activeDayIndex={getActiveDayIndexForWeek(weekKey, todayWeekKey, todayDayIndex)}
              activeSearchRowId={activeSearchRowId}
            />
          </div>
        </div>
      </main>

      <section className="misc-inbox-shell">
        <form
          className="misc-inbox-form"
          onSubmit={(event) => {
            event.preventDefault();
            addMiscTask();
          }}
        >
          <div className="misc-inbox-input-shell">
            <input
              className="misc-inbox-input"
              value={miscTaskInput}
              onChange={(event) => setMiscTaskInput(event.target.value)}
              placeholder={ui.miscTasksPlaceholder}
              aria-label={ui.miscTasksTitle}
            />
          </div>
        </form>

        <div className="misc-task-list">
          {miscTasks.length > 0 ? (
            miscTasks.map((task) => (
              <div
                key={task.id}
                className={`misc-task-chip ${draggedMiscTaskId === task.id ? 'is-dragging' : ''}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', task.id);
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggedMiscTaskId(task.id);
                }}
                onDragEnd={() => setDraggedMiscTaskId(null)}
              >
                <span className="misc-task-text">{task.text}</span>
                <span className="misc-task-actions" aria-hidden="true">
                  <span className="misc-task-drag">drag</span>
                  <button
                    type="button"
                    className="misc-task-delete"
                    onClick={() => deleteMiscTask(task.id)}
                    aria-label={ui.deleteMiscTask}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))
          ) : null}
        </div>
      </section>

      {activeNotesEditor ? (
        <NotesDialog
          activeNotesEditor={activeNotesEditor}
          ui={ui}
          onClose={closeNotesEditor}
          onChangeTaskTitle={updateActiveTaskTitle}
          onChangeNotes={updateActiveNotes}
        />
      ) : null}

      {activeStatusEditor ? (
        <CustomStatusDialog
          ui={ui}
          activeStatusEditor={activeStatusEditor}
          onClose={closeStatusEditor}
          onSave={saveCustomStatus}
        />
      ) : null}

      {activePriorityPicker ? (
        <PriorityDialog
          ui={ui}
          activePriorityPicker={activePriorityPicker}
          onClose={closePriorityPicker}
          onSelect={selectPriorityOption}
          onCustom={openCustomFromPriorityPicker}
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
  isInviteOnlyBeta: boolean;
  ui: UiText;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onOAuth: (provider: 'google' | 'github') => void;
};

function AuthScreen({
  authEmail,
  authPassword,
  authMessage,
  isAuthLoading,
  isInviteOnlyBeta,
  ui,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onOAuth,
}: AuthScreenProps) {
  return (
    <div className="auth-page">
      <section className="auth-card">
        <p className="storage-label">{ui.appName}</p>
        <h1 className="auth-title">{isInviteOnlyBeta ? ui.inviteOnlyAuthTitle : ui.authTitle}</h1>
        <p className="auth-copy">{isInviteOnlyBeta ? ui.inviteOnlyAuthCopy : ui.authCopy}</p>

        <div className="oauth-group oauth-group-vertical auth-oauth-primary">
          <button type="button" className="nav-button nav-button-primary auth-google-button" onClick={() => onOAuth('google')}>
            {ui.continueWithGoogle}
          </button>
        </div>

        {isInviteOnlyBeta ? null : (
          <>
            <div className="auth-divider" />

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
              </div>
            </div>
          </>
        )}

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
  onUpdateRowFields: (dayKey: string, rowId: string, fields: Partial<TaskRow>) => void;
  onAddRow: (dayKey: string) => void;
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onMoveTaskRow: (sourceDayKey: string, sourceRowId: string, targetDayKey: string, targetRowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  onOpenPriorityPicker: (dayKey: string, row: TaskRow) => void;
  onAssignMiscTask: (dayKey: string, rowId: string, taskId: string) => void;
  draggedMiscTaskId: string | null;
  draggedTaskRow: DraggedTaskRow | null;
  onSetDraggedTaskRow: (value: DraggedTaskRow | null) => void;
  activeDayIndex: number | null;
  activeSearchRowId: string | null;
};

function PageSheet({
  headerLabel,
  days,
  ui,
  onUpdateRow,
  onUpdateRowFields,
  onAddRow,
  onDeleteRow,
  onMoveTaskRow,
  onOpenNotes,
  onOpenPriorityPicker,
  onAssignMiscTask,
  draggedMiscTaskId,
  draggedTaskRow,
  onSetDraggedTaskRow,
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
            onUpdateRowFields={onUpdateRowFields}
            onAddRow={onAddRow}
            onDeleteRow={onDeleteRow}
            onMoveTaskRow={onMoveTaskRow}
            onOpenNotes={onOpenNotes}
            onOpenPriorityPicker={onOpenPriorityPicker}
            onAssignMiscTask={onAssignMiscTask}
            draggedMiscTaskId={draggedMiscTaskId}
            draggedTaskRow={draggedTaskRow}
            onSetDraggedTaskRow={onSetDraggedTaskRow}
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
  onUpdateRowFields: (dayKey: string, rowId: string, fields: Partial<TaskRow>) => void;
  onAddRow: (dayKey: string) => void;
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onMoveTaskRow: (sourceDayKey: string, sourceRowId: string, targetDayKey: string, targetRowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  onOpenPriorityPicker: (dayKey: string, row: TaskRow) => void;
  onAssignMiscTask: (dayKey: string, rowId: string, taskId: string) => void;
  draggedMiscTaskId: string | null;
  draggedTaskRow: DraggedTaskRow | null;
  onSetDraggedTaskRow: (value: DraggedTaskRow | null) => void;
  isActive: boolean;
  activeSearchRowId: string | null;
};

function DaySection({
  day,
  ui,
  onUpdateRow,
  onUpdateRowFields,
  onAddRow,
  onDeleteRow,
  onMoveTaskRow,
  onOpenNotes,
  onOpenPriorityPicker,
  onAssignMiscTask,
  draggedMiscTaskId,
  draggedTaskRow,
  onSetDraggedTaskRow,
  isActive,
  activeSearchRowId,
}: DaySectionProps) {
  const dateKey = day.key.split('-').slice(1).join('-');
  const dayNumber = new Date(`${dateKey}T00:00:00`).getDate();
  const hasReachedRowLimit = day.rows.length >= MAX_ROW_COUNT;
  const [dragTargetRowId, setDragTargetRowId] = useState<string | null>(null);
  const [dragTargetKind, setDragTargetKind] = useState<'misc' | 'task' | null>(null);

  useEffect(() => {
    if (!draggedMiscTaskId && !draggedTaskRow) {
      setDragTargetRowId(null);
      setDragTargetKind(null);
    }
  }, [draggedMiscTaskId, draggedTaskRow]);

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
          <span>{ui.statusSortLabel}</span>
        </div>

        {day.rows.map((row, index) => (
          <div
            key={row.id}
            className={`task-grid-row ${activeSearchRowId === row.id ? 'is-search-hit' : ''} ${
              dragTargetRowId === row.id ? `is-drop-target is-drop-target-${dragTargetKind ?? 'task'}` : ''
            }`}
            onDragOver={(event) => {
              if (!draggedMiscTaskId && !draggedTaskRow) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragTargetRowId(row.id);
              setDragTargetKind(draggedMiscTaskId ? 'misc' : 'task');
            }}
            onDragLeave={() => {
              if (dragTargetRowId === row.id) {
                setDragTargetRowId(null);
                setDragTargetKind(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData('text/plain') || draggedMiscTaskId;
              const plannerRow = event.dataTransfer.getData('application/x-dnevnik-task-row');
              setDragTargetRowId(null);
              setDragTargetKind(null);

              if (taskId) {
                onAssignMiscTask(day.key, row.id, taskId);
                return;
              }

              if (plannerRow) {
                try {
                  const source = JSON.parse(plannerRow) as DraggedTaskRow;
                  onMoveTaskRow(source.dayKey, source.rowId, day.key, row.id);
                } catch {
                  // Ignore invalid drag payloads.
                }
              } else if (draggedTaskRow) {
                onMoveTaskRow(draggedTaskRow.dayKey, draggedTaskRow.rowId, day.key, row.id);
              }
            }}
          >
            <div
              className={`row-number row-number-cell ${index === day.rows.length - 1 ? 'is-row-actions' : ''} ${
                !isRowEmpty(row) ? 'is-draggable' : ''
              } ${draggedTaskRow?.rowId === row.id ? 'is-drag-source' : ''}`}
              draggable={!isRowEmpty(row)}
              onDragStart={(event) => {
                if (isRowEmpty(row)) {
                  event.preventDefault();
                  return;
                }

                const payload = JSON.stringify({ dayKey: day.key, rowId: row.id });
                event.dataTransfer.setData('application/x-dnevnik-task-row', payload);
                event.dataTransfer.effectAllowed = 'move';
                onSetDraggedTaskRow({ dayKey: day.key, rowId: row.id });
              }}
              onDragEnd={() => onSetDraggedTaskRow(null)}
            >
              <span className="row-number-label">{index + 1}</span>
              {index === day.rows.length - 1 ? (
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
            <div className={`task-cell ${row.title.trim() ? 'has-title' : ''}`}>
              <input
                className={`cell-input ${row.status === 'done' ? 'is-complete' : ''}`}
                value={row.title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  const wasEmpty = row.title.trim() === '';
                  const isNowFilled = nextTitle.trim() !== '';
                  const isNowCleared = nextTitle.trim() === '';

                  if (wasEmpty && isNowFilled) {
                    onUpdateRowFields(day.key, row.id, {
                      title: nextTitle,
                      notes: '',
                      status: 'none',
                      time: '',
                      detailColor: 'default',
                      priorityDismissed: false,
                    });
                    return;
                  }

                  if (isNowCleared) {
                    onUpdateRowFields(day.key, row.id, {
                      title: nextTitle,
                      notes: '',
                      status: 'none',
                      time: '',
                      detailColor: 'default',
                      priorityDismissed: false,
                    });
                    return;
                  }

                  onUpdateRow(day.key, row.id, 'title', nextTitle);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onOpenNotes(day.key, row);
                  }
                }}
              />
              <span className="task-enter-hint" aria-hidden="true">
                {ui.taskEnterHint}
              </span>
              <button type="button" className="mobile-notes-trigger" onClick={() => onOpenNotes(day.key, row)}>
                {row.notes.trim() ? ui.notes : `+ ${ui.notes}`}
              </button>
            </div>
            <button
              type="button"
              className={`notes-trigger ${row.notes ? 'has-notes' : ''}`}
              onClick={() => onOpenNotes(day.key, row)}
            >
              <span className="notes-preview">{getNotePreview(row.notes)}</span>
            </button>
            <div className="status-cell">
              {row.title.trim() ? (
                (() => {
                  const customDetail = getCustomDetailValue(row);
                  const hasVisiblePriority = Boolean(customDetail || row.status !== 'none');
                  const shouldRevealPrompt = !hasVisiblePriority && !row.priorityDismissed;

                  return (
                    <button
                      type="button"
                      className={`priority-trigger ${
                        hasVisiblePriority
                          ? customDetail
                            ? `detail-${row.detailColor}`
                            : `status-${row.status}`
                          : shouldRevealPrompt
                            ? 'status-none'
                            : 'is-empty-priority'
                      }`}
                      onClick={() => onOpenPriorityPicker(day.key, row)}
                      aria-haspopup="dialog"
                      aria-label={`${ui.statusSortLabel}: ${hasVisiblePriority || shouldRevealPrompt ? customDetail || getStatusLabel(row.status, ui) : ui.statusSet}`}
                    >
                      {hasVisiblePriority || shouldRevealPrompt ? customDetail || getStatusLabel(row.status, ui) : ui.statusSet}
                    </button>
                  );
                })()
              ) : (
                <span className="status-empty" aria-hidden="true" />
              )}
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
  onChangeTaskTitle: (title: string) => void;
  onChangeNotes: (notes: string) => void;
};

type CustomStatusDialogProps = {
  activeStatusEditor: ActiveStatusEditor;
  ui: UiText;
  onClose: () => void;
  onSave: (status: string, color: DetailColor) => void;
};

type PriorityDialogProps = {
  activePriorityPicker: ActivePriorityPicker;
  ui: UiText;
  onClose: () => void;
  onSelect: (option: (typeof PRESET_PRIORITY_OPTIONS)[number]) => void;
  onCustom: () => void;
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

function CustomStatusDialog({ activeStatusEditor, ui, onClose, onSave }: CustomStatusDialogProps) {
  const [value, setValue] = useState(activeStatusEditor.status);
  const [color, setColor] = useState<DetailColor>(activeStatusEditor.color);

  useEffect(() => {
    setValue(activeStatusEditor.status);
    setColor(activeStatusEditor.color);
  }, [activeStatusEditor]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onSave(value, color);
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [color, onClose, onSave, value]);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="meta-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-status-dialog-title">
        <div className="meta-dialog-header">
          <div>
            <p className="dialog-label">{ui.statusSortLabel}</p>
            <h2 id="custom-status-dialog-title" className="dialog-title">
              {ui.customStatusTitle}
            </h2>
          </div>
          <button type="button" className="notes-dialog-close" onClick={onClose} aria-label={ui.close}>
            ×
          </button>
        </div>

        <input
          className="meta-dialog-input"
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, CUSTOM_PRIORITY_MAX_LENGTH))}
          placeholder={ui.customStatusPlaceholder}
          maxLength={CUSTOM_PRIORITY_MAX_LENGTH}
          autoFocus
        />

        <div className="meta-dialog-color-group" aria-label={ui.detailColor}>
          <p className="dialog-label">{ui.detailColor}</p>
          <div className="meta-dialog-color-row">
            {DETAIL_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={`meta-color-chip color-${option} ${color === option ? 'is-active' : ''}`}
                onClick={() => setColor(option)}
                aria-label={getDetailColorLabel(option, ui)}
                title={getDetailColorLabel(option, ui)}
              />
            ))}
          </div>
        </div>

        <div className="meta-dialog-actions">
          <button type="button" className="nav-button" onClick={onClose}>
            {ui.customStatusCancel}
          </button>
          <button type="button" className="nav-button" onClick={() => onSave(value, color)}>
            {ui.customStatusSave}
          </button>
        </div>
      </section>
    </div>
  );
}

function PriorityDialog({ activePriorityPicker, ui, onClose, onSelect, onCustom }: PriorityDialogProps) {
  const initialSelection = PRESET_PRIORITY_OPTIONS.includes(activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
    ? (activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
    : null;
  const [selectedOption, setSelectedOption] = useState<(typeof PRESET_PRIORITY_OPTIONS)[number] | null>(initialSelection);

  useEffect(() => {
    setSelectedOption(
      PRESET_PRIORITY_OPTIONS.includes(activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
        ? (activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
        : null,
    );
  }, [activePriorityPicker]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && selectedOption) {
        event.preventDefault();
        onSelect(selectedOption);
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose, onSelect, selectedOption]);

  const currentValue = activePriorityPicker.value === 'none' ? ui.statusSet : activePriorityPicker.value;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="meta-dialog priority-dialog" role="dialog" aria-modal="true" aria-labelledby="priority-dialog-title">
        <div className="meta-dialog-header">
          <div>
            <p className="dialog-label">{ui.statusSortLabel}</p>
            <h2 id="priority-dialog-title" className="dialog-title">
              {currentValue}
            </h2>
          </div>
          <button type="button" className="notes-dialog-close" onClick={onClose} aria-label={ui.close}>
            ×
          </button>
        </div>

        <div className="priority-dialog-options">
          {PRESET_PRIORITY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`priority-menu-item status-${option === 'none' ? 'none' : option} ${
                selectedOption === option ? 'is-active' : ''
              }`}
              onClick={() => setSelectedOption(option)}
            >
              {option === 'none'
                ? ui.statusNone
                : option === 'low'
                  ? ui.statusLow
                  : option === 'urgent'
                    ? ui.statusUrgent
                    : option === 'critical'
                      ? ui.statusCritical
                      : ui.statusDone}
            </button>
          ))}
          <button type="button" className="priority-menu-item detail-custom" onClick={onCustom}>
            {ui.statusCustom}
          </button>
        </div>

        <div className="meta-dialog-actions">
          <button type="button" className="nav-button" onClick={onClose}>
            {ui.customStatusCancel}
          </button>
          <button type="button" className="nav-button" onClick={() => selectedOption && onSelect(selectedOption)} disabled={!selectedOption}>
            {ui.priorityApply}
          </button>
        </div>
      </section>
    </div>
  );
}

function NotesDialog({ activeNotesEditor, ui, onClose, onChangeTaskTitle, onChangeNotes }: NotesDialogProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    unorderedList: false,
    block: 'body' as 'body' | 'large',
  });

  useEffect(() => {
    const sanitizedNotes = sanitizeNoteHtml(activeNotesEditor.notes);
    if (editorRef.current && editorRef.current.innerHTML !== sanitizedNotes) {
      editorRef.current.innerHTML = sanitizedNotes;
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
      const sanitizedNotes = sanitizeNoteHtml(editorRef.current.innerHTML);
      if (editorRef.current.innerHTML !== sanitizedNotes) {
        editorRef.current.innerHTML = sanitizedNotes;
      }
      onChangeNotes(sanitizedNotes);
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
            <input
              id="notes-dialog-title"
              className="notes-dialog-title-input"
              value={activeNotesEditor.taskTitle}
              onChange={(event) => onChangeTaskTitle(event.target.value)}
              placeholder={ui.untitledTask}
            />
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
          onInput={(event) => {
            const sanitizedNotes = sanitizeNoteHtml(event.currentTarget.innerHTML);
            if (event.currentTarget.innerHTML !== sanitizedNotes) {
              event.currentTarget.innerHTML = sanitizedNotes;
            }
            onChangeNotes(sanitizedNotes);
          }}
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
          <p className="notes-dialog-hint">{ui.notesShortcutHint}</p>
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
                  const weekActivity = week.reduce((total, day) => total + (activityMap.get(formatDateKey(day)) ?? 0), 0);

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
                        const dateKey = formatDateKey(day);
                        const activity = activityMap.get(dateKey) ?? 0;
                        const intensity =
                          activity >= 6 ? 'activity-4' : activity >= 4 ? 'activity-3' : activity >= 2 ? 'activity-2' : activity >= 1 ? 'activity-1' : '';

                        return (
                          <span
                            key={dateKey}
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
