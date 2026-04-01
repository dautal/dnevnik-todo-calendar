import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

// A single planner row intentionally keeps both preset priority state and a free-form
// detail slot. Built-in priorities live in `status`, while custom priority/detail text
// currently reuses `time` so older Supabase schemas can still degrade gracefully.
type TaskRow = {
  id: string;
  taskId: string | null;
  title: string;
  notes: string;
  ongoingProjectId: string | null;
  status: RowStatus;
  time: string;
  detailColor: DetailColor;
  priorityDismissed: boolean;
};

type MiscTask = {
  id: string;
  text: string;
};

type OngoingProject = {
  id: string;
  title: string;
  notes: string;
};

type DraggedTaskRow = {
  dayKey: string;
  rowId: string;
};

type ActiveNotesEditor = {
  dayKey: string;
  rowId: string;
  createdAt: string | null;
  taskTitle: string;
  notes: string;
  ongoingProjectId: string | null;
  status: RowStatus;
  time: string;
  detailColor: DetailColor;
  priorityDismissed: boolean;
};

type ActiveStatusEditor = {
  dayKey: string;
  rowId: string;
  status: string;
  color: DetailColor;
};

type ActiveTimeEditor = {
  dayKey: string;
  rowId: string;
  time: string;
};

type ActivePriorityPicker = {
  dayKey: string;
  rowId: string;
  value: string;
  color: DetailColor;
};

