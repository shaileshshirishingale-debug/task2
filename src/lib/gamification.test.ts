import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLevelProgress,
  calculateFullDayStreak,
  TASK_XP_REWARD,
  ENCOURAGING_MESSAGES,
  SYSTEM_MILESTONES,
} from './gamification.ts';

test('TASK_XP_REWARD is exactly 10 XP', () => {
  assert.equal(TASK_XP_REWARD, 10);
});

test('getLevelProgress matches exact user-requested thresholds', () => {
  // Level 1: 0–99 XP
  const lvl1Start = getLevelProgress(0);
  assert.equal(lvl1Start.level, 1);
  assert.equal(lvl1Start.minXP, 0);
  assert.equal(lvl1Start.maxXP, 99);

  const lvl1End = getLevelProgress(99);
  assert.equal(lvl1End.level, 1);

  // Level 2: 100–249 XP
  const lvl2 = getLevelProgress(100);
  assert.equal(lvl2.level, 2);
  assert.equal(lvl2.minXP, 100);
  assert.equal(lvl2.maxXP, 249);
  assert.equal(lvl2.xp_in_current_level, 0);
  assert.equal(lvl2.xp_required_for_next_level, 150);

  // Level 3: 250–499 XP
  const lvl3 = getLevelProgress(250);
  assert.equal(lvl3.level, 3);
  assert.equal(lvl3.minXP, 250);
  assert.equal(lvl3.maxXP, 499);

  // Level 4: 500–999 XP
  const lvl4 = getLevelProgress(500);
  assert.equal(lvl4.level, 4);
  assert.equal(lvl4.minXP, 500);
  assert.equal(lvl4.maxXP, 999);

  // Level 5: 1,000–1,999 XP
  const lvl5 = getLevelProgress(1000);
  assert.equal(lvl5.level, 5);
  assert.equal(lvl5.minXP, 1000);
  assert.equal(lvl5.maxXP, 1999);
});

test('calculateFullDayStreak respects 10/10 requirement and rest days', () => {
  // Days 1, 2 full. Day 3 rest. Day 4 full. -> Streak = 3 (rest day doesn't break)
  const completed = [1, 2, 4];
  const restDays = [3];
  const streak = calculateFullDayStreak(completed, restDays, 4);
  assert.equal(streak.currentStreak, 3);
  assert.equal(streak.longestStreak, 3);

  // Days 1, 2 full. Day 3 missed. Day 4 full. -> Current streak = 1, Longest = 2
  const brokenStreak = calculateFullDayStreak([1, 2, 4], [], 4);
  assert.equal(brokenStreak.currentStreak, 1);
  assert.equal(brokenStreak.longestStreak, 2);
});

test('Milestone definitions and encouraging messages are present', () => {
  assert.ok(ENCOURAGING_MESSAGES.length >= 10);
  assert.ok(SYSTEM_MILESTONES.some((m) => m.key === 'first_full_day'));
  assert.ok(SYSTEM_MILESTONES.some((m) => m.key === 'days_100'));
});
