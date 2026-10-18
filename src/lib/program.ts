import type { Task, TaskCompletion, Category, Difficulty } from './types.ts';
import { calculateFullDayStreak, TASK_XP_REWARD } from './gamification.ts';

export const PROGRAM_DURATION_DAYS = 100;
export const DAILY_TARGET_TASKS = 10;
export const TOTAL_TARGET_TASKS = 1000;

export type DayStatus =
  | 'fully_completed'
  | 'partially_completed'
  | 'in_progress'
  | 'rest_day'
  | 'not_started'
  | 'future';

/**
 * Returns YYYY-MM-DD for a given Date object in local time.
 */
export function formatLocalDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates a YYYY-MM-DD date string safely.
 */
export function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Calculates current program day number (1 to 100) based on program start date and current local date.
 */
export function calculateProgramDay(startDateStr: string, currentLocalDateStr: string = formatLocalDateStr()): number {
  const safeStart = isValidDateStr(startDateStr) ? startDateStr : formatLocalDateStr();
  const safeCurrent = isValidDateStr(currentLocalDateStr) ? currentLocalDateStr : formatLocalDateStr();

  const startParts = safeStart.split('-').map(Number);
  const currentParts = safeCurrent.split('-').map(Number);

  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const currentUtc = Date.UTC(currentParts[0], currentParts[1] - 1, currentParts[2]);

  const diffMs = currentUtc - startUtc;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const dayNumber = diffDays + 1;

  if (dayNumber < 1) return 1;
  if (dayNumber > PROGRAM_DURATION_DAYS) return PROGRAM_DURATION_DAYS;
  return dayNumber;
}

/**
 * Gets the calendar date string (YYYY-MM-DD) for a specific program day number (1..100).
 */
export function getDateForProgramDay(startDateStr: string, dayNumber: number): string {
  const safeStart = isValidDateStr(startDateStr) ? startDateStr : formatLocalDateStr();
  const clampedDay = Math.min(PROGRAM_DURATION_DAYS, Math.max(1, dayNumber));
  const startParts = safeStart.split('-').map(Number);
  const date = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2] + (clampedDay - 1)));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats estimated task duration into a clean display label (e.g., "5m", "12m").
 */
export function formatTaskDuration(minutes: number): string {
  const clamped = Math.min(15, Math.max(2, minutes || 5));
  return `${clamped}m`;
}

/**
 * Sorts tasks by order_index.
 */
export function sortTasksByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

/**
 * Input validation for creating or editing a microtask.
 */
export function validateTaskInput(input: {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  estimated_minutes?: number | string;
  day_number?: number | string;
}): {
  valid: boolean;
  error?: string;
  sanitized: {
    title: string;
    description: string;
    category: Category;
    difficulty: Difficulty;
    estimated_minutes: number;
    day_number: number;
  };
} {
  const rawTitle = (input.title || '').trim();
  if (!rawTitle) {
    return {
      valid: false,
      error: 'Microtask title is required.',
      sanitized: {
        title: '',
        description: '',
        category: 'Productivity',
        difficulty: 'Easy',
        estimated_minutes: 5,
        day_number: 1,
      },
    };
  }
  if (rawTitle.length > 140) {
    return {
      valid: false,
      error: 'Microtask title must be 140 characters or fewer.',
      sanitized: {
        title: rawTitle.slice(0, 140),
        description: '',
        category: 'Productivity',
        difficulty: 'Easy',
        estimated_minutes: 5,
        day_number: 1,
      },
    };
  }

  const validCategories: Category[] = ['Health', 'Productivity', 'Mindfulness', 'Learning', 'Fitness'];
  const category: Category = validCategories.includes(input.category as Category)
    ? (input.category as Category)
    : 'Productivity';

  const validDifficulties: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Epic'];
  const difficulty: Difficulty = validDifficulties.includes(input.difficulty as Difficulty)
    ? (input.difficulty as Difficulty)
    : 'Easy';

  const parsedMinutes = Number(input.estimated_minutes);
  const estimated_minutes = Number.isFinite(parsedMinutes)
    ? Math.min(15, Math.max(2, Math.round(parsedMinutes)))
    : 5;

  const parsedDay = Number(input.day_number);
  const day_number = Number.isFinite(parsedDay)
    ? Math.min(PROGRAM_DURATION_DAYS, Math.max(1, Math.round(parsedDay)))
    : 1;

  return {
    valid: true,
    sanitized: {
      title: rawTitle,
      description: (input.description || '').trim().slice(0, 500),
      category,
      difficulty,
      estimated_minutes,
      day_number,
    },
  };
}

