import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProgramDay,
  getDateForProgramDay,
  calculateDashboardAnalytics,
  getProgramDayStatus,
  validateTaskInput,
  deduplicateAndCalculateAuthoritativeXP,
  isValidDateStr,
  PROGRAM_DURATION_DAYS,
  DAILY_TARGET_TASKS,
  TOTAL_TARGET_TASKS,
} from './program.ts';
import type { Task, TaskCompletion } from './types.ts';

test('calculateProgramDay correctly calculates Day 1 on start date, handles crossing midnight, and caps between 1 and 100', () => {
  const startDate = '2026-10-18';
  assert.equal(calculateProgramDay(startDate, '2026-10-18'), 1);
  assert.equal(calculateProgramDay(startDate, '2026-10-15'), 1); // Before start date clamps to Day 1
  assert.equal(calculateProgramDay(startDate, '2026-10-19'), 2); // Crossing midnight advances to Day 2
  assert.equal(calculateProgramDay(startDate, '2026-10-27'), 10);
  assert.equal(calculateProgramDay(startDate, '2027-01-25'), 100);
  assert.equal(calculateProgramDay(startDate, '2027-03-01'), 100); // Capped at Day 100
});

test('Changing start date recalculates program-day and calendar dates accurately', () => {
  const today = '2026-10-18';
  assert.equal(calculateProgramDay('2026-10-18', today), 1);
  assert.equal(calculateProgramDay('2026-10-17', today), 2);
  assert.equal(calculateProgramDay('2026-10-09', today), 10);
  assert.equal(calculateProgramDay('2026-07-11', today), 100);
  assert.equal(getDateForProgramDay('2026-10-18', 1), '2026-10-18');
  assert.equal(getDateForProgramDay('2026-10-18', 10), '2026-10-27');
});

test('isValidDateStr validates YYYY-MM-DD safely', () => {
  assert.equal(isValidDateStr('2026-10-18'), true);
  assert.equal(isValidDateStr('2026-02-30'), false);
  assert.equal(isValidDateStr('invalid'), false);
});

test('calculateDashboardAnalytics computes exact daily percentages (0%, 10%, 50%, 80%, 90%, 100%) and caps at 100%', () => {
  assert.equal(calculateDashboardAnalytics(0, 0, 1).dailyPct, 0);
  assert.equal(calculateDashboardAnalytics(1, 1, 1).dailyPct, 10);
  assert.equal(calculateDashboardAnalytics(5, 5, 1).dailyPct, 50);
  assert.equal(calculateDashboardAnalytics(8, 8, 1).dailyPct, 80);
  assert.equal(calculateDashboardAnalytics(9, 9, 1).dailyPct, 90);
  assert.equal(calculateDashboardAnalytics(10, 10, 1).dailyPct, 100);

  const capped = calculateDashboardAnalytics(12, 1100, 10);
  assert.equal(capped.dailyPct, 100); // 12/10 capped at 100%
  assert.equal(capped.overallPct, 100); // 1100/1000 capped at 100%
  assert.equal(capped.daysRemaining, 90); // 100 - 10
});

test('getProgramDayStatus marks 10 tasks as fully_completed and 9 tasks as partially_completed', () => {
  // 10 tasks = fully_completed
  assert.equal(getProgramDayStatus(1, 10, 1, false), 'fully_completed');
  // 9 tasks = partially_completed (even on current day)
  assert.equal(getProgramDayStatus(1, 9, 1, false), 'partially_completed');
  assert.equal(getProgramDayStatus(1, 5, 3, false), 'partially_completed');
  // Rest day
  assert.equal(getProgramDayStatus(2, 0, 3, true), 'rest_day');
  // 0 tasks
  assert.equal(getProgramDayStatus(3, 0, 3, false), 'not_started');
  assert.equal(getProgramDayStatus(5, 0, 3, false), 'future');
});