type PendingRowDelete = {
  dayKey: string;
  rowId: string;
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

type OngoingProjectTarget = {
  projectId: string;
  weekKey: string;
  dayKey: string;
  rowId: string;
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

type PlannerTask = {
  id: string;
  title: string;
  notes: string;
  ongoingProjectId: string | null;
  status: RowStatus;
  time: string;
  detailColor: DetailColor;
  priorityDismissed: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlannerPlacement = {
  id: string;
  taskId: string | null;
  dayKey: string;
  weekStart: string;
  dayIndex: number;
  rowIndex: number;
  updatedAt: string;
};

type PlannerState = {
  tasks: Record<string, PlannerTask>;
  placementsByDay: Record<string, PlannerPlacement[]>;
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

type ThemeName = 'auto' | 'white' | 'paper' | 'night' | 'sepia' | 'blueprint';
type LanguageCode = 'en' | 'ru';
type TextForm = 'formal' | 'informal';
type GridlineMode = 'default' | 'crazy-minimalist';
type RowStatus = string;
type DetailColor = 'default' | 'blue' | 'green' | 'amber' | 'pink' | 'violet';
type TimeInputFormat = '24h' | 'ampm';
type PlannerView = 'weekly' | 'monthly' | 'yearly';

const ROW_COUNT = 1;
const MAX_ROW_COUNT = 16;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STORAGE_VERSION = 'v2';
const LEGACY_STORAGE_PREFIX = 'dnevnik-week';
const LEGACY_MISC_STORAGE_PREFIX = 'dnevnik-misc';
const LEGACY_DIRTY_WEEKS_STORAGE_KEY = 'dnevnik-dirty-weeks';
const STORAGE_PREFIX = `dnevnik-${STORAGE_VERSION}-week`;
const PLANNER_STATE_STORAGE_KEY = `dnevnik-${STORAGE_VERSION}-planner-state`;
const MISC_STORAGE_PREFIX = `dnevnik-${STORAGE_VERSION}-misc`;
const ONGOING_PROJECTS_STORAGE_KEY = `dnevnik-${STORAGE_VERSION}-ongoing-projects`;
const DIRTY_WEEKS_STORAGE_KEY = `dnevnik-${STORAGE_VERSION}-dirty-weeks`;
const PLANNER_VIEW_STORAGE_KEY = 'dnevnik-planner-view';
const THEME_STORAGE_KEY = 'dnevnik-theme';
const LANGUAGE_STORAGE_KEY = 'dnevnik-language';
const TEXT_FORM_STORAGE_KEY = 'dnevnik-text-form';
const GRIDLINE_MODE_STORAGE_KEY = 'dnevnik-gridlines';
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
const TEMP_BETA_BUILD = import.meta.env.VITE_BETA_BUILD ?? 'beta 0.0.1';

const UI_TEXT = {
  en: {
    plannerSettings: 'Planner Settings',
    menu: 'Menu',
    signedInUser: 'Signed in user',
    weeklyPlanner: 'Weekly Planner',
    monthlyPlanner: 'Monthly Planner',
    yearlyPlanner: 'Yearly Planner',
    loadingWeek: 'Loading this week from Supabase...',
    savingStatus: 'Saving...',
    savedStatus: 'Saved',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    today: 'Today',
    dragToTodayToEdit: 'Drag to Today to edit',
    dragToTodayButtonHint: 'Drag here to move to today',
    pastWeekEditHint: "You can't edit past weeks. If you want to edit, drag project to Today.",
    calendar: 'Calendar',
    search: 'Search',
    unassigned: 'Unassigned',
    unassignedTitle: 'Unassigned tasks',
    unassignedCopy: 'Whatever you type here stays unassigned until you place it.',
    ongoingProjects: 'Ongoing',
    ongoingProjectsTitle: 'Ongoing projects',
    ongoingProjectsCopy: 'Pinned long-term projects and details live here.',
    ongoingProjectsEmpty: 'Nothing pinned yet.',
    ongoingProjectsAdd: '+ Add ongoing project',
    ongoingProjectTitlePlaceholder: 'Project title',
    ongoingProjectNotesPlaceholder: 'Details',
    deleteOngoingProject: 'Delete ongoing project',
    scheduledFor: 'Scheduled for',
    createdOn: 'Created on',
    searchShortcutHint: 'Open with Cmd/Ctrl+F',
    searchPlaceholder: 'Search tasks and details',
    noMatchingTasks: 'No matching tasks',
    openAccount: 'Open account and settings',
    accountSettings: 'Account and settings',
    cloudMode: 'Cloud Mode',
    localMode: 'Local Mode',
    demoMode: 'Demo Mode',
    demoModeTitle: 'Preview the planner',
    demoModeCopy: 'Click around freely. Sign up to sync and store your data in the beta.',
    demoModeBanner: 'Demo mode',
    connectedAccount: 'Connected account',
    enableCloudSync: 'Add Supabase env vars to enable cloud sync.',
    theme: 'Theme',
    themeAuto: 'Automatic',
    themeNote: 'Automatic follows your local time and switches between white and dark.',
    language: 'Language',
    languageNote: 'Interface language only. Your tasks and notes stay unchanged.',
    textForm: 'Text form',
    textFormNote: 'Interface text only. Informal mode switches the UI to lowercase.',
    textFormFormal: 'Formal',
    textFormInformal: 'Informal',
    gridlines: 'Gridline design',
    gridlinesNote: 'Changes the planner rules and button outlines.',
    gridlinesDefault: 'Gridlines',
    gridlinesNoGridlines: 'No gridlines',
    gridlinesInformalDefault: 'Ugly gridlines',
    gridlinesInformalMinimal: 'Big4 trauma',
    languageEnglish: 'English',
    languageRussian: 'Russian',
    languageComingSoon: 'Other languages coming soon',
    themeWhite: 'White',
    themePaper: 'Paper',
    themeNight: 'Dark',
    themeSepia: 'Sepia',
    themeBlueprint: 'Blueprint',
    signOut: 'Sign out',
    appName: 'Nev',
    authTitle: 'Sign in to sync your weekly planner',
    authCopy: 'Your tasks, notes, and weekly spreads will be stored in Supabase and tied to your account.',
    inviteOnlyAuthTitle: 'Invite-only beta access',
    inviteOnlyAuthCopy: 'Sign in with an approved Google account to open your planner. Unapproved accounts will be signed out automatically.',
    inviteOnlyAuthContact: 'To participate in beta test contact alan@dautaln.com',
    email: 'Email',
    password: 'Password',
    working: 'Working...',
    signIn: 'Sign in',
    signUp: 'Sign up',
    continueWithGoogle: 'Continue with Google',
    continueWithGithub: 'Continue with GitHub',
    inviteOnlyMessage: 'This beta is invite-only. Ask for access before signing in.',
    browseDemo: 'Back to demo',
    signedInAs: (email: string) => `Signed in as ${email}.`,
    accountCreated: (email: string) => `Account created for ${email}. Check your email if confirmation is required.`,
    task: 'Project',
    taskEnterHint: 'Open notes with Enter',
    notes: 'Details',
    ongoingSet: 'Set as on-going',
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
    applyShortcutHint: 'Apply with Cmd/Ctrl+Enter',
    chooseWithArrowKeysHint: 'Choose with arrow keys',
    time: 'Time',
    timeSet: 'Set deadline time',
    timeFormatLabel: 'Format',
    timeFormat24h: '24-hour',
    timeFormatAmpm: 'AM/PM',
    timeInvalid24h: 'Use HH:MM in 24-hour format.',
    timeInvalidAmpm: 'Use h:mm AM/PM.',
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
    deleteRowConfirm: 'This row already has content. Delete it anyway?',
    confirmDeleteTitle: 'Delete row?',
    confirmDeleteCopy: 'This row already has content. Delete it anyway?',
    confirmDelete: 'Confirm',
    cancel: 'Cancel',
    addRow: '+ Add row',
    rowLimitReached: (limit: number) => `Row limit reached (${limit})`,
    taskNotes: 'Project Details',
    notesShortcutHint: 'Save and close with Cmd/Ctrl+Enter',
    untitledTask: 'Untitled task',
    body: 'Body',
    large: 'Large',
    title: 'Title',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    close: 'Close',
    miscTasksTitle: 'Miscellaneous tasks',
    miscTasksPlaceholder: "What's on your mind?",
    miscTasksTypedHint: 'appears in unassigned',
    miscTasksSubmitHint: 'save with Enter',
    miscTasksSend: 'Add task',
    miscTasksEmpty: "Whatever's on your mind will appear here, you can assign it whenever.",
    miscTasksLimitReached: 'assign first',
    deleteMiscTask: 'Delete misc task',
  },
  ru: {
    plannerSettings: 'Настройки планера',
    menu: 'Меню',
    signedInUser: 'Пользователь',
    weeklyPlanner: 'Еженедельник',
    monthlyPlanner: 'Ежемесячник',
    yearlyPlanner: 'Годовой планер',
    loadingWeek: 'Загрузка недели из Supabase...',
    savingStatus: 'Сохранение...',
    savedStatus: 'Сохранено',
    previousWeek: 'Предыдущая неделя',
    nextWeek: 'Следующая неделя',
    today: 'Сегодня',
    dragToTodayToEdit: 'Перетащите в Сегодня, чтобы редактировать',
    dragToTodayButtonHint: 'Перетащите сюда, чтобы перенести на сегодня',
    pastWeekEditHint: 'Прошлые недели нельзя редактировать. Чтобы изменить проект, перетащите его в Сегодня.',
    calendar: 'Календарь',
    search: 'Поиск',
    unassigned: 'Нераспределенные',
    unassignedTitle: 'Нераспределенные задачи',
    unassignedCopy: 'Все, что вы вводите здесь, останется нераспределенным, пока вы это не назначите.',
    ongoingProjects: 'Постоянные',
    ongoingProjectsTitle: 'Постоянные проекты',
    ongoingProjectsCopy: 'Здесь живут закрепленные долгосрочные проекты и детали.',
    ongoingProjectsEmpty: 'Пока ничего не закреплено.',
    ongoingProjectsAdd: '+ Добавить проект',
    ongoingProjectTitlePlaceholder: 'Название проекта',
    ongoingProjectNotesPlaceholder: 'Детали',
    deleteOngoingProject: 'Удалить постоянный проект',
    scheduledFor: 'Запланировано на',
    createdOn: 'Создано',
    searchShortcutHint: 'Открыть через Cmd/Ctrl+F',
    searchPlaceholder: 'Поиск по задачам и деталям',
    noMatchingTasks: 'Ничего не найдено',
    openAccount: 'Открыть аккаунт и настройки',
    accountSettings: 'Аккаунт и настройки',
    cloudMode: 'Облако',
    localMode: 'Локально',
    demoMode: 'Демо',
    demoModeTitle: 'Просмотр планера',
    demoModeCopy: 'Свободно изучайте интерфейс. Чтобы синхронизировать и сохранять данные, подайте заявку в бета-доступ.',
    demoModeBanner: 'Демо-режим',
    connectedAccount: 'Подключенный аккаунт',
    enableCloudSync: 'Добавьте переменные Supabase, чтобы включить облачную синхронизацию.',
    theme: 'Тема',
    themeAuto: 'Авто',
    themeNote: 'Авто использует ваше локальное время и переключается между белой и тёмной темой.',
    language: 'Язык',
    languageNote: 'Меняется только интерфейс. Задачи и заметки остаются без изменений.',
    textForm: 'Форма текста',
    textFormNote: 'Меняется только интерфейс. Неформальный режим переводит весь UI в нижний регистр.',
    textFormFormal: 'Обычная',
    textFormInformal: 'Неформальная',
    gridlines: 'Дизайн линий',
    gridlinesNote: 'Меняет линии планера и контуры кнопок.',
    gridlinesDefault: 'Линии',
    gridlinesNoGridlines: 'Без линий',
    gridlinesInformalDefault: 'Некрасивые линии',
    gridlinesInformalMinimal: 'Травма big4',
    languageEnglish: 'English',
    languageRussian: 'Русский',
    languageComingSoon: 'Скоро появятся другие языки',
    themeWhite: 'Белая',
    themePaper: 'Бумага',
    themeNight: 'Тёмная',
    themeSepia: 'Сепия',
    themeBlueprint: 'Чертеж',
    signOut: 'Выйти',
    appName: 'Nev',
    authTitle: 'Войдите, чтобы синхронизировать ваш еженедельник',
    authCopy: 'Ваши задачи, заметки и недельные развороты будут храниться в Supabase и привязаны к аккаунту.',
    inviteOnlyAuthTitle: 'Бета-доступ по приглашению',
    inviteOnlyAuthCopy: 'Войдите через одобренный Google-аккаунт, чтобы открыть планер. Неодобренные аккаунты будут автоматически выходить из системы.',
    inviteOnlyAuthContact: 'Чтобы участвовать в бета-тесте, напишите на alan@dautaln.com',
    email: 'Почта',
    password: 'Пароль',
    working: 'Загрузка...',
    signIn: 'Войти',
    signUp: 'Регистрация',
    continueWithGoogle: 'Продолжить через Google',
    continueWithGithub: 'Продолжить через GitHub',
    inviteOnlyMessage: 'Это закрытая бета по приглашениям. Сначала добавьте почту в список доступа.',
    browseDemo: 'Вернуться к демо',
    signedInAs: (email: string) => `Вы вошли как ${email}.`,
    accountCreated: (email: string) => `Аккаунт для ${email} создан. Проверьте почту, если требуется подтверждение.`,
    task: 'Проект',
    taskEnterHint: 'Открыть заметки через Enter',
    notes: 'Детали',
    ongoingSet: 'Сделать постоянным',
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
    applyShortcutHint: 'Применить: Cmd/Ctrl+Enter',
    chooseWithArrowKeysHint: 'Выбор стрелками',
    time: 'Время',
    timeSet: 'Указать дедлайн',
    timeFormatLabel: 'Формат',
    timeFormat24h: '24 часа',
    timeFormatAmpm: 'AM/PM',
    timeInvalid24h: 'Используйте HH:MM в 24-часовом формате.',
    timeInvalidAmpm: 'Используйте h:mm AM/PM.',
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
    deleteRowConfirm: 'В этой строке уже есть данные. Все равно удалить?',
    confirmDeleteTitle: 'Удалить строку?',
    confirmDeleteCopy: 'В этой строке уже есть данные. Все равно удалить?',
    confirmDelete: 'Подтвердить',
    cancel: 'Отмена',
    addRow: '+ Добавить строку',
    rowLimitReached: (limit: number) => `Достигнут лимит строк (${limit})`,
    taskNotes: 'Детали проекта',
    notesShortcutHint: 'Сохранить и закрыть: Cmd/Ctrl+Enter',
    untitledTask: 'Без названия',
    body: 'Обычный',
    large: 'Крупный',
    title: 'Заголовок',
    previousYear: 'Предыдущий год',
    nextYear: 'Следующий год',
    close: 'Закрыть',
    miscTasksTitle: 'Разные задачи',
    miscTasksPlaceholder: 'Что у вас на уме?',
    miscTasksTypedHint: 'появится в нераспределенных',
    miscTasksSubmitHint: 'сохранить через Enter',
    miscTasksSend: 'Добавить задачу',
    miscTasksEmpty: 'Все, что у вас на уме, будет появляться здесь, и вы сможете назначить это позже.',
    miscTasksLimitReached: 'сначала назначьте',
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
const ALLOWED_NOTE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'P', 'DIV', 'BR', 'H2', 'H3', 'PRE']);

type UiText = (typeof UI_TEXT)[LanguageCode];

function createEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyPlannerState(): PlannerState {
  return {
    tasks: {},
    placementsByDay: {},
  };
}

function getDateLocale(language: LanguageCode) {
  return language === 'ru' ? 'ru-RU' : 'en-US';
}

function getPlannerDayDate(dayKey: string) {
  const dateKey = dayKey.split('-').slice(1).join('-');
  return new Date(`${dateKey}T12:00:00`);
}

function formatPlannerDayLabel(dayKey: string, language: LanguageCode, textForm: TextForm) {
  const date = getPlannerDayDate(dayKey);
  return applyTextFormToString(
    date.toLocaleDateString(getDateLocale(language), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    textForm,
  );
}

function getPlannerDayCreatedAt(dayKey: string) {
  return getPlannerDayDate(dayKey).toISOString();
}

function formatPlannerDateLabel(value: string, language: LanguageCode, textForm: TextForm) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return applyTextFormToString(
    date.toLocaleDateString(getDateLocale(language), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    textForm,
  );
}

function resolveThemeByLocalTime(date: Date): Exclude<ThemeName, 'auto'> {
  const hour = date.getHours();
  return hour >= 7 && hour < 19 ? 'white' : 'night';
}

function applyInformalTextForm<T>(value: T): T {
  const toInformalString = (text: string) =>
    text
      .toLowerCase()
      .replace(/\.{3}/g, '')
      .replace(/\.(?=\s|$)/g, '');

  if (typeof value === 'string') {
    return toInformalString(value) as T;
  }

  if (typeof value === 'function') {
    return (((...args: unknown[]) => toInformalString(String((value as (...innerArgs: unknown[]) => unknown)(...args)))) as unknown) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => applyInformalTextForm(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, applyInformalTextForm(entry)]),
    ) as T;
  }

  return value;
}

function applyTextFormToString(value: string, textForm: TextForm) {
  return textForm === 'informal' ? value.toLowerCase() : value;
}

function getGridlineOptionLabel(mode: GridlineMode, ui: UiText, textForm: TextForm) {
  if (textForm === 'informal') {
    return mode === 'default' ? ui.gridlinesInformalDefault : ui.gridlinesInformalMinimal;
  }

  return mode === 'default' ? ui.gridlinesDefault : ui.gridlinesNoGridlines;
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
  if (!isPresetStatus(row.status)) {
    return row.status.trim();
  }

  return '';
}

function getPriorityVisualClass(row: TaskRow) {
  const customDetail = getCustomDetailValue(row);

  if (customDetail) {
    return `priority-detail-${row.detailColor}`;
  }

  if (row.status !== 'none') {
    return `priority-status-${row.status}`;
  }

  if (row.ongoingProjectId) {
    return 'priority-ongoing';
  }

  return '';
}

function normalizePriorityAndTime(status: RowStatus, time: string) {
  const trimmedTime = time.trim();

  // Older builds reused `time` to store custom priority/detail text. Migrate those
  // legacy values into the flexible status slot, while keeping real HH:MM deadline
  // values in `time`.
  if (status === 'none' && trimmedTime && !/^\d{1,2}:\d{2}$/.test(trimmedTime)) {
    return {
      status: trimmedTime,
      time: '',
    };
  }

  return {
    status,
    time,
  };
}

function parseTimeForStorage(value: string, format: TimeInputFormat) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (format === '24h') {
    const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);

    if (!match) {
      return null;
    }

    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  const match = trimmed.match(/^(1[0-2]|0?[1-9]):([0-5]\d)\s*([AaPp][Mm])$/);

  if (!match) {
    return null;
  }

  const [, rawHour, minutes, meridiem] = match;
  const hour = Number.parseInt(rawHour, 10);
  const normalizedHour =
    meridiem.toUpperCase() === 'PM'
      ? hour === 12
        ? 12
        : hour + 12
      : hour === 12
        ? 0
        : hour;

  return `${String(normalizedHour).padStart(2, '0')}:${minutes}`;
}

function formatStoredTimeForInput(value: string, format: TimeInputFormat) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const canonical = parseTimeForStorage(trimmed, '24h');

  if (!canonical) {
    return trimmed;
  }

  if (format === '24h') {
    return canonical;
  }

  const [hoursText, minutes] = canonical.split(':');
  const hours = Number.parseInt(hoursText, 10);
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${twelveHour}:${minutes} ${meridiem}`;
}

function convertTimeInputFormat(value: string, currentFormat: TimeInputFormat, nextFormat: TimeInputFormat) {
  if (currentFormat === nextFormat) {
    return value;
  }

  const canonical = parseTimeForStorage(value, currentFormat);

  if (canonical === null) {
    return value;
  }

  return formatStoredTimeForInput(canonical, nextFormat);
}

function formatTimeInputDraft(rawValue: string, format: TimeInputFormat) {
  if (format === '24h') {
    const digits = rawValue.replace(/\D/g, '').slice(0, 4);

    if (digits.length <= 2) {
      return digits;
    }

    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  const upper = rawValue.toUpperCase();
  const meridiem = upper
    .replace(/[^APM]/g, '')
    .replace(/^([AP])M?.*$/, '$1M')
    .slice(0, 2);
  const rawTime = upper.replace(/[^0-9:]/g, '');
  const colonIndex = rawTime.indexOf(':');
  let timePart = '';

  if (colonIndex >= 0) {
    const rawHours = rawTime.slice(0, colonIndex).replace(/\D/g, '').slice(0, 2);
    const rawMinutes = rawTime.slice(colonIndex + 1).replace(/\D/g, '').slice(0, 2);
    const paddedHours = rawHours.length === 1 ? `0${rawHours}` : rawHours;
    timePart = rawMinutes ? `${paddedHours}:${rawMinutes}` : rawHours ? `${paddedHours}:` : '';
  } else {
    const digits = rawTime.replace(/\D/g, '').slice(0, 4);

    if (digits.length === 0) {
      timePart = '';
    } else if (digits.length === 1) {
      timePart = `0${digits}`;
    } else if (digits.length === 2) {
      timePart = digits;
    } else {
      timePart = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }
  }

  if (!meridiem) {
    return timePart;
  }

  return timePart ? `${timePart} ${meridiem}` : meridiem;
}

function sanitizeNoteHtml(html: string) {
  if (!html.trim()) {
    return '';
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');

  function sanitizeNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = node.textContent?.replace(/&nbsp;/g, ' ') ?? '';
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
    taskId: null,
    title: '',
    notes: '',
    ongoingProjectId: null,
    status: 'none',
    time: '',
    detailColor: 'default',
    priorityDismissed: false,
  };
}

function getPlacementSlotId(dayKey: string, rowIndex: number) {
  return `slot-${dayKey}-${rowIndex}`;
}

function buildPlacementContext(dayKey: string) {
  return {
    weekStart: getWeekKeyForDayKey(dayKey),
    dayIndex: getDayIndex(dayKey),
  };
}

function createEmptyPlacement(dayKey: string, rowIndex: number): PlannerPlacement {
  const context = buildPlacementContext(dayKey);
  return {
    id: getPlacementSlotId(dayKey, rowIndex),
    taskId: null,
    dayKey,
    weekStart: context.weekStart,
    dayIndex: context.dayIndex,
    rowIndex,
    updatedAt: new Date().toISOString(),
  };
}

function trimTrailingEmptyRows(dayKey: string, rows: TaskRow[]) {
  const normalizedRows = Array.from({ length: rows.length }, (_, index) => rows[index] ?? createEmptyRow(dayKey, index));

  while (normalizedRows.length > ROW_COUNT && isRowEmpty(normalizedRows[normalizedRows.length - 1])) {
    normalizedRows.pop();
  }

  if (normalizedRows.length === 0) {
    return createEmptyRows(dayKey);
  }

  return reindexRows(dayKey, normalizedRows);
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
  const normalizedStatus = normalizeStatus(row.status, row.completed);
  const rawTime =
    typeof row.time === 'string'
      ? row.time
      : typeof (row as Partial<TaskRecord>).task_time === 'string'
        ? (row as Partial<TaskRecord>).task_time ?? ''
        : '';
  const normalizedPriorityAndTime = normalizePriorityAndTime(normalizedStatus, rawTime);

  return {
    id: typeof row.id === 'string' ? row.id : `${dayKey}-${index}`,
    taskId: typeof row.taskId === 'string' && row.taskId ? row.taskId : null,
    title: typeof row.title === 'string' ? row.title : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    ongoingProjectId: typeof row.ongoingProjectId === 'string' && row.ongoingProjectId ? row.ongoingProjectId : null,
    status: normalizedPriorityAndTime.status,
    time: normalizedPriorityAndTime.time,
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
      normalized[weekKey][dayKey] = trimTrailingEmptyRows(
        dayKey,
        rows.map((row, index) => normalizeTaskRow(row, dayKey, index)),
      );
    }
  }

  return normalized;
}

function createPlannerTaskFromRow(row: TaskRow, fallbackId: string, dayKey: string): PlannerTask {
  return {
    id: row.taskId ?? fallbackId,
    title: row.title,
    notes: row.notes,
    ongoingProjectId: row.ongoingProjectId,
    status: row.status,
    time: row.time,
    detailColor: row.detailColor,
    priorityDismissed: row.priorityDismissed,
    createdAt: getPlannerDayCreatedAt(dayKey),
    updatedAt: new Date().toISOString(),
  };
}

function buildPlannerStateFromLegacyWeeks(weeks: Record<string, Record<string, TaskRow[]>>): PlannerState {
  const state = createEmptyPlannerState();

  for (const week of Object.values(weeks)) {
    for (const [dayKey, rows] of Object.entries(week)) {
      state.placementsByDay[dayKey] = rows.map((row, rowIndex) => {
        const taskId =
          row.taskId ??
          (isRowEmpty(row) ? null : `task-${typeof row.id === 'string' && row.id ? row.id : createEntityId('task')}`);

        if (taskId) {
          state.tasks[taskId] = createPlannerTaskFromRow(row, taskId, dayKey);
        }

        const context = buildPlacementContext(dayKey);
        return {
          id: typeof row.id === 'string' && row.id ? row.id : getPlacementSlotId(dayKey, rowIndex),
          taskId,
          dayKey,
          weekStart: context.weekStart,
          dayIndex: context.dayIndex,
          rowIndex,
          updatedAt: new Date().toISOString(),
        };
      });
    }
  }

  return state;
}

function normalizePlannerState(raw: PlannerState): PlannerState {
  const tasks: Record<string, PlannerTask> = {};
  for (const [taskId, task] of Object.entries(raw.tasks ?? {})) {
    tasks[taskId] = {
      id: taskId,
      title: typeof task.title === 'string' ? task.title : '',
      notes: typeof task.notes === 'string' ? task.notes : '',
      ongoingProjectId: typeof task.ongoingProjectId === 'string' && task.ongoingProjectId ? task.ongoingProjectId : null,
      status: normalizeStatus(task.status),
      time: typeof task.time === 'string' ? task.time : '',
      detailColor: normalizeDetailColor(task.detailColor),
      priorityDismissed: Boolean(task.priorityDismissed),
      createdAt: typeof task.createdAt === 'string' && task.createdAt ? task.createdAt : new Date().toISOString(),
      updatedAt: typeof task.updatedAt === 'string' && task.updatedAt ? task.updatedAt : new Date().toISOString(),
    };
  }

  const placementsByDay: Record<string, PlannerPlacement[]> = {};
  for (const [dayKey, placements] of Object.entries(raw.placementsByDay ?? {})) {
    const context = buildPlacementContext(dayKey);
    placementsByDay[dayKey] = [...placements]
      .map((placement, rowIndex) => ({
        id: typeof placement.id === 'string' && placement.id ? placement.id : getPlacementSlotId(dayKey, rowIndex),
        taskId: typeof placement.taskId === 'string' && placement.taskId ? placement.taskId : null,
        dayKey,
        weekStart: context.weekStart,
        dayIndex: context.dayIndex,
        rowIndex:
          typeof placement.rowIndex === 'number' && Number.isFinite(placement.rowIndex) ? placement.rowIndex : rowIndex,
        updatedAt: typeof placement.updatedAt === 'string' && placement.updatedAt ? placement.updatedAt : new Date().toISOString(),
      }))
      .sort((left, right) => left.rowIndex - right.rowIndex)
      .map((placement, rowIndex) => ({ ...placement, rowIndex }));
  }

  return {
    tasks,
    placementsByDay,
  };
}

function getPlannerPlacementsForDay(state: PlannerState, dayKey: string): PlannerPlacement[] {
  const placements = state.placementsByDay[dayKey];
  if (!placements || placements.length === 0) {
    return [createEmptyPlacement(dayKey, 0)];
  }

  return placements;
}

function buildTaskRowFromPlacement(state: PlannerState, dayKey: string, placement: PlannerPlacement, rowIndex: number): TaskRow {
  const task = placement.taskId ? state.tasks[placement.taskId] : null;
  const baseRow = createEmptyRow(dayKey, rowIndex);
  return {
    ...baseRow,
    id: placement.id,
    taskId: placement.taskId,
    title: task?.title ?? '',
    notes: task?.notes ?? '',
    ongoingProjectId: task?.ongoingProjectId ?? null,
    status: task?.status ?? 'none',
    time: task?.time ?? '',
    detailColor: task?.detailColor ?? 'default',
    priorityDismissed: task?.priorityDismissed ?? false,
  };
}

function projectRowsForDay(state: PlannerState, dayKey: string): TaskRow[] {
  return getPlannerPlacementsForDay(state, dayKey).map((placement, rowIndex) => buildTaskRowFromPlacement(state, dayKey, placement, rowIndex));
}

function projectLegacyWeeksFromPlannerState(state: PlannerState): Record<string, Record<string, TaskRow[]>> {
  const weeks: Record<string, Record<string, TaskRow[]>> = {};

  for (const dayKey of Object.keys(state.placementsByDay)) {
    const weekKey = getWeekKeyForDayKey(dayKey);
    weeks[weekKey] ??= {};
    weeks[weekKey][dayKey] = projectRowsForDay(state, dayKey);
  }

  return weeks;
}

function mergePlannerStateForWeek(current: PlannerState, weekKey: string, nextWeekRows: Record<string, TaskRow[]>): PlannerState {
  const nextWeekState = buildPlannerStateFromLegacyWeeks({ [weekKey]: nextWeekRows });
  const nextPlacementsByDay = { ...current.placementsByDay };
  const nextTasks = { ...current.tasks };

  for (const [dayKey, placements] of Object.entries(nextWeekState.placementsByDay)) {
    const existingPlacements = current.placementsByDay[dayKey] ?? [];
    for (const placement of existingPlacements) {
      if (placement.taskId) {
        delete nextTasks[placement.taskId];
      }
    }

    nextPlacementsByDay[dayKey] = placements;
    placements.forEach((placement) => {
      if (placement.taskId && nextWeekState.tasks[placement.taskId]) {
        nextTasks[placement.taskId] = nextWeekState.tasks[placement.taskId];
      }
    });
  }

  return {
    tasks: nextTasks,
    placementsByDay: nextPlacementsByDay,
  };
}

function reindexRows(dayKey: string, rows: TaskRow[]) {
  return rows.map((row, index) => ({
    ...createEmptyRow(dayKey, index),
    taskId: row.taskId,
    title: row.title,
    notes: row.notes,
    ongoingProjectId: row.ongoingProjectId,
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

function formatSheetRange(days: DayData[], language: LanguageCode, textForm: TextForm) {
  const first = days[0];
  const last = days[days.length - 1];
  const [, ...firstDateParts] = first.key.split('-');
  const firstDate = new Date(`${firstDateParts.join('-')}T00:00:00`);
  const month = firstDate.toLocaleString(getDateLocale(language), { month: 'long' });
  const firstDay = String(firstDate.getDate());
  const [, ...lastDateParts] = last.key.split('-');
  const lastDate = new Date(`${lastDateParts.join('-')}T00:00:00`);
  const lastDay = String(lastDate.getDate());
  const value = `${month.toUpperCase()} ${firstDay}-${lastDay}`;
  return applyTextFormToString(value, textForm);
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

function getMonthCalendar(year: number, month: number, language: LanguageCode, textForm: TextForm): CalendarMonth {
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
    label: applyTextFormToString(new Date(year, month, 1).toLocaleString(getDateLocale(language), { month: 'long' }), textForm),
    weeks,
  };
}

function shiftMonth(date: Date, offset: number) {
  const next = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildDays(monday: Date, saved: Record<string, TaskRow[]>, language: LanguageCode, textForm: TextForm): DayData[] {
  return DAY_NAMES.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = `${label.toLowerCase()}-${formatDateKey(date)}`;
    const rows = saved[key] ?? createEmptyRows(key);

    return {
      key,
      label: applyTextFormToString(DAY_LABELS[language][index], textForm),
      date: applyTextFormToString(
        date.toLocaleString(getDateLocale(language), {
          month: 'short',
          day: 'numeric',
        }),
        textForm,
      ),
      rows,
    };
  });
}

function getDayIndex(dayKey: string) {
  const weekday = dayKey.split('-')[0];
  return DAY_NAMES.findIndex((day) => day.toLowerCase() === weekday);
}

function getWeekKeyForDayKey(dayKey: string) {
  const dateKey = dayKey.split('-').slice(1).join('-');
  return formatWeekKey(getMonday(new Date(`${dateKey}T00:00:00`)));
}

function getDayKeyForWeekAndIndex(targetWeekKey: string, dayIndex: number) {
  const monday = parseWeekKey(targetWeekKey);
  const date = new Date(monday);
  date.setDate(monday.getDate() + dayIndex);
  return `${DAY_NAMES[dayIndex].toLowerCase()}-${formatDateKey(date)}`;
}

function isWeekBefore(sourceWeekKey: string, targetWeekKey: string) {
  return parseWeekKey(sourceWeekKey).getTime() < parseWeekKey(targetWeekKey).getTime();
}

function isRowEmpty(row: TaskRow) {
  return (
    row.title.trim() === '' &&
    row.notes.trim() === '' &&
    row.ongoingProjectId === null &&
    row.status === 'none' &&
    row.time.trim() === ''
  );
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
      taskId: `task-${dayKey}-${record.row_index}`,
      title: record.title,
      notes: record.notes,
      ongoingProjectId: null,
      ...normalizePriorityAndTime(normalizeStatus(record.status), record.task_time ?? ''),
      detailColor: normalizeDetailColor(record.detail_color),
      priorityDismissed: false,
    };
  }

  for (const [dayKey, rows] of Object.entries(mapped)) {
    mapped[dayKey] = trimTrailingEmptyRows(dayKey, rows);
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
    .replace(/&nbsp;/g, ' ')
<<<<<<< ours
    .replace(/<(p|div|h1|h2|h3|ul|ol)[^>]*>/g, '\n')
    .replace(/<li[^>]*>/g, '\n• ')
    .replace(/<\/li>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|div|h1|h2|h3|ul|ol)>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
=======
    .replace(/<li>/g, '• ')
    .replace(/<\/li>/g, ' ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<\/(p|div|h1|h2|h3|ul|ol)>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
>>>>>>> theirs
    .trim();
}

function buildSearchResults(savedWeeks: Record<string, Record<string, TaskRow[]>>, query: string, language: LanguageCode, textForm: TextForm) {
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
        dayIndex >= 0 ? applyTextFormToString(DAY_LABELS[language][dayIndex], textForm) : applyTextFormToString(`${weekday[0].toUpperCase()}${weekday.slice(1)}`, textForm);
      const dateLabel = applyTextFormToString(
        labelDate.toLocaleDateString(getDateLocale(language), {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        textForm,
      );

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

function createOngoingProject(): OngoingProject {
  return {
    id: `ongoing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    notes: '',
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

function normalizeOngoingProjects(raw: Array<Partial<OngoingProject>>) {
  return raw.map((project, index) => ({
    id: typeof project.id === 'string' && project.id ? project.id : `ongoing-${index}`,
    title: typeof project.title === 'string' ? project.title : '',
    notes: typeof project.notes === 'string' ? project.notes : '',
  }));
}

function buildOngoingProjectTargets(state: PlannerState) {
  const targets = new Map<string, OngoingProjectTarget>();

  for (const [dayKey, placements] of Object.entries(state.placementsByDay)) {
    const weekKey = getWeekKeyForDayKey(dayKey);

    for (const placement of placements) {
      if (!placement.taskId) {
        continue;
      }

      const task = state.tasks[placement.taskId];
      if (!task?.ongoingProjectId || targets.has(task.ongoingProjectId)) {
        continue;
      }

      targets.set(task.ongoingProjectId, {
        projectId: task.ongoingProjectId,
        weekKey,
        dayKey,
        rowId: placement.id,
      });
    }
  }

  return targets;
}

function buildDemoPlannerState(baseMonday: Date, ongoingProjects: OngoingProject[]): PlannerState {
  const currentWeekKey = formatWeekKey(baseMonday);
  const nextWeekKey = shiftWeekKeyByOffset(currentWeekKey, 1);
  const adminOngoingId = ongoingProjects[0]?.id ?? null;
  const planningOngoingId = ongoingProjects[1]?.id ?? null;

  const demoWeeks = normalizeSavedWeeks({
    [currentWeekKey]: {
      [getDayKeyForWeekAndIndex(currentWeekKey, 0)]: [
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 0)}-0`,
          title: 'Weekly planning session',
          notes: '<p>Outline the top priorities for the week and leave room for lighter admin work.</p>',
          status: 'urgent',
          time: '10:00',
          detailColor: 'amber',
          ongoingProjectId: planningOngoingId,
        },
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 0)}-1`,
          title: 'Reply to messages',
          notes: '<p>Catch up on inbox items and any small follow-ups that can be closed quickly.</p>',
          status: 'low',
          time: '18:30',
          detailColor: 'blue',
          ongoingProjectId: adminOngoingId,
        },
      ],
      [getDayKeyForWeekAndIndex(currentWeekKey, 1)]: [
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 1)}-0`,
          title: 'Prepare meeting notes',
          notes: '<p>Gather updates, open questions, and a short list of decisions to make.</p>',
          status: 'critical',
          detailColor: 'pink',
          ongoingProjectId: planningOngoingId,
        },
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 1)}-1`,
          title: 'Deep work block',
          notes: '<p>Reserve uninterrupted time for one larger task or a note-heavy thinking session.</p>',
          status: 'none',
          detailColor: 'default',
        },
      ],
      [getDayKeyForWeekAndIndex(currentWeekKey, 2)]: [
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 2)}-0`,
          title: 'Personal reminders',
          notes: '<p>Use this row as a quick scratch area for errands, notes, or reminders.</p>',
          status: 'none',
          detailColor: 'violet',
        },
      ],
      [getDayKeyForWeekAndIndex(currentWeekKey, 3)]: [
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 3)}-0`,
          title: 'Complete presentation draft',
          notes: '<ul><li>Review structure</li><li>Add final examples</li><li>Trim unnecessary detail</li></ul>',
          status: 'done',
          detailColor: 'green',
          ongoingProjectId: planningOngoingId,
        },
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 3)}-1`,
          title: 'Update shared checklist',
          notes: '<p>Refresh the running checklist with any new blockers, tasks, or next steps.</p>',
          status: 'low',
          detailColor: 'blue',
        },
      ],
      [getDayKeyForWeekAndIndex(currentWeekKey, 4)]: [
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 4)}-0`,
          title: 'Weekly review',
          notes: '<p>Capture what moved forward well this week and what should be carried over.</p>',
          status: 'urgent',
          time: '16:00',
          detailColor: 'amber',
        },
      ],
      [getDayKeyForWeekAndIndex(currentWeekKey, 5)]: [
        {
          id: `${getDayKeyForWeekAndIndex(currentWeekKey, 5)}-0`,
          title: 'Weekend planning',
          notes: '<p>Keep a lighter row for personal admin, errands, or a reset for next week.</p>',
          status: 'none',
          detailColor: 'default',
        },
      ],
    },
    [nextWeekKey]: {
      [getDayKeyForWeekAndIndex(nextWeekKey, 0)]: [
        {
          id: `${getDayKeyForWeekAndIndex(nextWeekKey, 0)}-0`,
          title: 'Plan next sprint',
          notes: '<p>Use this future week to preview how projects and notes can move forward.</p>',
          status: 'urgent',
          detailColor: 'amber',
          ongoingProjectId: planningOngoingId,
        },
      ],
      [getDayKeyForWeekAndIndex(nextWeekKey, 2)]: [
        {
          id: `${getDayKeyForWeekAndIndex(nextWeekKey, 2)}-0`,
          title: 'Research session',
          notes: '<p>Collect references, summarize ideas, and leave notes for later decisions.</p>',
          status: 'low',
          detailColor: 'blue',
        },
      ],
      [getDayKeyForWeekAndIndex(nextWeekKey, 4)]: [
        {
          id: `${getDayKeyForWeekAndIndex(nextWeekKey, 4)}-0`,
          title: 'Wrap-up and handoff',
          notes: '<p>Prepare a short summary of completed work and the next items to pick up.</p>',
          status: 'critical',
          detailColor: 'pink',
        },
      ],
    },
  });

  return buildPlannerStateFromLegacyWeeks(demoWeeks);
}