/**
 * Deduplicates tasks by ID and completions by task_id, computing the single authoritative XP balance.
 * Prevents duplicate task IDs and duplicate XP awards.
 */
export function deduplicateAndCalculateAuthoritativeXP(
  tasks: Task[],
  completions: TaskCompletion[]
): {
  uniqueTasks: Task[];
  uniqueCompletions: TaskCompletion[];
  authoritativeTotalXP: number;
} {
  const seenTaskIds = new Set<string>();
  const uniqueTasks: Task[] = [];
  for (const t of tasks) {
    if (t && t.id && !seenTaskIds.has(t.id)) {
      seenTaskIds.add(t.id);
      uniqueTasks.push({
        ...t,
        xp_reward: TASK_XP_REWARD,
        estimated_minutes: Math.min(15, Math.max(2, Number(t.estimated_minutes) || 5)),
        day_number: Math.min(PROGRAM_DURATION_DAYS, Math.max(1, Number(t.day_number) || 1)),
      });
    }
  }

  const seenCompletedTaskIds = new Set<string>();
  const uniqueCompletions: TaskCompletion[] = [];
  for (const c of completions) {
    if (c && c.task_id && !seenCompletedTaskIds.has(c.task_id)) {
      seenCompletedTaskIds.add(c.task_id);
      uniqueCompletions.push({
        ...c,
        xp_awarded: TASK_XP_REWARD,
        day_number: Math.min(PROGRAM_DURATION_DAYS, Math.max(1, Number(c.day_number) || 1)),
      });
    }
  }

  const authoritativeTotalXP = uniqueCompletions.length * TASK_XP_REWARD;

  return {
    uniqueTasks,
    uniqueCompletions,
    authoritativeTotalXP,
  };
}

/**
 * Determines the visual status of any program day (1 to 100).
 */
export function getProgramDayStatus(
  dayNumber: number,
  completedCount: number,
  currentProgramDay: number,
  isRestDay: boolean
): DayStatus {
  if (isRestDay) return 'rest_day';
  if (completedCount >= DAILY_TARGET_TASKS) return 'fully_completed';
  if (completedCount > 0) return 'partially_completed';

  if (dayNumber > currentProgramDay) {
    return 'future';
  }

  return 'not_started';
}

/**
 * Calculates program stats, completion percentages, streaks, consistency, and remaining days.
 * Ensures no percentage exceeds 100% and uses deduplicated completions as the single authoritative source.
 */