test('Day 100 completion marks the program complete without deleting historical data', () => {
  const day1Completions: TaskCompletion[] = Array.from({ length: 10 }, (_, i) => ({
    id: `c_d1_${i}`,
    task_id: `t_d1_${i}`,
    user_id: 'u1',
    day_number: 1,
    completed_date: '2026-07-11',
    xp_awarded: 10,
    created_at: '2026-07-11T10:00:00Z',
  }));
  const day100Completions: TaskCompletion[] = Array.from({ length: 10 }, (_, i) => ({
    id: `c_d100_${i}`,
    task_id: `t_d100_${i}`,
    user_id: 'u1',
    day_number: 100,
    completed_date: '2026-10-18',
    xp_awarded: 10,
    created_at: '2026-10-18T10:00:00Z',
  }));
  const allCompletions = [...day1Completions, ...day100Completions];

  const stats = calculateDashboardAnalytics(10, allCompletions.length, 100, allCompletions, []);
  assert.equal(stats.isDay100Complete, true);
  assert.equal(stats.isProgramComplete, true);
  assert.equal(stats.totalCompletedCount, 20);
  assert.equal(stats.dayCompletionsMap[1], 10); // Day 1 history preserved
  assert.equal(stats.dayCompletionsMap[100], 10);
});

test('validateTaskInput enforces title presence and clamps duration (2-15m) and day (1-100)', () => {
  const empty = validateTaskInput({ title: '   ' });
  assert.equal(empty.valid, false);

  const valid = validateTaskInput({
    title: '  Read 5 pages  ',
    category: 'Learning',
    estimated_minutes: 25, // Should clamp to 15
    day_number: 150, // Should clamp to 100
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitized.title, 'Read 5 pages');
  assert.equal(valid.sanitized.estimated_minutes, 15);
  assert.equal(valid.sanitized.day_number, 100);
});

test('deduplicateAndCalculateAuthoritativeXP prevents duplicate task IDs and duplicate XP awards', () => {
  const sampleTask: Task = {
    id: 'task_1',
    user_id: 'user_1',
    day_number: 1,
    title: 'Drink Water',
    category: 'Health',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 2,
    order_index: 0,
    completed: true,
    created_at: '2026-10-18T00:00:00Z',
  };

  const sampleCompletion: TaskCompletion = {
    id: 'comp_1',
    task_id: 'task_1',
    user_id: 'user_1',
    day_number: 1,
    completed_date: '2026-10-18',
    xp_awarded: 10,
    created_at: '2026-10-18T00:05:00Z',
  };

  const duplicateCompletion: TaskCompletion = {
    ...sampleCompletion,
    id: 'comp_2_dup',
  };

  const result = deduplicateAndCalculateAuthoritativeXP(
    [sampleTask, { ...sampleTask }],
    [sampleCompletion, duplicateCompletion]
  );

  assert.equal(result.uniqueTasks.length, 1);
  assert.equal(result.uniqueCompletions.length, 1);
  assert.equal(result.authoritativeTotalXP, 10);
});

test('buildDailyTaskTargetSlots generates 10 discrete task slots and tracks completion toward the 10-task target', async () => {
  const { buildDailyTaskTargetSlots } = await import('./program.ts');

  const zero = buildDailyTaskTargetSlots(0);
  assert.equal(zero.slots.length, 10);
  assert.equal(zero.completedSlots, 0);
  assert.equal(zero.remainingSlots, 10);
  assert.equal(zero.isTargetMet, false);
  assert.equal(zero.slots[0].isCurrentTarget, true);
  assert.equal(zero.slots[4].isHalfwayMilestone, true);
  assert.equal(zero.slots[9].isFinalTarget, true);

  const partial = buildDailyTaskTargetSlots(4);
  assert.equal(partial.completedSlots, 4);
  assert.equal(partial.remainingSlots, 6);
  assert.equal(partial.dailyXpEarned, 40);
  assert.equal(partial.dailyXpTarget, 100);
  assert.equal(partial.slots[3].completed, true);
  assert.equal(partial.slots[4].completed, false);
  assert.equal(partial.slots[4].isCurrentTarget, true);

  const full = buildDailyTaskTargetSlots(10);
  assert.equal(full.completedSlots, 10);
  assert.equal(full.remainingSlots, 0);
  assert.equal(full.isTargetMet, true);
  assert.equal(full.slots.every((s) => s.completed), true);
  assert.equal(full.slots.some((s) => s.isCurrentTarget), false);
});