function buildDemoMiscTasks(baseMonday: Date): Record<string, MiscTask[]> {
  const weekKey = formatWeekKey(baseMonday);

  return {
    [weekKey]: [
      { id: 'demo-misc-1', text: 'ideas for next week' },
      { id: 'demo-misc-2', text: 'follow up on loose tasks' },
      { id: 'demo-misc-3', text: 'capture anything worth assigning later' },
    ],
  };
}

function buildDemoOngoingProjects(): OngoingProject[] {
  return [
    {
      id: 'demo-ongoing-admin',
      title: 'Admin and follow-ups',
      notes: 'A simple long-term place for recurring admin items, references, and reminders.',
    },
    {
      id: 'demo-ongoing-planning',
      title: 'Long-term planning',
      notes: 'Pinned notes for ideas, larger projects, and anything that should stay visible beyond one week.',
    },
  ];
}

function isPlannerStateEmpty(state: PlannerState) {
  return Object.keys(state.tasks).length === 0 && Object.keys(state.placementsByDay).length === 0;
}

function hasAnyMiscTasks(tasksByWeek: Record<string, MiscTask[]>) {
  return Object.values(tasksByWeek).some((tasks) => tasks.length > 0);
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
const MAX_MISC_TASKS = 10;

function App() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [plannerState, setPlannerState] = useState<PlannerState>(() => createEmptyPlannerState());
  const [activeNotesEditor, setActiveNotesEditor] = useState<ActiveNotesEditor | null>(null);
  const [activeStatusEditor, setActiveStatusEditor] = useState<ActiveStatusEditor | null>(null);
  const [activeTimeEditor, setActiveTimeEditor] = useState<ActiveTimeEditor | null>(null);
  const [activePriorityPicker, setActivePriorityPicker] = useState<ActivePriorityPicker | null>(null);
  const [pendingRowDelete, setPendingRowDelete] = useState<PendingRowDelete | null>(null);
  const [miscTasksByWeek, setMiscTasksByWeek] = useState<Record<string, MiscTask[]>>({});
  const [ongoingProjects, setOngoingProjects] = useState<OngoingProject[]>([]);
  const [miscTaskInput, setMiscTaskInput] = useState('');
  const [draggedMiscTaskId, setDraggedMiscTaskId] = useState<string | null>(null);
  const [draggedTaskRow, setDraggedTaskRow] = useState<DraggedTaskRow | null>(null);
  const [language, setLanguage] = useState<LanguageCode>(() => 'en');
  const [textForm, setTextForm] = useState<TextForm>(() => {
    const savedTextForm = window.localStorage.getItem(TEXT_FORM_STORAGE_KEY);
    return savedTextForm === 'informal' ? 'informal' : 'formal';
  });
  const [gridlineMode, setGridlineMode] = useState<GridlineMode>(() => {
    const savedGridlineMode = window.localStorage.getItem(GRIDLINE_MODE_STORAGE_KEY);
    return savedGridlineMode === 'default' ? 'default' : 'crazy-minimalist';
  });
  const [theme, setTheme] = useState<ThemeName>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (
      savedTheme === 'auto' ||
      savedTheme === 'white' ||
      savedTheme === 'paper' ||
      savedTheme === 'night' ||
      savedTheme === 'sepia' ||
      savedTheme === 'blueprint'
    ) {
      return savedTheme;
    }

    return 'auto';
  });
  const [themeClock, setThemeClock] = useState(() => Date.now());
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [showInviteOnlyAuth, setShowInviteOnlyAuth] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [hasResolvedAuthState, setHasResolvedAuthState] = useState(() => !isSupabaseConfigured);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [showWeekLoadingBanner, setShowWeekLoadingBanner] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [storageError, setStorageError] = useState('');
  const [usesLegacyCompletedColumn, setUsesLegacyCompletedColumn] = useState(false);
  const [usesLegacyTimeColumn, setUsesLegacyTimeColumn] = useState(false);
  const [usesLegacyDetailColorColumn, setUsesLegacyDetailColorColumn] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isPlannerViewMenuOpen, setIsPlannerViewMenuOpen] = useState(false);
  const [isOngoingProjectsOpen, setIsOngoingProjectsOpen] = useState(false);
  const [isUnassignedOpen, setIsUnassignedOpen] = useState(false);
  const [isMobileHeaderMenuOpen, setIsMobileHeaderMenuOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() => new Date().getFullYear());
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [hasHydratedLocalCache, setHasHydratedLocalCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);
  const [pageTurn, setPageTurn] = useState<{ weekStart: Date; direction: 'forward' | 'backward' } | null>(null);
  const [plannerView, setPlannerView] = useState<PlannerView>(() => {
    const savedView = window.localStorage.getItem(PLANNER_VIEW_STORAGE_KEY);
    return savedView === 'monthly' ? 'monthly' : 'weekly';
  });
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const plannerViewMenuRef = useRef<HTMLDivElement | null>(null);
  const ongoingProjectsMenuRef = useRef<HTMLDivElement | null>(null);
  const unassignedMenuRef = useRef<HTMLDivElement | null>(null);
  const searchMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileHeaderMenuRef = useRef<HTMLDivElement | null>(null);
  const miscInboxInputRef = useRef<HTMLInputElement | null>(null);
  const previousWeekStartRef = useRef(weekStart);
  const plannerStateRef = useRef(plannerState);
  const queuedDaySyncsRef = useRef<Record<string, TaskRow[]>>({});
  const activeDaySyncsRef = useRef<Record<string, boolean>>({});
  const pendingDaySyncTimeoutsRef = useRef<Record<string, number>>({});
  const saveStateTimeoutRef = useRef<number | null>(null);
  const weekMutationVersionRef = useRef<Record<string, number>>({});
  const dirtyWeeksRef = useRef<Record<string, boolean>>({});
  const ui = useMemo(() => {
    const baseUi = UI_TEXT[language];
    return textForm === 'informal' ? applyInformalTextForm(baseUi) : baseUi;
  }, [language, textForm]);
  const allowedEmails = useMemo(() => parseAllowedEmails(import.meta.env.VITE_ALLOWED_EMAILS), []);
  const isInviteOnlyBeta = allowedEmails.size > 0;
  const weekKey = formatWeekKey(weekStart);
  const yearMonths = useMemo(
    () => MONTH_NAMES.map((_, monthIndex) => getMonthCalendar(visibleYear, monthIndex, language, textForm)),
    [visibleYear, language, textForm],
  );
  const visibleMonthCalendar = useMemo(
    () => getMonthCalendar(visibleMonthDate.getFullYear(), visibleMonthDate.getMonth(), language, textForm),
    [language, visibleMonthDate, textForm],
  );
  const savedWeeks = useMemo(() => projectLegacyWeeksFromPlannerState(plannerState), [plannerState]);
  const activityMap = useMemo(() => buildActivityMap(savedWeeks), [savedWeeks]);
  const searchResults = useMemo(() => buildSearchResults(savedWeeks, searchQuery, language, textForm), [savedWeeks, searchQuery, language, textForm]);
  const ongoingProjectTargets = useMemo(() => buildOngoingProjectTargets(plannerState), [plannerState]);
  const linkedOngoingProjects = ongoingProjects;
  const userDisplayName = useMemo(() => getUserDisplayName(user), [user]);
  const userInitials = useMemo(() => getUserInitials(user), [user]);
  const miscTasks = miscTasksByWeek[weekKey] ?? [];
  const hasReachedMiscTaskLimit = miscTasks.length >= MAX_MISC_TASKS;
  const hasMiscTaskStartedTyping = miscTaskInput.length > 0 && !hasReachedMiscTaskLimit;
  const miscTaskHint =
    hasMiscTaskStartedTyping
      ? miscTaskInput.includes(' ')
        ? ui.miscTasksSubmitHint
        : ui.miscTasksTypedHint
      : null;
  const accountModeLabel = user && isSupabaseConfigured ? ui.cloudMode : isSupabaseConfigured ? ui.demoMode : ui.localMode;
  const accountPanelTitle = user ? userDisplayName : ui.demoModeTitle;
  const accountPanelCopy = user
    ? user.email ?? user.id ?? ui.connectedAccount
    : isSupabaseConfigured
      ? ui.demoModeCopy
      : ui.enableCloudSync;
  const accountAvatarInitials = user ? userInitials : 'DN';
  const shouldShowDemoUi = isSupabaseConfigured && hasResolvedAuthState && !user;
  const resolvedTheme = theme === 'auto' ? resolveThemeByLocalTime(new Date(themeClock)) : theme;

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
    return (
      Object.keys(queuedDaySyncsRef.current).length > 0 ||
      Object.keys(pendingDaySyncTimeoutsRef.current).length > 0 ||
      Object.values(activeDaySyncsRef.current).some(Boolean)
    );
  }

  function markWeekMutated(targetWeekKey: string) {
    weekMutationVersionRef.current[targetWeekKey] = (weekMutationVersionRef.current[targetWeekKey] ?? 0) + 1;
    dirtyWeeksRef.current[targetWeekKey] = true;
  }

  function persistDirtyWeeks() {
    window.localStorage.setItem(DIRTY_WEEKS_STORAGE_KEY, JSON.stringify(dirtyWeeksRef.current));
  }

  function clearWeekDirty(targetWeekKey: string) {
    delete dirtyWeeksRef.current[targetWeekKey];
  }

  function isWeekDirty(targetWeekKey: string) {
    return Boolean(dirtyWeeksRef.current[targetWeekKey]);
  }

  async function enforceInviteOnly(nextUser: User | null) {
    if (isAllowedBetaUser(nextUser, allowedEmails)) {
      setAuthMessage('');
      if (nextUser) {
        setShowInviteOnlyAuth(false);
      }
      return nextUser;
    }

    setAuthMessage(ui.inviteOnlyMessage);
    if (nextUser) {
      setShowInviteOnlyAuth(true);
    }
    setUser(null);
    await supabase?.auth.signOut();
    return null;
  }

  useEffect(() => {
    // Hydrate all local-only state first so the app is usable immediately, even before
    // Supabase auth or cloud reads have finished.
    window.localStorage.removeItem(LEGACY_STORAGE_PREFIX);
    window.localStorage.removeItem(LEGACY_MISC_STORAGE_PREFIX);
    window.localStorage.removeItem(LEGACY_DIRTY_WEEKS_STORAGE_KEY);

    const rawPlannerState = window.localStorage.getItem(PLANNER_STATE_STORAGE_KEY);
    if (rawPlannerState) {
      try {
        const parsed = JSON.parse(rawPlannerState) as PlannerState;
        setPlannerState(normalizePlannerState(parsed));
      } catch {
        window.localStorage.removeItem(PLANNER_STATE_STORAGE_KEY);
      }
    } else {
      const raw = window.localStorage.getItem(STORAGE_PREFIX);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Record<string, Record<string, Array<Partial<TaskRow> & { completed?: boolean }>>>;
          setPlannerState(buildPlannerStateFromLegacyWeeks(normalizeSavedWeeks(parsed)));
        } catch {
          window.localStorage.removeItem(STORAGE_PREFIX);
        }
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

    const rawOngoingProjects = window.localStorage.getItem(ONGOING_PROJECTS_STORAGE_KEY);
    if (rawOngoingProjects) {
      try {
        const parsed = JSON.parse(rawOngoingProjects) as Array<Partial<OngoingProject>>;
        setOngoingProjects(normalizeOngoingProjects(parsed));
      } catch {
        window.localStorage.removeItem(ONGOING_PROJECTS_STORAGE_KEY);
      }
    }

    const rawDirtyWeeks = window.localStorage.getItem(DIRTY_WEEKS_STORAGE_KEY);
    if (rawDirtyWeeks) {
      try {
        dirtyWeeksRef.current = JSON.parse(rawDirtyWeeks) as Record<string, boolean>;
      } catch {
        window.localStorage.removeItem(DIRTY_WEEKS_STORAGE_KEY);
      }
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
      setHasResolvedAuthState(true);
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
        setHasResolvedAuthState(true);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    plannerStateRef.current = plannerState;
  }, [plannerState]);

  useEffect(() => {
    if (!hasHydratedLocalCache || !hasResolvedAuthState || !isSupabaseConfigured || user) {
      return;
    }

    if (!isPlannerStateEmpty(plannerState) || hasAnyMiscTasks(miscTasksByWeek) || ongoingProjects.length > 0) {
      return;
    }

    const baseMonday = getMonday(new Date());
    const demoOngoingProjects = buildDemoOngoingProjects();
    setPlannerState(buildDemoPlannerState(baseMonday, demoOngoingProjects));
    setMiscTasksByWeek(buildDemoMiscTasks(baseMonday));
    setOngoingProjects(demoOngoingProjects);
    setWeekStart(baseMonday);
  }, [hasHydratedLocalCache, hasResolvedAuthState, user, plannerState, miscTasksByWeek, ongoingProjects]);

  useEffect(() => {
    if (!hasHydratedLocalCache || !hasResolvedAuthState || !isSupabaseConfigured || user) {
      return;
    }

    if (!window.localStorage.getItem(THEME_STORAGE_KEY)) {
      setTheme('auto');
    }

    if (!window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) {
      setLanguage('en');
    }

    if (!window.localStorage.getItem(TEXT_FORM_STORAGE_KEY)) {
      setTextForm('formal');
    }

    if (!window.localStorage.getItem(GRIDLINE_MODE_STORAGE_KEY)) {
      setGridlineMode('crazy-minimalist');
    }
  }, [hasHydratedLocalCache, hasResolvedAuthState, user]);

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
      const requestMutationVersion = weekMutationVersionRef.current[weekKey] ?? 0;
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
      } else if (!isWeekDirty(weekKey) && (weekMutationVersionRef.current[weekKey] ?? 0) === requestMutationVersion) {
        setPlannerState((current) =>
          mergePlannerStateForWeek(
            current,
            weekKey,
            mergeLegacyDetailFields(
              mapRecordsToWeek(weekStart, data ?? []),
              projectLegacyWeeksFromPlannerState(current)[weekKey],
              usesLegacyTimeColumn || usesLegacyDetailColorColumn,
            ),
          ),
        );
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

    window.localStorage.setItem(PLANNER_STATE_STORAGE_KEY, JSON.stringify(plannerState));
    window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(savedWeeks));
  }, [hasHydratedLocalCache, plannerState, savedWeeks]);

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

    window.localStorage.setItem(ONGOING_PROJECTS_STORAGE_KEY, JSON.stringify(ongoingProjects));
  }, [hasHydratedLocalCache, ongoingProjects]);

  useEffect(() => {
    window.localStorage.setItem(PLANNER_VIEW_STORAGE_KEY, plannerView);
  }, [plannerView]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [resolvedTheme, theme]);

  useEffect(() => {
    if (theme !== 'auto') {
      return;
    }

    const interval = window.setInterval(() => setThemeClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.gridlines = gridlineMode;
    window.localStorage.setItem(GRIDLINE_MODE_STORAGE_KEY, gridlineMode);
  }, [gridlineMode]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.textForm = textForm;
    window.localStorage.setItem(TEXT_FORM_STORAGE_KEY, textForm);
  }, [textForm]);

  useEffect(() => {
    if (!isWeekLoading) {
      setShowWeekLoadingBanner(false);
      return;
    }

    const timeout = window.setTimeout(() => setShowWeekLoadingBanner(true), 250);
    return () => window.clearTimeout(timeout);
  }, [isWeekLoading]);

  useEffect(() => {
    if (showInviteOnlyAuth || activeNotesEditor || activeStatusEditor || activeTimeEditor || activePriorityPicker) {
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const isEditable =
      Boolean(activeElement) &&
      (activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'SELECT' ||
        activeElement?.isContentEditable);

    if (isEditable) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      miscInboxInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showInviteOnlyAuth, activeNotesEditor, activeStatusEditor, activeTimeEditor, activePriorityPicker]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!mobileHeaderMenuRef.current?.contains(event.target as Node)) {
        setIsMobileHeaderMenuOpen(false);
      }

      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }

      if (!plannerViewMenuRef.current?.contains(event.target as Node)) {
        setIsPlannerViewMenuOpen(false);
      }

      if (!ongoingProjectsMenuRef.current?.contains(event.target as Node)) {
        setIsOngoingProjectsOpen(false);
      }

      if (!unassignedMenuRef.current?.contains(event.target as Node)) {
        setIsUnassignedOpen(false);
      }

      if (!searchMenuRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileHeaderMenuOpen(false);
        setIsAccountMenuOpen(false);
        setIsPlannerViewMenuOpen(false);
        setIsOngoingProjectsOpen(false);
        setIsUnassignedOpen(false);
        setIsSearchOpen(false);
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
    function handleSearchShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'f' || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTextEntry =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isTextEntry) {
        return;
      }

      event.preventDefault();
      setIsOngoingProjectsOpen(false);
      setIsUnassignedOpen(false);
      setIsSearchOpen((current) => !current);
    }

    document.addEventListener('keydown', handleSearchShortcut);
    return () => document.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  useEffect(() => {
    return () => {
      clearSaveStateTimeout();
      Object.values(pendingDaySyncTimeoutsRef.current).forEach((timeout) => window.clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveState !== 'saving') {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  const days = useMemo(() => {
    return buildDays(weekStart, savedWeeks[weekKey] ?? {}, language, textForm);
  }, [savedWeeks, weekKey, weekStart, language, textForm]);

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

    return buildDays(pageTurn.weekStart, savedWeeks[outgoingWeekKey] ?? {}, language, textForm);
  }, [language, outgoingWeekKey, pageTurn, savedWeeks, textForm]);
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

  useEffect(() => {
    setVisibleYear(weekStart.getFullYear());
    setVisibleMonthDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
  }, [weekStart]);

  function getPlacementsForDay(state: PlannerState, dayKey: string) {
    return [...getPlannerPlacementsForDay(state, dayKey)].sort((left, right) => left.rowIndex - right.rowIndex);
  }

  function reindexPlacements(dayKey: string, placements: PlannerPlacement[]) {
    const context = buildPlacementContext(dayKey);
    return placements.map((placement, rowIndex) => ({
      ...placement,
      dayKey,
      weekStart: context.weekStart,
      dayIndex: context.dayIndex,
      rowIndex,
      updatedAt: new Date().toISOString(),
    }));
  }

  function isPlannerTaskEmpty(task: PlannerTask) {
    return (
      task.title.trim() === '' &&
      task.notes.trim() === '' &&
      task.ongoingProjectId === null &&
      task.status === 'none' &&
      task.time.trim() === ''
    );
  }

  function persistPlannerState(nextState: PlannerState) {
    const nextSavedWeeks = projectLegacyWeeksFromPlannerState(nextState);
    plannerStateRef.current = nextState;
    setPlannerState(nextState);
    window.localStorage.setItem(PLANNER_STATE_STORAGE_KEY, JSON.stringify(nextState));
    window.localStorage.setItem(STORAGE_PREFIX, JSON.stringify(nextSavedWeeks));
  }

  function commitPlannerMutation(nextState: PlannerState, changedDayKeys: string[]) {
    if (changedDayKeys.length === 0) {
      return;
    }

    const changedWeekKeys = new Set(changedDayKeys.map((dayKey) => getWeekKeyForDayKey(dayKey)));
    changedWeekKeys.forEach((changedWeekKey) => markWeekMutated(changedWeekKey));

    persistPlannerState(nextState);

    if (supabase && user) {
      changedDayKeys.forEach((dayKey) => {
        queueDaySync(dayKey, projectRowsForDay(nextState, dayKey));
      });
    }
  }

  function createPlannerTaskAtPlacement(dayKey: string, targetIndex: number, seed?: Partial<PlannerTask>) {
    const current = plannerStateRef.current;
    const currentPlacements = getPlacementsForDay(current, dayKey);
    const insertionIndex = Math.max(0, Math.min(targetIndex, currentPlacements.length));

    if (currentPlacements.length >= MAX_ROW_COUNT) {
      return null;
    }

    const hasContent = Boolean(
      seed &&
        ((typeof seed.title === 'string' && seed.title.trim()) ||
          (typeof seed.notes === 'string' && seed.notes.trim()) ||
          (typeof seed.ongoingProjectId === 'string' && seed.ongoingProjectId) ||
          seed.status === 'done' ||
          (typeof seed.status === 'string' && seed.status && seed.status !== 'none') ||
          (typeof seed.time === 'string' && seed.time.trim())),
    );
    const taskId = hasContent ? createEntityId('task') : null;
    const placement = {
      ...createEmptyPlacement(dayKey, insertionIndex),
      id: createEntityId('placement'),
      taskId,
    };

    const nextTasks = { ...current.tasks };
    if (taskId) {
      nextTasks[taskId] = {
        id: taskId,
        title: seed?.title ?? '',
        notes: seed?.notes ?? '',
        ongoingProjectId: seed?.ongoingProjectId ?? null,
        status: seed?.status ?? 'none',
        time: seed?.time ?? '',
        detailColor: seed?.detailColor ?? 'default',
        priorityDismissed: seed?.priorityDismissed ?? false,
        createdAt: seed?.createdAt ?? getPlannerDayCreatedAt(dayKey),
        updatedAt: new Date().toISOString(),
      };
    }

    const nextPlacementsByDay = {
      ...current.placementsByDay,
      [dayKey]: reindexPlacements(dayKey, [...currentPlacements.slice(0, insertionIndex), placement, ...currentPlacements.slice(insertionIndex)]),
    };

    const nextState = {
      tasks: nextTasks,
      placementsByDay: nextPlacementsByDay,
    };

    commitPlannerMutation(nextState, [dayKey]);
    return placement.id;
  }

  function updatePlannerTask(dayKey: string, placementId: string, fields: Partial<PlannerTask>) {
    const current = plannerStateRef.current;
    const placements = getPlacementsForDay(current, dayKey);
    const placement = placements.find((candidate) => candidate.id === placementId);

    if (!placement) {
      return;
    }

    let nextTasks = { ...current.tasks };
    let nextPlacements = placements;

    if (!placement.taskId) {
      const draftTask: PlannerTask = {
        id: createEntityId('task'),
        title: '',
        notes: '',
        ongoingProjectId: null,
        status: 'none',
        time: '',
        detailColor: 'default',
        priorityDismissed: false,
        createdAt: getPlannerDayCreatedAt(dayKey),
        updatedAt: new Date().toISOString(),
      };
      const materializedTask = {
        ...draftTask,
        ...fields,
        updatedAt: new Date().toISOString(),
      };

      if (isPlannerTaskEmpty(materializedTask)) {
        return;
      }

      nextTasks[materializedTask.id] = materializedTask;
      nextPlacements = placements.map((candidate) =>
        candidate.id === placementId ? { ...candidate, taskId: materializedTask.id, updatedAt: new Date().toISOString() } : candidate,
      );
    } else {
      const currentTask = current.tasks[placement.taskId];
      if (!currentTask) {
        return;
      }

      const nextTask = {
        ...currentTask,
        ...fields,
        updatedAt: new Date().toISOString(),
      };

      if (isPlannerTaskEmpty(nextTask)) {
        delete nextTasks[currentTask.id];
        nextPlacements = placements.map((candidate) =>
          candidate.id === placementId ? { ...candidate, taskId: null, updatedAt: new Date().toISOString() } : candidate,
        );
      } else {
        nextTasks[currentTask.id] = nextTask;
      }
    }

    const nextState = {
      tasks: nextTasks,
      placementsByDay: {
        ...current.placementsByDay,
        [dayKey]: reindexPlacements(dayKey, nextPlacements),
      },
    };

    commitPlannerMutation(nextState, [dayKey]);
  }

  function deletePlannerTaskAtPlacement(dayKey: string, placementId: string) {
    const current = plannerStateRef.current;
    const placements = getPlacementsForDay(current, dayKey);

    if (placements.length <= ROW_COUNT) {
      return;
    }

    const targetPlacement = placements.find((placement) => placement.id === placementId);
    if (!targetPlacement) {
      return;
    }

    const nextTasks = { ...current.tasks };
    if (targetPlacement.taskId) {
      delete nextTasks[targetPlacement.taskId];
    }

    const filteredPlacements = placements.filter((placement) => placement.id !== placementId);
    const nextPlacements =
      filteredPlacements.length > 0 ? reindexPlacements(dayKey, filteredPlacements) : [createEmptyPlacement(dayKey, 0)];

    const nextState = {
      tasks: nextTasks,
      placementsByDay: {
        ...current.placementsByDay,
        [dayKey]: nextPlacements,
      },
    };

    commitPlannerMutation(nextState, [dayKey]);

    if (targetPlacement.taskId) {
      const deletedTask = current.tasks[targetPlacement.taskId];
      if (deletedTask?.ongoingProjectId) {
        deleteOngoingProject(deletedTask.ongoingProjectId);
      }
    }
  }

  function reorderPlannerPlacement(dayKey: string, sourcePlacementId: string, targetIndex: number) {
    const current = plannerStateRef.current;
    const placements = getPlacementsForDay(current, dayKey);
    const sourceIndex = placements.findIndex((placement) => placement.id === sourcePlacementId);
    if (sourceIndex < 0) {
      return;
    }

    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, placements.length - 1));
    if (sourceIndex === boundedTargetIndex) {
      return;
    }

    const nextPlacements = [...placements];
    const [movedPlacement] = nextPlacements.splice(sourceIndex, 1);
    nextPlacements.splice(boundedTargetIndex, 0, movedPlacement);

    commitPlannerMutation(
      {
        tasks: current.tasks,
        placementsByDay: {
          ...current.placementsByDay,
          [dayKey]: reindexPlacements(dayKey, nextPlacements),
        },
      },
      [dayKey],
    );
  }

  function movePlannerTaskAcrossWeeks(sourceDayKey: string, placementId: string, targetDayKey: string, targetIndex: number) {
    const current = plannerStateRef.current;
    const sourcePlacements = getPlacementsForDay(current, sourceDayKey);
    const sourceIndex = sourcePlacements.findIndex((placement) => placement.id === placementId);
    if (sourceIndex < 0) {
      return;
    }

    const targetPlacements = getPlacementsForDay(current, targetDayKey);
    if (targetPlacements.length >= MAX_ROW_COUNT) {
      return;
    }

    const [movedPlacement] = sourcePlacements.splice(sourceIndex, 1);
    const nextSourcePlacements =
      sourcePlacements.length > 0 ? reindexPlacements(sourceDayKey, sourcePlacements) : [createEmptyPlacement(sourceDayKey, 0)];
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetPlacements.length));
    const nextTargetPlacements = reindexPlacements(targetDayKey, [
      ...targetPlacements.slice(0, boundedTargetIndex),
      { ...movedPlacement, dayKey: targetDayKey },
      ...targetPlacements.slice(boundedTargetIndex),
    ]);

    commitPlannerMutation(
      {
        tasks: current.tasks,
        placementsByDay: {
          ...current.placementsByDay,
          [sourceDayKey]: nextSourcePlacements,
          [targetDayKey]: nextTargetPlacements,
        },
      },
      sourceDayKey === targetDayKey ? [sourceDayKey] : [sourceDayKey, targetDayKey],
    );
  }

  function movePlannerTaskWithinWeek(sourceDayKey: string, placementId: string, targetDayKey: string, targetIndex: number) {
    if (sourceDayKey === targetDayKey) {
      reorderPlannerPlacement(sourceDayKey, placementId, targetIndex);
      return;
    }

    movePlannerTaskAcrossWeeks(sourceDayKey, placementId, targetDayKey, targetIndex);
  }

  async function syncDayRows(dayKey: string, rows: TaskRow[]) {
    if (!supabase || !user) {
      return false;
    }

    const dayIndex = getDayIndex(dayKey);
    const targetWeekKey = getWeekKeyForDayKey(dayKey);
    if (dayIndex < 0) {
      return false;
    }

    const client = supabase;
    const activeUser = user;

    const { error: deleteError } = await client
      .from('tasks')
      .delete()
      .eq('user_id', activeUser.id)
      .eq('week_start', targetWeekKey)
      .eq('day_index', dayIndex);

    if (deleteError) {
      setStorageError(deleteError.message);
      return false;
    }

    // Row reordering is simplest to sync by rewriting the day slice in row-index order.
    const populatedRows = rows
      .map((row, rowIndex) => ({
        user_id: activeUser.id,
        week_start: targetWeekKey,
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
      clearWeekDirty(getWeekKeyForDayKey(dayKey));
      persistDirtyWeeks();
      markSavedState();
    }
  }

  function queueDaySync(dayKey: string, rows: TaskRow[]) {
    if (!supabase || !user) {
      return;
    }

    queuedDaySyncsRef.current[dayKey] = rows.map((row) => ({ ...row }));
    markSavingState();
    persistDirtyWeeks();

    if (pendingDaySyncTimeoutsRef.current[dayKey] !== undefined) {
      window.clearTimeout(pendingDaySyncTimeoutsRef.current[dayKey]);
    }

    pendingDaySyncTimeoutsRef.current[dayKey] = window.setTimeout(() => {
      delete pendingDaySyncTimeoutsRef.current[dayKey];
      void flushDaySync(dayKey);
    }, 450);
  }

  function addRow(dayKey: string) {
    const currentPlacements = getPlacementsForDay(plannerStateRef.current, dayKey);
    createPlannerTaskAtPlacement(dayKey, currentPlacements.length);
  }

  function performDeleteRow(dayKey: string, rowId: string) {
    deletePlannerTaskAtPlacement(dayKey, rowId);
  }

  function deleteRow(dayKey: string, rowId: string) {
    const currentWeek = savedWeeks[weekKey] ?? {};
    const currentRows = currentWeek[dayKey] ?? createEmptyRows(dayKey);
    const targetRow = currentRows.find((row) => row.id === rowId);

    if (currentRows.length <= ROW_COUNT) {
      return;
    }

    if (targetRow && !isRowEmpty(targetRow)) {
      setPendingRowDelete({ dayKey, rowId });
      return;
    }

    performDeleteRow(dayKey, rowId);
  }

  function updateRow(dayKey: string, rowId: string, field: keyof TaskRow, value: string) {
    if (field === 'id' || field === 'taskId') {
      return;
    }
    updatePlannerTask(dayKey, rowId, { [field]: value } as Partial<PlannerTask>);
  }

  function updateTaskTitle(dayKey: string, rowId: string, nextTitle: string) {
    const currentWeek = savedWeeks[weekKey] ?? {};
    const currentRows = currentWeek[dayKey] ?? createEmptyRows(dayKey);
    const row = currentRows.find((candidate) => candidate.id === rowId);

    if (!row) {
      return;
    }

    updateRow(dayKey, rowId, 'title', nextTitle);
  }

  function updateRowFields(dayKey: string, rowId: string, fields: Partial<TaskRow>) {
    const nextFields = { ...fields };
    delete (nextFields as Partial<TaskRow>).id;
    delete (nextFields as Partial<TaskRow>).taskId;
    updatePlannerTask(dayKey, rowId, nextFields as Partial<PlannerTask>);
  }

  function openNotesEditor(dayKey: string, row: TaskRow) {
    const task = row.taskId ? plannerStateRef.current.tasks[row.taskId] : null;
    setActiveNotesEditor({
      dayKey,
      rowId: row.id,
      createdAt: task?.createdAt ?? getPlannerDayCreatedAt(dayKey),
      taskTitle: row.title,
      notes: sanitizeNoteHtml(row.notes),
      ongoingProjectId: row.ongoingProjectId,
      status: row.status,
      time: row.time,
      detailColor: row.detailColor,
      priorityDismissed: row.priorityDismissed,
    });
  }

  function closeNotesEditor() {
    setActiveNotesEditor(null);
  }

  function closeStatusEditor() {
    setActiveStatusEditor(null);
  }

  function openTimeEditor(dayKey: string, row: TaskRow) {
    setActiveTimeEditor({
      dayKey,
      rowId: row.id,
      time: row.time,
    });
  }

  function closeTimeEditor() {
    setActiveTimeEditor(null);
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
    if (activeNotesEditor.ongoingProjectId) {
      updateOngoingProject(activeNotesEditor.ongoingProjectId, 'notes', sanitizedNotes);
    }
  }
}

function updateActiveTaskTitle(title: string) {
  setActiveNotesEditor((current) => (current ? { ...current, taskTitle: title } : current));
  if (activeNotesEditor) {
    updateRow(activeNotesEditor.dayKey, activeNotesEditor.rowId, 'title', title);
    if (activeNotesEditor.ongoingProjectId) {
      updateOngoingProject(activeNotesEditor.ongoingProjectId, 'title', title);
    }
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
      status: trimmed,
      detailColor: color,
      priorityDismissed: false,
    });
    setActiveNotesEditor((current) =>
      current && current.dayKey === activeStatusEditor.dayKey && current.rowId === activeStatusEditor.rowId
        ? {
            ...current,
            status: trimmed,
            detailColor: color,
            priorityDismissed: false,
          }
        : current,
    );
    setActiveStatusEditor(null);
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

  function saveTimeValue(value: string) {
    if (!activeTimeEditor) {
      return;
    }

    const trimmed = value.trim().slice(0, 10);
    updateRowFields(activeTimeEditor.dayKey, activeTimeEditor.rowId, {
      time: trimmed,
    });
    setActiveNotesEditor((current) =>
      current && current.dayKey === activeTimeEditor.dayKey && current.rowId === activeTimeEditor.rowId
        ? {
            ...current,
            time: trimmed,
          }
        : current,
    );
    setActiveTimeEditor(null);
  }


  function addMiscTask() {
    const trimmed = miscTaskInput.trim();

    if (!trimmed || hasReachedMiscTaskLimit) {
      return;
    }

    setMiscTasksByWeek((current) => ({
      ...current,
      [weekKey]: [...(current[weekKey] ?? []), createMiscTask(trimmed)],
    }));
    setMiscTaskInput('');
  }

  function syncRowsForOngoingProject(
    projectId: string,
    updates: Partial<Pick<TaskRow, 'title' | 'notes' | 'ongoingProjectId'>>,
  ) {
    const current = plannerStateRef.current;
    const nextTasks = { ...current.tasks };
    const changedTaskIds = new Set<string>();
    let didChange = false;

    Object.values(nextTasks).forEach((task) => {
      if (task.ongoingProjectId !== projectId) {
        return;
      }

      didChange = true;
      if (updates.title !== undefined) {
        task.title = updates.title;
      }
      if (updates.notes !== undefined) {
        task.notes = updates.notes;
      }
      if (updates.ongoingProjectId !== undefined) {
        task.ongoingProjectId = updates.ongoingProjectId;
      }
      task.updatedAt = new Date().toISOString();
      changedTaskIds.add(task.id);
    });

    if (!didChange) {
      return;
    }

    const changedDayKeys = Object.entries(current.placementsByDay)
      .filter(([, placements]) => placements.some((placement) => placement.taskId && changedTaskIds.has(placement.taskId)))
      .map(([dayKey]) => dayKey);

    commitPlannerMutation(
      {
        tasks: nextTasks,
        placementsByDay: current.placementsByDay,
      },
      changedDayKeys,
    );

    setActiveNotesEditor((current) =>
      current && current.ongoingProjectId === projectId
        ? {
            ...current,
            ...(updates.title !== undefined ? { taskTitle: updates.title } : {}),
            ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
            ...(updates.ongoingProjectId !== undefined ? { ongoingProjectId: updates.ongoingProjectId } : {}),
          }
        : current,
    );

  }

  function updateOngoingProject(projectId: string, field: 'title' | 'notes', value: string) {
    setOngoingProjects((current) =>
      current.map((project) => (project.id === projectId ? { ...project, [field]: value } : project)),
    );
    syncRowsForOngoingProject(projectId, { [field]: value } as Partial<Pick<TaskRow, 'title' | 'notes'>>);
  }

  function deleteOngoingProject(projectId: string) {
    setOngoingProjects((current) => current.filter((project) => project.id !== projectId));
    syncRowsForOngoingProject(projectId, { ongoingProjectId: null });
  }

  function toggleOngoingFromNotes() {
    if (!activeNotesEditor) {
      return;
    }

    const currentWeekKey = getWeekKeyForDayKey(activeNotesEditor.dayKey);
    const currentRow = (savedWeeks[currentWeekKey]?.[activeNotesEditor.dayKey] ?? []).find(
      (row) => row.id === activeNotesEditor.rowId,
    );
    const linkedProjectId = currentRow?.ongoingProjectId ?? activeNotesEditor.ongoingProjectId;

    if (linkedProjectId) {
      deleteOngoingProject(linkedProjectId);
      setActiveNotesEditor((current) => (current ? { ...current, ongoingProjectId: null } : current));
      updateRowFields(activeNotesEditor.dayKey, activeNotesEditor.rowId, {
        ongoingProjectId: null,
      });
      return;
    }

    const nextProject = {
      id: createOngoingProject().id,
      title: activeNotesEditor.taskTitle,
      notes: activeNotesEditor.notes,
    };

    setOngoingProjects((current) => [...current, nextProject]);
    setActiveNotesEditor((current) => (current ? { ...current, ongoingProjectId: nextProject.id } : current));
    updateRowFields(activeNotesEditor.dayKey, activeNotesEditor.rowId, {
      ongoingProjectId: nextProject.id,
    });
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

    const currentRows = projectRowsForDay(plannerStateRef.current, dayKey);
    const targetIndex = currentRows.findIndex((row) => row.id === rowId);

    if (targetIndex < 0) {
      return;
    }

    createPlannerTaskAtPlacement(dayKey, targetIndex, {
      title: task.text,
    });

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

    const sourceRows = projectRowsForDay(plannerStateRef.current, sourceDayKey);
    const targetRows = projectRowsForDay(plannerStateRef.current, targetDayKey);
    const sourceIndex = sourceRows.findIndex((row) => row.id === sourceRowId);
    const targetIndex = targetRows.findIndex((row) => row.id === targetRowId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    if (sourceDayKey === targetDayKey) {
      reorderPlannerPlacement(sourceDayKey, sourceRowId, targetIndex);
    } else {
      movePlannerTaskWithinWeek(sourceDayKey, sourceRowId, targetDayKey, targetIndex);
    }

    setDraggedTaskRow(null);
  }

  function moveTaskRowToTargetWeek(sourceDayKey: string, sourceRowId: string, targetWeekKey: string) {
    const sourceWeekKey = getWeekKeyForDayKey(sourceDayKey);
    const sourceRows = projectRowsForDay(plannerStateRef.current, sourceDayKey);
    const sourceIndex = sourceRows.findIndex((row) => row.id === sourceRowId);

    if (sourceIndex < 0) {
      return;
    }

    const sourceRow = sourceRows[sourceIndex];
    if (isRowEmpty(sourceRow)) {
      return;
    }

    const sourceDayIndex = getDayIndex(sourceDayKey);
    if (sourceDayIndex < 0) {
      return;
    }

    if (sourceWeekKey === targetWeekKey) {
      return;
    }

    const targetDayKey = getDayKeyForWeekAndIndex(targetWeekKey, sourceDayIndex);
    const targetPlacements = getPlacementsForDay(plannerStateRef.current, targetDayKey);
    const targetIndex =
      targetPlacements.length === 1 && targetPlacements[0].taskId === null ? 0 : targetPlacements.length;

    movePlannerTaskAcrossWeeks(sourceDayKey, sourceRowId, targetDayKey, targetIndex);

    setDraggedTaskRow(null);
  }

  function moveTaskRowToWeek(sourceDayKey: string, sourceRowId: string, offset: number) {
    const sourceWeekKey = getWeekKeyForDayKey(sourceDayKey);
    moveTaskRowToTargetWeek(sourceDayKey, sourceRowId, shiftWeekKeyByOffset(sourceWeekKey, offset));
  }

  function moveWeek(offset: number) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + offset * 7);
      return getMonday(next);
    });
  }

  function resetToCurrentWeek() {
    setPlannerView('weekly');
    setWeekStart(getMonday(new Date()));
  }

  function jumpToWeek(target: Date) {
    setWeekStart(getMonday(target));
  }

  function jumpToSearchResult(result: SearchResult) {
    setWeekStart(parseWeekKey(result.weekKey));
    setActiveSearchRowId(result.rowId);
    setSearchQuery('');
    setIsSearchOpen(false);
  }

  function jumpToOngoingProject(projectId: string) {
    const target = ongoingProjectTargets.get(projectId);
    if (!target) {
      return;
    }

    const targetRows = savedWeeks[target.weekKey]?.[target.dayKey] ?? [];
    const targetRow = targetRows.find((row) => row.id === target.rowId);

    setWeekStart(parseWeekKey(target.weekKey));
    setActiveSearchRowId(target.rowId);
    setIsOngoingProjectsOpen(false);

    if (targetRow) {
      const task = targetRow.taskId ? plannerStateRef.current.tasks[targetRow.taskId] : null;
      setActiveNotesEditor({
        dayKey: target.dayKey,
        rowId: targetRow.id,
        createdAt: task?.createdAt ?? getPlannerDayCreatedAt(target.dayKey),
        taskTitle: targetRow.title,
        notes: sanitizeNoteHtml(targetRow.notes),
        ongoingProjectId: targetRow.ongoingProjectId,
        status: targetRow.status,
        time: targetRow.time,
        detailColor: targetRow.detailColor,
        priorityDismissed: targetRow.priorityDismissed,
      });
    }
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
    setPlannerState(createEmptyPlannerState());
    setAuthMessage('');
    setShowInviteOnlyAuth(false);
  }

  if (isSupabaseConfigured && !user && showInviteOnlyAuth) {
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
        onBack={() => setShowInviteOnlyAuth(false)}
      />
    );
  }

  return (
    <div className="app-shell">
      {authMessage ? <p className="status-banner">{authMessage}</p> : null}
      {storageError ? <p className="status-banner status-banner-error">{storageError}</p> : null}

      <header className="top-actions">
        <div className={`top-toolbar ${isMobileHeaderMenuOpen ? 'is-mobile-menu-open' : ''}`}>
          <div className="mobile-account-shell">
            <button
              type="button"
              className={`account-trigger mobile-account-trigger ${isAccountMenuOpen ? 'is-open' : ''}`}
              onClick={() => setIsAccountMenuOpen((current) => !current)}
              aria-label={ui.openAccount}
              aria-expanded={isAccountMenuOpen}
            >
              <span>{accountAvatarInitials}</span>
            </button>
          </div>

          <div className="top-toolbar-menu-shell" ref={mobileHeaderMenuRef}>
            <button
              type="button"
              className="nav-button mobile-header-menu-button"
              onClick={() => setIsMobileHeaderMenuOpen((current) => !current)}
              aria-expanded={isMobileHeaderMenuOpen}
              aria-label={ui.menu}
            >
              <span className="mobile-header-menu-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            <div className="top-toolbar-menu-content">
              <div className="top-toolbar-controls">
                <div className="top-toolbar-identity">
                  <div className="today-button-shell">
                    <button
                      type="button"
                      className={`nav-button home-button ${draggedTaskRow ? 'is-drag-target' : ''}`}
                      onClick={() => {
                        resetToCurrentWeek();
                        setIsMobileHeaderMenuOpen(false);
                      }}
                      onDragOver={(event) => {
                        if (!draggedTaskRow) {
                          return;
                        }

                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => {
                        if (!draggedTaskRow) {
                          return;
                        }

                        event.preventDefault();
                        const plannerRow = event.dataTransfer.getData('application/x-dnevnik-task-row');

                        if (plannerRow) {
                          try {
                            const source = JSON.parse(plannerRow) as DraggedTaskRow;
                            moveTaskRowToTargetWeek(source.dayKey, source.rowId, todayWeekKey);
                          } catch {
                            // Ignore invalid drag payloads.
                          }
                        } else {
                          moveTaskRowToTargetWeek(draggedTaskRow.dayKey, draggedTaskRow.rowId, todayWeekKey);
                        }
                      }}
                    >
                      {ui.today}
                    </button>
                    {draggedTaskRow ? <span className="today-button-hint">{ui.dragToTodayButtonHint}</span> : null}
                  </div>

                  <div className="ongoing-projects-menu-shell" ref={ongoingProjectsMenuRef}>
                    <button
                      type="button"
                      className="nav-button ongoing-projects-trigger"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setIsUnassignedOpen(false);
                        setIsOngoingProjectsOpen((current) => !current);
                      }}
                      aria-expanded={isOngoingProjectsOpen}
                      aria-label={ui.ongoingProjectsTitle}
                    >
                      {ui.ongoingProjects}
                    </button>
                    {isOngoingProjectsOpen ? (
                      <OngoingProjectsDropdown
                        ui={ui}
                        projects={linkedOngoingProjects}
                        targets={ongoingProjectTargets}
                        onPickProject={jumpToOngoingProject}
                        onRemoveProject={deleteOngoingProject}
                      />
                    ) : null}
                  </div>

                  <div className="search-menu-shell" ref={searchMenuRef}>
                    <button
                      type="button"
                      className="nav-button search-trigger-button"
                      onClick={() => {
                        setIsOngoingProjectsOpen(false);
                        setIsUnassignedOpen(false);
                        setIsSearchOpen((current) => !current);
                      }}
                    >
                      {ui.search}
                    </button>
                    {isSearchOpen ? (
                      <SearchDropdown
                        ui={ui}
                        query={searchQuery}
                        results={searchResults}
                        onClose={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        onChangeQuery={setSearchQuery}
                        onPickResult={jumpToSearchResult}
                      />
                    ) : null}
                  </div>

                  <div className="unassigned-menu-shell" ref={unassignedMenuRef}>
                    <button
                      type="button"
                      className="nav-button unassigned-trigger-button"
                      onClick={() => {
                        setIsOngoingProjectsOpen(false);
                        setIsSearchOpen(false);
                        setIsUnassignedOpen((current) => !current);
                      }}
                      aria-expanded={isUnassignedOpen}
                      aria-label={ui.unassignedTitle}
                    >
                      {ui.unassigned}
                    </button>
                    {isUnassignedOpen ? (
                      <UnassignedDropdown
                        ui={ui}
                        tasks={miscTasks}
                        draggedMiscTaskId={draggedMiscTaskId}
                        onDeleteTask={deleteMiscTask}
                        onSetDraggedMiscTaskId={setDraggedMiscTaskId}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="top-toolbar-summary">
                <span className="beta-build-indicator" title="Temporary beta build indicator">
                  {TEMP_BETA_BUILD}
                </span>

                {isSupabaseConfigured && user && (showWeekLoadingBanner || saveState !== 'idle') ? (
                  <span
                    className={`save-indicator ${
                      showWeekLoadingBanner
                        ? 'save-indicator-loading'
                        : `save-indicator-${saveState}`
                    }`}
                  >
                    {showWeekLoadingBanner
                      ? ui.loadingWeek
                      : saveState === 'saving'
                        ? ui.savingStatus
                        : ui.savedStatus}
                  </span>
                ) : null}

                {shouldShowDemoUi ? (
                  <button
                    type="button"
                    className="nav-button demo-signup-button"
                    onClick={() => {
                      setShowInviteOnlyAuth(true);
                      setIsMobileHeaderMenuOpen(false);
                    }}
                  >
                    {ui.signUp}
                  </button>
                ) : null}

                <div>
                  <div className="planner-view-menu-shell" ref={plannerViewMenuRef}>
                    <button
                      type="button"
                      className="planner-view-trigger"
                      onClick={() => setIsPlannerViewMenuOpen((current) => !current)}
                      aria-label={ui.plannerSettings}
                      aria-expanded={isPlannerViewMenuOpen}
                    >
                      {plannerView === 'yearly' ? ui.yearlyPlanner : plannerView === 'monthly' ? ui.monthlyPlanner : ui.weeklyPlanner}
                    </button>

                    {isPlannerViewMenuOpen ? (
                      <div className="planner-view-menu" role="menu" aria-label={ui.plannerSettings}>
                        {(['weekly', 'monthly', 'yearly'] as PlannerView[]).map((view) => (
                          <button
                            key={view}
                            type="button"
                            className={`priority-menu-item planner-view-menu-item ${plannerView === view ? 'is-active' : ''}`}
                            onClick={() => {
                              setPlannerView(view);
                              setIsPlannerViewMenuOpen(false);
                              setIsMobileHeaderMenuOpen(false);
                            }}
                          >
                            {view === 'yearly' ? ui.yearlyPlanner : view === 'monthly' ? ui.monthlyPlanner : ui.weeklyPlanner}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="account-menu-shell" ref={accountMenuRef}>
                  <button
                    type="button"
                    className={`account-trigger ${isAccountMenuOpen ? 'is-open' : ''}`}
                    onClick={() => setIsAccountMenuOpen((current) => !current)}
                    aria-label={ui.openAccount}
                    aria-expanded={isAccountMenuOpen}
                  >
                    <span>{accountAvatarInitials}</span>
                  </button>

                  {isAccountMenuOpen ? (
                    <div className="account-menu-panel" role="menu" aria-label={ui.accountSettings}>
                      <div className="account-menu-header">
                        <div className="account-menu-avatar">
                          <span>{accountAvatarInitials}</span>
                        </div>
                        <div>
                          <p className="account-menu-label">{accountModeLabel}</p>
                          <p className="account-menu-title">{accountPanelTitle}</p>
                          <p className="account-menu-copy">{accountPanelCopy}</p>
                        </div>
                      </div>

                      <div className="account-menu-section">
                        <label className="account-menu-field">
                          <span className="top-toolbar-group-label">{ui.gridlines}</span>
                          <select
                            className="theme-select"
                            value={gridlineMode}
                            onChange={(event) => setGridlineMode(event.target.value as GridlineMode)}
                            aria-label={ui.gridlines}
                          >
                            <option value="default">{getGridlineOptionLabel('default', ui, textForm)}</option>
                            <option value="crazy-minimalist">{getGridlineOptionLabel('crazy-minimalist', ui, textForm)}</option>
                          </select>
                          <span className="account-menu-copy">{ui.gridlinesNote}</span>
                        </label>
                      </div>

                      <div className="account-menu-section">
                        <label className="account-menu-field">
                          <span className="top-toolbar-group-label">{ui.theme}</span>
                          <select className="theme-select" value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)} aria-label={ui.theme}>
                            <option value="auto">{ui.themeAuto}</option>
                            <option value="white">{ui.themeWhite}</option>
                            <option value="paper">{ui.themePaper}</option>
                            <option value="night">{ui.themeNight}</option>
                            <option value="sepia">{ui.themeSepia}</option>
                            <option value="blueprint">{ui.themeBlueprint}</option>
                          </select>
                          <span className="account-menu-copy">{ui.themeNote}</span>
                        </label>
                      </div>

                      <div className="account-menu-section">
                        <label className="account-menu-field">
                          <span className="top-toolbar-group-label">{ui.language}</span>
                          <select className="theme-select" value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)} aria-label={ui.language}>
                            <option value="en">{ui.languageEnglish}</option>
                            <option value="coming-soon" disabled>
                              {ui.languageComingSoon}
                            </option>
                          </select>
                          <span className="account-menu-copy">{ui.languageNote}</span>
                        </label>
                      </div>

                      <div className="account-menu-section">
                        <label className="account-menu-field">
                          <span className="top-toolbar-group-label">{ui.textForm}</span>
                          <select className="theme-select" value={textForm} onChange={(event) => setTextForm(event.target.value as TextForm)} aria-label={ui.textForm}>
                            <option value="formal">{ui.textFormFormal}</option>
                            <option value="informal">{ui.textFormInformal}</option>
                          </select>
                          <span className="account-menu-copy">{ui.textFormNote}</span>
                        </label>
                      </div>

                      {isSupabaseConfigured && user ? (
                        <div className="account-menu-section">
                          <button
                            type="button"
                            className="nav-button account-menu-action"
                            onClick={() => {
                              void signOut();
                              setIsMobileHeaderMenuOpen(false);
                            }}
                          >
                            {ui.signOut}
                          </button>
                        </div>
                      ) : shouldShowDemoUi ? (
                        <div className="account-menu-section">
                          <div className="account-menu-demo-actions">
                            <button
                              type="button"
                              className="nav-button account-menu-action demo-signup-button"
                              onClick={() => {
                                setIsAccountMenuOpen(false);
                                setIsMobileHeaderMenuOpen(false);
                                setShowInviteOnlyAuth(true);
                              }}
                            >
                              {ui.signUp}
                            </button>
                            <button
                              type="button"
                              className="nav-button account-menu-action demo-signin-button"
                              onClick={() => {
                                setIsAccountMenuOpen(false);
                                setIsMobileHeaderMenuOpen(false);
                                setShowInviteOnlyAuth(true);
                              }}
                            >
                              {ui.signIn}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {user ? (
                        <div className="account-menu-placeholder-stack" aria-hidden="true">
                          <div className="account-menu-placeholder" />
                          <div className="account-menu-placeholder account-menu-placeholder-short" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="top-toolbar-middle">
            <form
              className="misc-inbox-form misc-inbox-form-top"
              onSubmit={(event) => {
                event.preventDefault();
                addMiscTask();
              }}
            >
              <div className={`misc-inbox-input-shell ${miscTaskHint ? 'has-typed-hint' : ''}`}>
                <input
                  ref={miscInboxInputRef}
                  className="misc-inbox-input"
                  value={miscTaskInput}
                  onChange={(event) => {
                    if (!hasReachedMiscTaskLimit) {
                      setMiscTaskInput(event.target.value);
                    }
                  }}
                  placeholder={hasReachedMiscTaskLimit ? ui.miscTasksLimitReached : ui.miscTasksPlaceholder}
                  aria-label={ui.miscTasksTitle}
                  disabled={hasReachedMiscTaskLimit}
                />
                {miscTaskHint ? <span className="misc-inbox-typed-hint">{miscTaskHint}</span> : null}
              </div>
            </form>
          </div>
        </div>
      </header>

      {shouldShowDemoUi ? (
        <div className="demo-mode-strip">
          <p className="top-toolbar-demo-badge">{ui.demoModeBanner}</p>
        </div>
      ) : null}

      {plannerView === 'yearly' ? (
        <main className="calendar-planner-stage">
          <YearlyPlanner
            language={language}
            textForm={textForm}
            ui={ui}
            visibleYear={visibleYear}
            months={yearMonths}
            activityMap={activityMap}
            onPickWeek={jumpToWeek}
            onPreviousYear={() => setVisibleYear((current) => current - 1)}
            onNextYear={() => setVisibleYear((current) => current + 1)}
          />
        </main>
      ) : plannerView === 'monthly' ? (
        <main className="calendar-planner-stage">
          <MonthlyPlanner
            language={language}
            textForm={textForm}
            ui={ui}
            month={visibleMonthCalendar}
            visibleMonthDate={visibleMonthDate}
            selectedWeekKey={weekKey}
            activityMap={activityMap}
            onPickWeek={jumpToWeek}
            onPreviousMonth={() => setVisibleMonthDate((current) => shiftMonth(current, -1))}
            onNextMonth={() => setVisibleMonthDate((current) => shiftMonth(current, 1))}
            onToday={() => {
              const today = new Date();
              setVisibleMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
              setWeekStart(getMonday(today));
            }}
          />
        </main>
      ) : (
        <main className="spread-stage">
          <button
            type="button"
            className="spread-hit-zone spread-hit-zone-left"
            onClick={() => moveWeek(-1)}
            onDragOver={(event) => {
              if (!draggedMiscTaskId && !draggedTaskRow) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData('text/plain') || draggedMiscTaskId;
              const plannerRow = event.dataTransfer.getData('application/x-dnevnik-task-row');

              if (taskId) {
                moveMiscTaskToWeek(taskId, -1);
                return;
              }

              if (plannerRow) {
                try {
                  const source = JSON.parse(plannerRow) as DraggedTaskRow;
                  moveTaskRowToWeek(source.dayKey, source.rowId, -1);
                } catch {
                  // Ignore invalid drag payloads.
                }
              } else if (draggedTaskRow) {
                moveTaskRowToWeek(draggedTaskRow.dayKey, draggedTaskRow.rowId, -1);
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
              if (!draggedMiscTaskId && !draggedTaskRow) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData('text/plain') || draggedMiscTaskId;
              const plannerRow = event.dataTransfer.getData('application/x-dnevnik-task-row');

              if (taskId) {
                moveMiscTaskToWeek(taskId, 1);
                return;
              }

              if (plannerRow) {
                try {
                  const source = JSON.parse(plannerRow) as DraggedTaskRow;
                  moveTaskRowToWeek(source.dayKey, source.rowId, 1);
                } catch {
                  // Ignore invalid drag payloads.
                }
              } else if (draggedTaskRow) {
                moveTaskRowToWeek(draggedTaskRow.dayKey, draggedTaskRow.rowId, 1);
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
                headerLabel={formatSheetRange(outgoingLeftPage, language, textForm)}
                days={outgoingLeftPage}
                  onUpdateTaskTitle={updateTaskTitle}
                  ui={ui}
                  onAddRow={addRow}
                  onDeleteRow={deleteRow}
                  onMoveTaskRow={moveTaskRow}
                  onOpenNotes={openNotesEditor}
                  onAssignMiscTask={assignMiscTaskToRow}
                  draggedMiscTaskId={draggedMiscTaskId}
                  draggedTaskRow={draggedTaskRow}
                onSetDraggedTaskRow={setDraggedTaskRow}
                activeDayIndex={getActiveDayIndexForWeek(outgoingWeekKey, todayWeekKey, todayDayIndex)}
                activeSearchRowId={activeSearchRowId}
                isPastWeek={isWeekBefore(outgoingWeekKey, todayWeekKey)}
              />
              <PageSheet
                headerLabel={formatSheetRange(outgoingRightPage, language, textForm)}
                days={outgoingRightPage}
                  onUpdateTaskTitle={updateTaskTitle}
                  ui={ui}
                  onAddRow={addRow}
                  onDeleteRow={deleteRow}
                  onMoveTaskRow={moveTaskRow}
                  onOpenNotes={openNotesEditor}
                  onAssignMiscTask={assignMiscTaskToRow}
                  draggedMiscTaskId={draggedMiscTaskId}
                  draggedTaskRow={draggedTaskRow}
                onSetDraggedTaskRow={setDraggedTaskRow}
                activeDayIndex={getActiveDayIndexForWeek(outgoingWeekKey, todayWeekKey, todayDayIndex)}
                activeSearchRowId={activeSearchRowId}
                isPastWeek={isWeekBefore(outgoingWeekKey, todayWeekKey)}
              />
              </div>
            ) : null}

            <div className={`spread spread-current ${pageTurn ? `is-turning is-${pageTurn.direction}` : ''}`}>
              <PageSheet
                headerLabel={formatSheetRange(leftPage, language, textForm)}
                days={leftPage}
                onUpdateTaskTitle={updateTaskTitle}
                ui={ui}
                onAddRow={addRow}
                onDeleteRow={deleteRow}
                onMoveTaskRow={moveTaskRow}
                onOpenNotes={openNotesEditor}
                onAssignMiscTask={assignMiscTaskToRow}
                draggedMiscTaskId={draggedMiscTaskId}
                draggedTaskRow={draggedTaskRow}
                onSetDraggedTaskRow={setDraggedTaskRow}
                activeDayIndex={getActiveDayIndexForWeek(weekKey, todayWeekKey, todayDayIndex)}
                activeSearchRowId={activeSearchRowId}
                isPastWeek={isWeekBefore(weekKey, todayWeekKey)}
              />
              <PageSheet
                headerLabel={formatSheetRange(rightPage, language, textForm)}
                days={rightPage}
                onUpdateTaskTitle={updateTaskTitle}
                ui={ui}
                onAddRow={addRow}
                onDeleteRow={deleteRow}
                onMoveTaskRow={moveTaskRow}
                onOpenNotes={openNotesEditor}
                onAssignMiscTask={assignMiscTaskToRow}
                draggedMiscTaskId={draggedMiscTaskId}
                draggedTaskRow={draggedTaskRow}
                onSetDraggedTaskRow={setDraggedTaskRow}
                activeDayIndex={getActiveDayIndexForWeek(weekKey, todayWeekKey, todayDayIndex)}
                activeSearchRowId={activeSearchRowId}
                isPastWeek={isWeekBefore(weekKey, todayWeekKey)}
              />
            </div>
          </div>
        </main>
      )}

      {activeNotesEditor ? (
        <NotesDialog
          activeNotesEditor={activeNotesEditor}
          ui={ui}
          language={language}
          textForm={textForm}
          onClose={closeNotesEditor}
          onChangeTaskTitle={updateActiveTaskTitle}
          onChangeNotes={updateActiveNotes}
          onOpenPriority={() =>
            openPriorityPicker(activeNotesEditor.dayKey, {
              id: activeNotesEditor.rowId,
              taskId: null,
              title: activeNotesEditor.taskTitle,
              notes: activeNotesEditor.notes,
              ongoingProjectId: activeNotesEditor.ongoingProjectId,
              status: activeNotesEditor.status,
              time: activeNotesEditor.time,
              detailColor: activeNotesEditor.detailColor,
              priorityDismissed: activeNotesEditor.priorityDismissed,
            })
          }
          onOpenTime={() =>
            openTimeEditor(activeNotesEditor.dayKey, {
              id: activeNotesEditor.rowId,
              taskId: null,
              title: activeNotesEditor.taskTitle,
              notes: activeNotesEditor.notes,
              ongoingProjectId: activeNotesEditor.ongoingProjectId,
              status: activeNotesEditor.status,
              time: activeNotesEditor.time,
              detailColor: activeNotesEditor.detailColor,
              priorityDismissed: activeNotesEditor.priorityDismissed,
            })
          }
          onToggleOngoing={toggleOngoingFromNotes}
          isSubdialogOpen={Boolean(activePriorityPicker || activeStatusEditor || activeTimeEditor)}
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
          onApply={(option) => {
            updateRowFields(activePriorityPicker.dayKey, activePriorityPicker.rowId, {
              status: option,
              priorityDismissed: option === 'none',
            });
            setActiveNotesEditor((current) =>
              current && current.dayKey === activePriorityPicker.dayKey && current.rowId === activePriorityPicker.rowId
                ? {
                    ...current,
                    status: option,
                    priorityDismissed: option === 'none',
                  }
                : current,
            );
            closePriorityPicker();
          }}
          onCustom={openCustomFromPriorityPicker}
        />
      ) : null}

      {activeTimeEditor ? (
        <TimeDialog
          ui={ui}
          activeTimeEditor={activeTimeEditor}
          onClose={closeTimeEditor}
          onSave={saveTimeValue}
        />
      ) : null}

      {pendingRowDelete ? (
        <DeleteRowDialog
          ui={ui}
          onClose={() => setPendingRowDelete(null)}
          onConfirm={() => {
            performDeleteRow(pendingRowDelete.dayKey, pendingRowDelete.rowId);
            setPendingRowDelete(null);
          }}
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
  onBack: () => void;
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
  onBack,
}: AuthScreenProps) {
  return (
    <div className="auth-page">
      <section className="auth-card">
        <p className="storage-label">{ui.appName}</p>
        <h1 className="auth-title">{isInviteOnlyBeta ? ui.inviteOnlyAuthTitle : ui.authTitle}</h1>
        <p className="auth-copy">{isInviteOnlyBeta ? ui.inviteOnlyAuthCopy : ui.authCopy}</p>
        {isInviteOnlyBeta ? <p className="auth-copy auth-copy-detail">{ui.inviteOnlyAuthContact}</p> : null}

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

        <button type="button" className="nav-button auth-back-button" onClick={onBack}>
          {ui.browseDemo}
        </button>
      </section>
    </div>
  );
}

type PageSheetProps = {
  headerLabel: string;
  days: DayData[];
  onUpdateTaskTitle: (dayKey: string, rowId: string, nextTitle: string) => void;
  ui: UiText;
  onAddRow: (dayKey: string) => void;
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onMoveTaskRow: (sourceDayKey: string, sourceRowId: string, targetDayKey: string, targetRowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  onAssignMiscTask: (dayKey: string, rowId: string, taskId: string) => void;
  draggedMiscTaskId: string | null;
  draggedTaskRow: DraggedTaskRow | null;
  onSetDraggedTaskRow: (value: DraggedTaskRow | null) => void;
  activeDayIndex: number | null;
  activeSearchRowId: string | null;
  isPastWeek: boolean;
};

function PageSheet({
  headerLabel,
  days,
  onUpdateTaskTitle,
  ui,
  onAddRow,
  onDeleteRow,
  onMoveTaskRow,
  onOpenNotes,
  onAssignMiscTask,
  draggedMiscTaskId,
  draggedTaskRow,
  onSetDraggedTaskRow,
  activeDayIndex,
  activeSearchRowId,
  isPastWeek,
}: PageSheetProps) {
  return (
    <section className="page-sheet">
      <div className="page-header">
        <div className="page-header-top">
          <h1 className="page-month">{headerLabel}</h1>
          {isPastWeek ? <p className="page-header-hint">{ui.pastWeekEditHint}</p> : null}
        </div>
      </div>

      <div className="day-stack">
        {days.map((day) => (
          <DaySection
            key={day.key}
            day={day}
            onUpdateTaskTitle={onUpdateTaskTitle}
            ui={ui}
            onAddRow={onAddRow}
            onDeleteRow={onDeleteRow}
            onMoveTaskRow={onMoveTaskRow}
            onOpenNotes={onOpenNotes}
            onAssignMiscTask={onAssignMiscTask}
            draggedMiscTaskId={draggedMiscTaskId}
            draggedTaskRow={draggedTaskRow}
            onSetDraggedTaskRow={onSetDraggedTaskRow}
            isActive={getDayIndex(day.key) === activeDayIndex}
            activeSearchRowId={activeSearchRowId}
            isPastWeek={isPastWeek}
          />
        ))}
      </div>
    </section>
  );
}

type DaySectionProps = {
  day: DayData;
  onUpdateTaskTitle: (dayKey: string, rowId: string, nextTitle: string) => void;
  ui: UiText;
  onAddRow: (dayKey: string) => void;
  onDeleteRow: (dayKey: string, rowId: string) => void;
  onMoveTaskRow: (sourceDayKey: string, sourceRowId: string, targetDayKey: string, targetRowId: string) => void;
  onOpenNotes: (dayKey: string, row: TaskRow) => void;
  onAssignMiscTask: (dayKey: string, rowId: string, taskId: string) => void;
  draggedMiscTaskId: string | null;
  draggedTaskRow: DraggedTaskRow | null;
  onSetDraggedTaskRow: (value: DraggedTaskRow | null) => void;
  isActive: boolean;
  activeSearchRowId: string | null;
  isPastWeek: boolean;
};

function DaySection({
  day,
  onUpdateTaskTitle,
  ui,
  onAddRow,
  onDeleteRow,
  onMoveTaskRow,
  onOpenNotes,
  onAssignMiscTask,
  draggedMiscTaskId,
  draggedTaskRow,
  onSetDraggedTaskRow,
  isActive,
  activeSearchRowId,
  isPastWeek,
}: DaySectionProps) {
  const dateKey = day.key.split('-').slice(1).join('-');
  const dayNumber = new Date(`${dateKey}T00:00:00`).getDate();
  const hasReachedRowLimit = day.rows.length >= MAX_ROW_COUNT;
  const baselineVisualRows = 6;
  const baselineRowHeight = 40;
  const condensedRowCount = Math.min(Math.max(day.rows.length, 1), baselineVisualRows);
  const rowTrackHeight = (baselineRowHeight * baselineVisualRows) / condensedRowCount;
  const gridBodyHeight = rowTrackHeight * day.rows.length;
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

      <div
        className={`task-grid day-grid ${day.rows.length < 5 ? 'is-low-density' : ''}`}
        style={
          {
            '--visible-row-count': day.rows.length,
            '--grid-body-height': `${gridBodyHeight}px`,
            '--row-track-height': `${rowTrackHeight}px`,
          } as CSSProperties
        }
      >
        <div className={`task-grid-head task-grid-row ${isActive ? 'is-active' : ''}`}>
          <span>#</span>
          <span>{ui.task}</span>
          <span>{ui.notes}</span>
        </div>

        {day.rows.map((row, index) => {
          const priorityVisualClass = getPriorityVisualClass(row);

          return (
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
              } ${draggedTaskRow?.rowId === row.id ? 'is-drag-source' : ''} ${priorityVisualClass.replace('priority-', 'row-number-')}`}
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
                <span className={`row-number-actions ${day.rows.length > ROW_COUNT ? '' : 'is-single'}`}>
                  {day.rows.length > ROW_COUNT ? (
                    <button
                      type="button"
                      className="row-number-action"
                      onClick={() => onDeleteRow(day.key, row.id)}
                      aria-label={ui.deleteRow(index + 1)}
                    >
                      −
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="row-number-action"
                    onClick={() => onAddRow(day.key)}
                    disabled={hasReachedRowLimit}
                    aria-label={ui.addRow}
                  >
                    +
                  </button>
                </span>
              ) : null}
            </div>
            <div
              className={`task-cell ${row.title.trim() ? 'has-title' : ''} ${isPastWeek ? 'is-locked' : ''}`}
              onClick={(event) => {
                if (isPastWeek) {
                  return;
                }

                const target = event.target as HTMLElement;
                if (target.closest('button')) {
                  return;
                }

                const input = event.currentTarget.querySelector('input');
                input?.focus();
              }}
            >
              {isPastWeek ? (
                <div className={`cell-input cell-input-readonly ${row.status === 'done' ? 'is-complete' : ''}`}>{row.title}</div>
              ) : (
                <input
                  className={`cell-input ${row.status === 'done' ? 'is-complete' : ''}`}
                  value={row.title}
                  onChange={(event) => {
                    onUpdateTaskTitle(day.key, row.id, event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const nextTitle = event.currentTarget.value;
                      onUpdateTaskTitle(day.key, row.id, nextTitle);
                      onOpenNotes(day.key, {
                        ...row,
                        title: nextTitle,
                      });
                    }
                  }}
                />
              )}
              <button
                type="button"
                className={`mobile-notes-trigger ${isPastWeek ? 'is-locked' : ''}`}
                onClick={() => {
                  if (!isPastWeek) {
                    onOpenNotes(day.key, row);
                  }
                }}
              >
                {ui.notes}
              </button>
            </div>
            <button
              type="button"
              className={`notes-trigger ${row.notes ? 'has-notes' : ''} ${isPastWeek ? 'is-locked' : ''}`}
              onClick={() => {
                if (!isPastWeek) {
                  onOpenNotes(day.key, row);
                }
              }}
            >
              {row.notes.trim() ? (
                <span className="notes-preview">{getNotePreview(row.notes)}</span>
              ) : row.title.trim() ? (
                <span className="notes-enter-hint" aria-hidden="true">
                  {ui.taskEnterHint}
                </span>
              ) : (
                <span className="notes-preview">{getNotePreview(row.notes)}</span>
              )}
            </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type NotesDialogProps = {
  activeNotesEditor: ActiveNotesEditor;
  ui: UiText;
  language: LanguageCode;
  textForm: TextForm;
  onClose: () => void;
  onChangeTaskTitle: (title: string) => void;
  onChangeNotes: (notes: string) => void;
  onOpenPriority: () => void;
  onOpenTime: () => void;
  onToggleOngoing: () => void;
  isSubdialogOpen: boolean;
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
  onApply: (option: (typeof PRESET_PRIORITY_OPTIONS)[number]) => void;
  onCustom: () => void;
};

type TimeDialogProps = {
  activeTimeEditor: ActiveTimeEditor;
  ui: UiText;
  onClose: () => void;
  onSave: (value: string) => void;
};

type DeleteRowDialogProps = {
  ui: UiText;
  onClose: () => void;
  onConfirm: () => void;
};

type SearchDropdownProps = {
  ui: UiText;
  query: string;
  results: SearchResult[];
  onClose: () => void;
  onChangeQuery: (value: string) => void;
  onPickResult: (result: SearchResult) => void;
};

type OngoingProjectsDropdownProps = {
  ui: UiText;
  projects: OngoingProject[];
  targets: Map<string, OngoingProjectTarget>;
  onPickProject: (projectId: string) => void;
  onRemoveProject: (projectId: string) => void;
};

type UnassignedDropdownProps = {
  ui: UiText;
  tasks: MiscTask[];
  draggedMiscTaskId: string | null;
  onDeleteTask: (taskId: string) => void;
  onSetDraggedMiscTaskId: (taskId: string | null) => void;
};

type YearlyPlannerProps = {
  language: LanguageCode;
  textForm: TextForm;
  ui: UiText;
  visibleYear: number;
  months: CalendarMonth[];
  activityMap: Map<string, number>;
  onPickWeek: (date: Date) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
};

type MonthlyPlannerProps = {
  language: LanguageCode;
  textForm: TextForm;
  ui: UiText;
  month: CalendarMonth;
  visibleMonthDate: Date;
  selectedWeekKey: string;
  activityMap: Map<string, number>;
  onPickWeek: (date: Date) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
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
          <div className="meta-dialog-hint-stack">
            <p className="meta-dialog-hint">{ui.chooseWithArrowKeysHint}</p>
            <p className="meta-dialog-hint">{ui.applyShortcutHint}</p>
          </div>
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

function PriorityDialog({ activePriorityPicker, ui, onClose, onApply, onCustom }: PriorityDialogProps) {
  const initialSelection = PRESET_PRIORITY_OPTIONS.includes(activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
    ? (activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
    : null;
  const [selectedOption, setSelectedOption] = useState<(typeof PRESET_PRIORITY_OPTIONS)[number] | null>(initialSelection);
  const [isCustomSelected, setIsCustomSelected] = useState(!initialSelection && Boolean(activePriorityPicker.value));
  const [hasUsedArrowKeys, setHasUsedArrowKeys] = useState(false);
  const priorityOptions = [...PRESET_PRIORITY_OPTIONS, 'custom'] as const;

  useEffect(() => {
    setSelectedOption(
      PRESET_PRIORITY_OPTIONS.includes(activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
        ? (activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number])
        : null,
    );
    setIsCustomSelected(!PRESET_PRIORITY_OPTIONS.includes(activePriorityPicker.value as (typeof PRESET_PRIORITY_OPTIONS)[number]) && Boolean(activePriorityPicker.value));
    setHasUsedArrowKeys(false);
  }, [activePriorityPicker]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        setHasUsedArrowKeys(true);
        if (isCustomSelected) {
          setIsCustomSelected(false);
          setSelectedOption('none');
          return;
        }
        setSelectedOption((current) => {
          const currentValue = current ?? 'none';
          const currentIndex = priorityOptions.indexOf(currentValue);
          const nextValue = priorityOptions[(currentIndex + 1) % priorityOptions.length];
          if (nextValue === 'custom') {
            setIsCustomSelected(true);
            return null;
          }
          setIsCustomSelected(false);
          return nextValue;
        });
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setHasUsedArrowKeys(true);
        if (isCustomSelected) {
          setIsCustomSelected(false);
          setSelectedOption('done');
          return;
        }
        setSelectedOption((current) => {
          const currentValue = current ?? 'none';
          const currentIndex = priorityOptions.indexOf(currentValue);
          const nextValue = priorityOptions[(currentIndex - 1 + priorityOptions.length) % priorityOptions.length];
          if (nextValue === 'custom') {
            setIsCustomSelected(true);
            return null;
          }
          setIsCustomSelected(false);
          return nextValue;
        });
        return;
      }

      if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
        if (isCustomSelected) {
          event.preventDefault();
          onCustom();
          return;
        }

        if (selectedOption) {
          event.preventDefault();
          onApply(selectedOption);
          return;
        }
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && selectedOption) {
        event.preventDefault();
        onApply(selectedOption);
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [isCustomSelected, onApply, onClose, onCustom, priorityOptions, selectedOption]);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="meta-dialog priority-dialog" role="dialog" aria-modal="true" aria-labelledby="priority-dialog-title">
        <div className="meta-dialog-header">
          <div>
            <p className="dialog-label">{ui.statusSortLabel}</p>
            <h2 id="priority-dialog-title" className="dialog-title">
              {ui.statusSortLabel}
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
          <button type="button" className={`priority-menu-item detail-custom ${isCustomSelected ? 'is-active' : ''}`} onClick={onCustom}>
            {ui.statusCustom}
          </button>
        </div>

        <div className="meta-dialog-actions">
          <div className="meta-dialog-hint-stack">
            <p className="meta-dialog-hint">
              {hasUsedArrowKeys ? 'chosen with arrow keys' : ui.chooseWithArrowKeysHint}
            </p>
            {hasUsedArrowKeys ? <p className="meta-dialog-hint">{ui.applyShortcutHint}</p> : null}
          </div>
          <button type="button" className="nav-button" onClick={onClose}>
            {ui.customStatusCancel}
          </button>
          <button type="button" className="nav-button" onClick={() => selectedOption && onApply(selectedOption)} disabled={!selectedOption}>
            {ui.priorityApply}
          </button>
        </div>
      </section>
    </div>
  );
}

function TimeDialog({ activeTimeEditor, ui, onClose, onSave }: TimeDialogProps) {
  const [inputFormat, setInputFormat] = useState<TimeInputFormat>('24h');
  const [value, setValue] = useState(formatStoredTimeForInput(activeTimeEditor.time, '24h'));
  const [error, setError] = useState('');

  useEffect(() => {
    setInputFormat('24h');
    setValue(formatStoredTimeForInput(activeTimeEditor.time, '24h'));
    setError('');
  }, [activeTimeEditor]);

  useEffect(() => {
    if (!value.trim()) {
      setError('');
      return;
    }

    setError(parseTimeForStorage(value, inputFormat) === null ? inputFormat === '24h' ? ui.timeInvalid24h : ui.timeInvalidAmpm : '');
  }, [inputFormat, ui.timeInvalid24h, ui.timeInvalidAmpm, value]);

  function applyTimeValue() {
    const normalized = parseTimeForStorage(value, inputFormat);

    if (normalized === null) {
      setError(inputFormat === '24h' ? ui.timeInvalid24h : ui.timeInvalidAmpm);
      return;
    }

    setError('');
    onSave(normalized);
  }

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        applyTimeValue();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [inputFormat, onClose, onSave, ui.timeInvalid24h, ui.timeInvalidAmpm, value]);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="meta-dialog" role="dialog" aria-modal="true" aria-labelledby="time-dialog-title">
        <div className="meta-dialog-header">
          <div>
            <p className="dialog-label">{ui.time}</p>
            <h2 id="time-dialog-title" className="dialog-title">
              {ui.timeTitle}
            </h2>
          </div>
          <button type="button" className="notes-dialog-close" onClick={onClose} aria-label={ui.close}>
            ×
          </button>
        </div>

        <div className="meta-dialog-format-row">
          <span className="dialog-label">{ui.timeFormatLabel}</span>
          <div className="meta-dialog-segmented">
            <button
              type="button"
              className={`meta-dialog-segment ${inputFormat === '24h' ? 'is-active' : ''}`}
              onClick={() => {
                setValue((current) => convertTimeInputFormat(current, inputFormat, '24h'));
                setInputFormat('24h');
                setError('');
              }}
            >
              {ui.timeFormat24h}
            </button>
            <button
              type="button"
              className={`meta-dialog-segment ${inputFormat === 'ampm' ? 'is-active' : ''}`}
              onClick={() => {
                setValue((current) => convertTimeInputFormat(current, inputFormat, 'ampm'));
                setInputFormat('ampm');
                setError('');
              }}
            >
              {ui.timeFormatAmpm}
            </button>
          </div>
        </div>

        <input
          className="meta-dialog-input"
          value={value}
          onChange={(event) => {
            setValue(formatTimeInputDraft(event.target.value, inputFormat));
          }}
          placeholder={inputFormat === '24h' ? 'HH:MM' : 'h:mm AM'}
          inputMode={inputFormat === '24h' ? 'numeric' : 'text'}
          spellCheck={false}
          autoFocus
        />
        {error ? <p className="meta-dialog-error">{error}</p> : null}

        <div className="meta-dialog-actions">
          <p className="meta-dialog-hint">{ui.applyShortcutHint}</p>
          <button type="button" className="nav-button" onClick={applyTimeValue}>
            {ui.timeSave}
          </button>
        </div>
      </section>
    </div>
  );
}

function DeleteRowDialog({ ui, onClose, onConfirm }: DeleteRowDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="meta-dialog delete-row-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-row-dialog-title">
        <div className="meta-dialog-header">
          <div>
            <p className="dialog-label">{ui.confirmDelete}</p>
            <h2 id="delete-row-dialog-title" className="dialog-title">
              {ui.confirmDeleteTitle}
            </h2>
          </div>
        </div>
        <p className="meta-dialog-hint delete-row-copy">{ui.confirmDeleteCopy}</p>
        <div className="meta-dialog-actions">
          <button type="button" className="nav-button" onClick={onClose}>
            {ui.cancel}
          </button>
          <button type="button" className="nav-button delete-row-confirm" onClick={onConfirm}>
            {ui.confirmDelete}
          </button>
        </div>
      </section>
    </div>
  );
}

function SearchDropdown({ ui, query, results, onClose, onChangeQuery, onPickResult }: SearchDropdownProps) {
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  return (
    <div className="search-dropdown" role="dialog" aria-label={ui.search}>
      <div className="search-input-shell">
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder={ui.searchPlaceholder}
          aria-label={ui.searchPlaceholder}
          autoFocus
        />
        <span className="search-input-hint" aria-hidden="true">
          {ui.searchShortcutHint}
        </span>
      </div>

      {query.trim() ? (
        <div className="search-results search-results-dropdown">
          {results.length > 0 ? (
            results.map((result) => (
              <button
                key={`${result.rowId}-${result.weekKey}`}
                type="button"
                className="search-result"
                onClick={() => onPickResult(result)}
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
  );
}

function OngoingProjectsDropdown({ ui, projects, targets, onPickProject, onRemoveProject }: OngoingProjectsDropdownProps) {
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        const activeElement = document.activeElement as HTMLElement | null;
        activeElement?.blur();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <div className="ongoing-projects-dropdown" role="dialog" aria-label={ui.ongoingProjectsTitle}>
      <div className="ongoing-projects-header">
        <p className="dialog-label">{ui.ongoingProjectsTitle}</p>
        <p className="account-menu-copy">{ui.ongoingProjectsCopy}</p>
      </div>

      <div className="ongoing-projects-list">
        {projects.length > 0 ? (
          projects.map((project) => (
            <div key={project.id} className="ongoing-project-card">
              <div className="ongoing-project-card-header">
                <span className="ongoing-project-title-text">{project.title || ui.ongoingProjectTitlePlaceholder}</span>
                <button
                  type="button"
                  className="ongoing-project-remove"
                  onClick={() => onRemoveProject(project.id)}
                  aria-label={ui.deleteOngoingProject}
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                className="ongoing-project-link"
                onClick={() => onPickProject(project.id)}
                disabled={!targets.has(project.id)}
              >
                <p className="ongoing-project-notes-text">
                  {project.notes.trim() ? getNotePreview(project.notes) : ui.ongoingProjectNotesPlaceholder}
                </p>
              </button>
            </div>
          ))
        ) : (
          <div className="ongoing-projects-empty">{ui.ongoingProjectsEmpty}</div>
        )}
      </div>
    </div>
  );
}

function UnassignedDropdown({ ui, tasks, draggedMiscTaskId, onDeleteTask, onSetDraggedMiscTaskId }: UnassignedDropdownProps) {
  return (
    <div className="unassigned-dropdown" role="dialog" aria-label={ui.unassignedTitle}>
      <div className="unassigned-dropdown-header">
        <p className="dialog-label">{ui.unassignedTitle}</p>
        <p className="account-menu-copy">{ui.unassignedCopy}</p>
      </div>

      <div className="unassigned-dropdown-list">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`misc-task-chip ${draggedMiscTaskId === task.id ? 'is-dragging' : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', task.id);
                event.dataTransfer.effectAllowed = 'move';
                onSetDraggedMiscTaskId(task.id);
              }}
              onDragEnd={() => onSetDraggedMiscTaskId(null)}
            >
              <span className="misc-task-text">{task.text}</span>
              <span className="misc-task-actions" aria-hidden="true">
                <span className="misc-task-drag">drag</span>
                <button
                  type="button"
                  className="misc-task-delete"
                  onClick={() => onDeleteTask(task.id)}
                  aria-label={ui.deleteMiscTask}
                >
                  ×
                </button>
              </span>
            </div>
          ))
        ) : null}
      </div>
    </div>
  );
}

function NotesDialog({
  activeNotesEditor,
  ui,
  language,
  textForm,
  onClose,
  onChangeTaskTitle,
  onChangeNotes,
  onOpenPriority,
  onOpenTime,
  onToggleOngoing,
  isSubdialogOpen,
}: NotesDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const editorSessionKey = `${activeNotesEditor.dayKey}:${activeNotesEditor.rowId}`;
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    unorderedList: false,
    orderedList: false,
    block: 'body' as 'body' | 'large' | 'title' | 'code',
  });
  const [windowPosition, setWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const plannerDayLabel = formatPlannerDayLabel(activeNotesEditor.dayKey, language, textForm);
  const createdDateLabel = activeNotesEditor.createdAt
    ? formatPlannerDateLabel(activeNotesEditor.createdAt, language, textForm)
    : '';
  const shouldShowCreatedDate =
    Boolean(createdDateLabel) && createdDateLabel !== plannerDayLabel;

  useEffect(() => {
    const sanitizedNotes = sanitizeNoteHtml(activeNotesEditor.notes);
    if (editorRef.current && editorRef.current.innerHTML !== sanitizedNotes) {
      editorRef.current.innerHTML = sanitizedNotes;
    }
  }, [editorSessionKey]);

  useEffect(() => {
    const width = Math.min(Math.max(window.innerWidth - 32, 320), 860);
    const height = Math.min(Math.max(window.innerHeight - 48, 320), 720);
    setWindowPosition({
      x: Math.max(16, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(16, Math.round((window.innerHeight - height) / 2)),
    });
  }, [editorSessionKey]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.focus();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editorSessionKey]);

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

      let block: 'body' | 'large' | 'title' | 'code' = 'body';
      while (element && element !== editor) {
        if (element.tagName === 'PRE') {
          block = 'code';
          break;
        }

        if (element.tagName === 'H2') {
          block = 'title';
          break;
        }

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
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        orderedList: document.queryCommandState('insertOrderedList'),
        block,
      });
    }

    document.addEventListener('selectionchange', updateActiveFormats);
    return () => document.removeEventListener('selectionchange', updateActiveFormats);
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      const editor = editorRef.current;
      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0)
          : null;
      const selectionInEditor =
        Boolean(editor && range && editor.contains(range.commonAncestorContainer));
      const anchorElement = selection?.anchorNode
        ? selection.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (selection.anchorNode as HTMLElement)
          : selection.anchorNode.parentElement
        : null;
      const activeListItem = anchorElement?.closest('li');

      if (isSubdialogOpen) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (selectionInEditor && (event.metaKey || event.ctrlKey)) {
        const lowerKey = event.key.toLowerCase();

        if (lowerKey === 'b') {
          event.preventDefault();
          exec('bold');
          return;
        }

        if (lowerKey === 'i') {
          event.preventDefault();
          exec('italic');
          return;
        }

        if (lowerKey === 'u') {
          event.preventDefault();
          exec('underline');
          return;
        }

        if (lowerKey === 'z') {
          event.preventDefault();
          exec(event.shiftKey ? 'redo' : 'undo');
          return;
        }

        if (lowerKey === 'y') {
          event.preventDefault();
          exec('redo');
          return;
        }
      }

      if (
        selectionInEditor &&
        event.key === ' ' &&
        range &&
        range.collapsed &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const blockCandidate =
          anchorElement?.closest('p, div, h2, h3') ??
          (editor && (anchorElement === editor || !anchorElement) ? editor : null);
        const marker = blockCandidate?.textContent?.replace(/\u00A0/g, ' ').trim() ?? '';

        if (marker === '-' || marker === '*') {
          event.preventDefault();
          if (blockCandidate) {
            blockCandidate.textContent = '';
          }
          const nextRange = document.createRange();
          nextRange.selectNodeContents(blockCandidate ?? editor!);
          nextRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(nextRange);
          exec('insertUnorderedList');
          return;
        }

        if (/^\d+\.$/.test(marker)) {
          event.preventDefault();
          if (blockCandidate) {
            blockCandidate.textContent = '';
          }
          const nextRange = document.createRange();
          nextRange.selectNodeContents(blockCandidate ?? editor!);
          nextRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(nextRange);
          exec('insertOrderedList');
          return;
        }
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialog) {
        if (selectionInEditor && editor) {
          event.preventDefault();

          const blockCandidate =
            anchorElement?.closest('p, div, h2, h3') ??
            (editor && (anchorElement === editor || !anchorElement) ? editor : null);
          const marker = blockCandidate?.textContent?.replace(/\u00A0/g, ' ').trim() ?? '';

          if (!activeListItem && marker === '-' && !event.shiftKey) {
            if (blockCandidate) {
              blockCandidate.textContent = '';
            }
            const nextRange = document.createRange();
            nextRange.selectNodeContents(blockCandidate ?? editor);
            nextRange.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(nextRange);
            exec('insertUnorderedList');
            return;
          }

          if (activeListItem) {
            exec(event.shiftKey ? 'outdent' : 'indent');
            return;
          }

          insertEditorText('\u00A0\u00A0\u00A0\u00A0');
          return;
        }

        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);

        if (focusable.length === 0) {
          return;
        }

        const active = document.activeElement as HTMLElement | null;
        const currentIndex = active ? focusable.indexOf(active) : -1;

        if (!active || !dialog.contains(active)) {
          event.preventDefault();
          focusable[0].focus();
          return;
        }
        
        event.preventDefault();

        if (currentIndex === -1) {
          focusable[0].focus();
          return;
        }

        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + focusable.length) % focusable.length;
        focusable[nextIndex].focus();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [isSubdialogOpen, onChangeNotes, onClose]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!dragStateRef.current) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const dialog = dialogRef.current;
      const dialogWidth = dialog?.offsetWidth ?? 720;
      const dialogHeight = dialog?.offsetHeight ?? 560;
      const nextX = Math.min(Math.max(12, event.clientX - dragStateRef.current.offsetX), Math.max(12, viewportWidth - dialogWidth - 12));
      const nextY = Math.min(Math.max(12, event.clientY - dragStateRef.current.offsetY), Math.max(12, viewportHeight - dialogHeight - 12));

      setWindowPosition({
        x: nextX,
        y: nextY,
      });
    }

    function handlePointerUp(event: PointerEvent) {
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null;
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

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

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('button, input')) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const rect = dialog.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
  }

  function insertEditorText(text: string) {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    const sanitizedNotes = sanitizeNoteHtml(editor.innerHTML);
    if (editor.innerHTML !== sanitizedNotes) {
      editor.innerHTML = sanitizedNotes;
    }
    onChangeNotes(sanitizedNotes);
    editor.focus();
  }

  const customDetail = !isPresetStatus(activeNotesEditor.status) ? activeNotesEditor.status.trim() : '';
  const hasVisiblePriority = Boolean(customDetail || activeNotesEditor.status !== 'none');
  const shouldRevealPrompt = !hasVisiblePriority && !activeNotesEditor.priorityDismissed;
  const priorityButtonLabel = hasVisiblePriority
    ? customDetail || getStatusLabel(activeNotesEditor.status, ui)
    : ui.statusSet;
  const priorityButtonClass = hasVisiblePriority
    ? customDetail
      ? `detail-${activeNotesEditor.detailColor}`
      : `status-${activeNotesEditor.status}`
    : shouldRevealPrompt
      ? 'status-none'
      : 'is-empty-priority';
  const timeButtonLabel = activeNotesEditor.time || ui.timeSet;
  const ongoingButtonClass = activeNotesEditor.ongoingProjectId ? 'is-active' : '';

  return (
    <div className="dialog-backdrop notes-window-layer" role="presentation">
      <section
        ref={dialogRef}
        className="notes-dialog"
        role="dialog"
        aria-modal="false"
        aria-labelledby="notes-dialog-title"
        style={windowPosition ? { left: `${windowPosition.x}px`, top: `${windowPosition.y}px` } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="notes-dialog-header" onPointerDown={startDrag}>
          <div className="notes-dialog-title-wrap">
            <p className="dialog-label">{ui.taskNotes}</p>
            <p className="notes-dialog-date">
              <span>{ui.scheduledFor}: {plannerDayLabel}</span>
              {shouldShowCreatedDate ? <span>{ui.createdOn}: {createdDateLabel}</span> : null}
            </p>
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

        <div className="notes-dialog-meta-row">
          <button
            type="button"
            className={`priority-trigger notes-priority-trigger ${priorityButtonClass}`}
            onClick={onOpenPriority}
            aria-haspopup="dialog"
            aria-label={`${ui.statusSortLabel}: ${priorityButtonLabel}`}
          >
            {priorityButtonLabel}
          </button>
          <button
            type="button"
            className={`priority-trigger notes-time-trigger ${activeNotesEditor.time ? 'is-active' : ''}`}
            onClick={onOpenTime}
            aria-haspopup="dialog"
            aria-label={`${ui.time}: ${timeButtonLabel}`}
          >
            {timeButtonLabel}
          </button>
          <button
            type="button"
            className={`priority-trigger notes-ongoing-trigger ${ongoingButtonClass}`}
            onClick={onToggleOngoing}
          >
            {ui.ongoingSet}
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
              className={`toolbar-button ${activeFormats.underline ? 'is-active' : ''}`}
              onClick={() => exec('underline')}
            >
              U
            </button>
            <button
              type="button"
              className={`toolbar-button ${activeFormats.strike ? 'is-active' : ''}`}
              onClick={() => exec('strikeThrough')}
            >
              S
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
              className={`toolbar-button ${activeFormats.orderedList ? 'is-active' : ''}`}
              onClick={() => exec('insertOrderedList')}
            >
              1.
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
            <button
              type="button"
              className={`toolbar-button ${activeFormats.block === 'title' ? 'is-active' : ''}`}
              onClick={() => exec('formatBlock', '<h2>')}
            >
              {ui.title}
            </button>
            <button
              type="button"
              className={`toolbar-button ${activeFormats.block === 'code' ? 'is-active' : ''}`}
              onClick={() => exec('formatBlock', '<pre>')}
            >
              {'</>'}
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

function YearlyPlanner({
  language,
  textForm,
  ui,
  visibleYear,
  months,
  activityMap,
  onPickWeek,
  onPreviousYear,
  onNextYear,
}: YearlyPlannerProps) {
  const todayDateKey = formatDateKey(new Date());

  return (
    <section className="calendar-dialog calendar-dialog-inline" aria-labelledby="calendar-dialog-title">
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
        </div>
      </div>

      <div className="calendar-grid">
        {months.map((month) => (
          <section key={month.label} className="calendar-month">
            <h3 className="calendar-month-title">{month.label}</h3>
            <div className="calendar-weekdays">
              {CALENDAR_WEEKDAY_LABELS[language].map((label, index) => (
                <span key={`${label}-${index}`}>{applyTextFormToString(label, textForm)}</span>
              ))}
            </div>
            <div className="calendar-weeks">
              {month.weeks.map((week) => {
                const weekKey = formatWeekKey(getMonday(week[0]));
                const weekActivity = week.reduce((total, day) => total + (activityMap.get(formatDateKey(day)) ?? 0), 0);

                return (
                  <button
                    key={weekKey}
                    type="button"
                    className={`calendar-week ${weekActivity > 0 ? 'has-activity' : ''}`}
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
                          className={`${day.getMonth() === month.monthIndex ? '' : 'is-outside-month'} ${
                            dateKey === todayDateKey ? 'is-today' : ''
                          } ${intensity}`.trim()}
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
  );
}

function MonthlyPlanner({
  language,
  textForm,
  ui,
  month,
  visibleMonthDate,
  selectedWeekKey,
  activityMap,
  onPickWeek,
  onPreviousMonth,
  onNextMonth,
  onToday,
}: MonthlyPlannerProps) {
  const todayDateKey = formatDateKey(new Date());
  const monthTitle = applyTextFormToString(
    visibleMonthDate.toLocaleDateString(getDateLocale(language), {
      month: 'long',
      year: 'numeric',
    }),
    textForm,
  );

  return (
    <section className="calendar-dialog calendar-dialog-inline monthly-planner" aria-labelledby="monthly-planner-title">
      <div className="calendar-dialog-header monthly-planner-header">
        <div>
          <h2 id="monthly-planner-title" className="monthly-planner-title">
            {monthTitle}
          </h2>
        </div>
        <div className="calendar-dialog-actions">
          <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={onPreviousMonth} aria-label={ui.previousWeek}>
            ←
          </button>
          <button type="button" className="nav-button nav-button-inline" onClick={onToday}>
            {ui.today}
          </button>
          <button type="button" className="nav-button nav-button-inline nav-arrow" onClick={onNextMonth} aria-label={ui.nextWeek}>
            →
          </button>
        </div>
      </div>

      <div className="monthly-weekdays">
        {DAY_LABELS[language].concat(language === 'ru' ? ['Воскресенье'] : ['Sunday']).map((label, index) => (
          <span key={`${label}-${index}`}>{applyTextFormToString(label, textForm)}</span>
        ))}
      </div>

      <div className="monthly-grid">
        {month.weeks.flatMap((week) =>
          week.map((day) => {
            const dateKey = formatDateKey(day);
            const weekKey = formatWeekKey(getMonday(day));
            const isCurrentMonth = day.getMonth() === month.monthIndex;
            const isToday = dateKey === todayDateKey;
            const activity = activityMap.get(dateKey) ?? 0;
            const intensity =
              activity >= 6 ? 'activity-4' : activity >= 4 ? 'activity-3' : activity >= 2 ? 'activity-2' : activity >= 1 ? 'activity-1' : '';

            return (
              <button
                key={dateKey}
                type="button"
                className={`monthly-day ${isCurrentMonth ? '' : 'is-outside-month'} ${weekKey === selectedWeekKey ? 'is-selected' : ''} ${
                  isToday ? 'is-today' : ''
                } ${intensity}`.trim()}
                onClick={() => onPickWeek(day)}
              >
                <span className="monthly-day-number">{day.getDate()}</span>
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}

export default App;