export function calculateDashboardAnalytics(
  todayCompletedCount: number,
  totalCompletedCount: number,
  currentProgramDay: number,
  allCompletions: TaskCompletion[] = [],
  restDays: number[] = []
) {
  // Deduplicate completions by task_id for authoritative counts
  const seenTaskIds = new Set<string>();
  const uniqueCompletions: TaskCompletion[] = [];
  for (const c of allCompletions) {
    if (c && c.task_id && !seenTaskIds.has(c.task_id)) {
      seenTaskIds.add(c.task_id);
      uniqueCompletions.push(c);
    }
  }

  const effectiveCompletions = uniqueCompletions.length > 0 || allCompletions.length === 0 ? uniqueCompletions : allCompletions;

  const clampedTodayCount = Math.max(0, todayCompletedCount);
  const clampedTotalCount = Math.max(0, totalCompletedCount);
  const clampedProgramDay = Math.min(100, Math.max(1, currentProgramDay));

  const dailyPct = Math.min(100, Math.round((clampedTodayCount / DAILY_TARGET_TASKS) * 100));
  const overallPct = Math.min(100, Math.round((clampedTotalCount / TOTAL_TARGET_TASKS) * 100));
  const daysRemaining = Math.max(0, PROGRAM_DURATION_DAYS - clampedProgramDay);

  // Group completions by day to find 10/10 full days
  const dayCompletionsMap: Record<number, number> = {};
  effectiveCompletions.forEach((c) => {
    dayCompletionsMap[c.day_number] = (dayCompletionsMap[c.day_number] || 0) + 1;
  });

  const fullCompletedDays: number[] = [];
  for (let d = 1; d <= 100; d++) {
    if ((dayCompletionsMap[d] || 0) >= DAILY_TARGET_TASKS) {
      fullCompletedDays.push(d);
    }
  }

  const day100CompletedCount = dayCompletionsMap[100] || 0;
  const isDay100Complete = day100CompletedCount >= DAILY_TARGET_TASKS;
  const isProgramComplete =
    isDay100Complete ||
    fullCompletedDays.length >= PROGRAM_DURATION_DAYS ||
    clampedTotalCount >= TOTAL_TARGET_TASKS;

  const { currentStreak, longestStreak } = calculateFullDayStreak(
    fullCompletedDays,
    restDays,
    clampedProgramDay
  );

  // Weekly consistency: count completions in the last 7 program days
  const minWeeklyDay = Math.max(1, clampedProgramDay - 6);
  const weeklyCompleted = effectiveCompletions.filter(
    (c) => c.day_number >= minWeeklyDay && c.day_number <= clampedProgramDay
  ).length;
  const weeklyTarget = 7 * DAILY_TARGET_TASKS; // 70
  const weeklyConsistencyPct = Math.min(100, Math.round((weeklyCompleted / weeklyTarget) * 100));

  // Overall consistency: completions / (currentProgramDay * 10)
  const expectedTotalToDate = clampedProgramDay * DAILY_TARGET_TASKS;
  const overallConsistencyPct = Math.min(
    100,
    Math.round((clampedTotalCount / Math.max(1, expectedTotalToDate)) * 100)
  );

  const averageTasksPerDay = parseFloat(
    (clampedTotalCount / Math.max(1, clampedProgramDay)).toFixed(1)
  );

  return {
    dailyCompletedCount: clampedTodayCount,
    dailyTarget: DAILY_TARGET_TASKS,
    dailyPct,
    totalCompletedCount: clampedTotalCount,
    totalTarget: TOTAL_TARGET_TASKS,
    overallPct,
    daysRemaining,
    fullCompletedDaysCount: fullCompletedDays.length,
    currentFullDayStreak: currentStreak,
    longestFullDayStreak: longestStreak,
    weeklyCompleted,
    weeklyTarget,
    weeklyConsistencyPct,
    overallConsistencyPct,
    averageTasksPerDay,
    dayCompletionsMap,
    day100CompletedCount,
    isDay100Complete,
    isProgramComplete,
  };
}

export interface DailyTaskSlot {
  slotNumber: number;
  completed: boolean;
  isCurrentTarget: boolean;
  isHalfwayMilestone: boolean;
  isFinalTarget: boolean;
}

/**
 * Builds the 10 discrete task slots and target metrics for Today's 10-Task Visual Progress Indicator.
 */
export function buildDailyTaskTargetSlots(
  dailyCompletedCount: number,
  dailyTarget: number = DAILY_TARGET_TASKS
): {
  slots: DailyTaskSlot[];
  completedSlots: number;
  remainingSlots: number;
  targetCount: number;
  dailyXpEarned: number;
  dailyXpTarget: number;
  isTargetMet: boolean;
} {
  const safeTarget = Math.max(1, dailyTarget);
  const clampedCompleted = Math.min(safeTarget, Math.max(0, Math.floor(dailyCompletedCount)));
  const remainingSlots = Math.max(0, safeTarget - clampedCompleted);
  const halfwaySlot = Math.ceil(safeTarget / 2);

  const slots: DailyTaskSlot[] = Array.from({ length: safeTarget }, (_, idx) => {
    const slotNumber = idx + 1;
    const completed = slotNumber <= clampedCompleted;
    const isCurrentTarget = slotNumber === clampedCompleted + 1 && clampedCompleted < safeTarget;
    return {
      slotNumber,
      completed,
      isCurrentTarget,
      isHalfwayMilestone: slotNumber === halfwaySlot,
      isFinalTarget: slotNumber === safeTarget,
    };
  });

  return {
    slots,
    completedSlots: clampedCompleted,
    remainingSlots,
    targetCount: safeTarget,
    dailyXpEarned: clampedCompleted * TASK_XP_REWARD,
    dailyXpTarget: safeTarget * TASK_XP_REWARD,
    isTargetMet: clampedCompleted >= safeTarget,
  };
}

