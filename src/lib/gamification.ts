import type { MilestoneCelebration, RewardItem } from './types.ts';

export const TASK_XP_REWARD = 10; // Exact 10 XP per completed task

export const LEVEL_TIERS: { level: number; minXP: number; maxXP: number; title: string }[] = [
  { level: 1, minXP: 0, maxXP: 99, title: 'Novice Adventurer' },
  { level: 2, minXP: 100, maxXP: 249, title: 'Apprentice Tracker' },
  { level: 3, minXP: 250, maxXP: 499, title: 'Disciplined Journeyman' },
  { level: 4, minXP: 500, maxXP: 999, title: 'Habit Sentinel' },
  { level: 5, minXP: 1000, maxXP: 1999, title: 'Master Questing Knight' },
  { level: 6, minXP: 2000, maxXP: 3499, title: 'Grandmaster of Growth' },
  { level: 7, minXP: 3500, maxXP: 5499, title: 'Legendary Mind Artisan' },
  { level: 8, minXP: 5500, maxXP: 7999, title: 'Centurion of Will' },
  { level: 9, minXP: 8000, maxXP: 10999, title: 'Vanguard of Discipline' },
  { level: 10, minXP: 11000, maxXP: 14499, title: 'Master of 1,000 Deeds' },
];

/**
 * Calculates level from total XP using transparent thresholds:
 * Level 1: 0–99 XP
 * Level 2: 100–249 XP
 * Level 3: 250–499 XP
 * Level 4: 500–999 XP
 * Level 5: 1,000–1,999 XP
 * Scaled for L >= 6: span = 1,000 + (L - 5) * 500
 */
export function getLevelProgress(totalXP: number) {
  const safeXP = Math.max(0, totalXP);

  // Check defined tiers first
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    const tier = LEVEL_TIERS[i];
    if (safeXP >= tier.minXP && safeXP <= tier.maxXP) {
      const xp_in_current_level = safeXP - tier.minXP;
      const xp_required_for_next_level = tier.maxXP - tier.minXP + 1;
      return {
        level: tier.level,
        level_title: tier.title,
        xp_in_current_level,
        xp_required_for_next_level,
        minXP: tier.minXP,
        maxXP: tier.maxXP,
        progressPct: Math.min(100, Math.round((xp_in_current_level / xp_required_for_next_level) * 100)),
      };
    }
  }

  // Beyond tier 10: dynamic scaling
  let currentLevel = 10;
  let currentMin = 11000;
  let currentSpan = 3500;

  while (safeXP >= currentMin + currentSpan) {
    currentMin += currentSpan;
    currentLevel++;
    currentSpan = 1000 + (currentLevel - 5) * 500;
  }

  const xp_in_current_level = safeXP - currentMin;
  return {
    level: currentLevel,
    level_title: 'Ascendant Champion',
    xp_in_current_level,
    xp_required_for_next_level: currentSpan,
    minXP: currentMin,
    maxXP: currentMin + currentSpan - 1,
    progressPct: Math.min(100, Math.round((xp_in_current_level / currentSpan) * 100)),
  };
}

export const ENCOURAGING_MESSAGES: string[] = [
  'One small win. Keep moving.',
  'You kept your promise to yourself.',
  'Progress is built one action at a time.',
  'Another step completed.',
  'You are building consistency through action.',
  'Small efforts accumulate into great changes.',
  'Discipline is simply honoring the present moment.',
  'Momentum restored. Well done.',
  'Quiet consistency beats loud intentions.',
  'Each finished task clears mental space.',
  'Trust the process of showing up.',
  'You are making steady, genuine progress.',
  'Focus achieved. Onward to the next win.',
  'Action cures hesitation. Great job.',
  'Building the habit brick by brick.',
];

/**
 * Returns a random non-repeating encouraging message.
 */
let lastMessageIndex = -1;
export function getRandomEncouragingMessage(): string {
  let index = Math.floor(Math.random() * ENCOURAGING_MESSAGES.length);
  if (index === lastMessageIndex) {
    index = (index + 1) % ENCOURAGING_MESSAGES.length;
  }
  lastMessageIndex = index;
  return ENCOURAGING_MESSAGES[index];
}

export const SYSTEM_MILESTONES: Omit<MilestoneCelebration, 'id' | 'unlocked_at'>[] = [
  {
    key: 'first_task',
    title: 'First Step into Action',
    description: 'Completed your very first microtask.',
    threshold_type: 'first_task',
    threshold_value: 1,
    badge_icon: 'CheckCircle2',
  },
  {
    key: 'first_full_day',
    title: 'Flawless Ten',
    description: 'Completed all 10 microtasks in a single day.',
    threshold_type: 'first_full_day',
    threshold_value: 1,
    badge_icon: 'Crown',
  },
  {
    key: 'days_3',
    title: 'Three-Day Spark',
    description: 'Achieved 3 successful 10/10 days.',
    threshold_type: 'days',
    threshold_value: 3,
    badge_icon: 'Flame',
  },
  {
    key: 'days_7',
    title: 'One Week of Discipline',
    description: 'Achieved 7 successful 10/10 days.',
    threshold_type: 'days',
    threshold_value: 7,
    badge_icon: 'Zap',
  },
  {
    key: 'days_14',
    title: 'Fortnight of Focus',
    description: 'Achieved 14 successful 10/10 days.',
    threshold_type: 'days',
    threshold_value: 14,
    badge_icon: 'Shield',
  },
  {
    key: 'days_30',
    title: 'Month of Mastery',
    description: 'Achieved 30 successful 10/10 days.',
    threshold_type: 'days',
    threshold_value: 30,
    badge_icon: 'Award',
  },
  {
    key: 'days_50',
    title: 'Halfway Titan',
    description: 'Achieved 50 successful 10/10 days.',
    threshold_type: 'days',
    threshold_value: 50,
    badge_icon: 'Sparkles',
  },
  {
    key: 'days_75',
    title: 'Diamond Resolve',
    description: 'Achieved 75 successful 10/10 days.',
    threshold_type: 'days',
    threshold_value: 75,
    badge_icon: 'Trophy',
  },
  {
    key: 'days_100',
    title: 'Centurion of 1,000 Tasks',
    description: 'Conquered all 100 days of the program!',
    threshold_type: 'days',
    threshold_value: 100,
    badge_icon: 'Star',
  },
];

export const DEFAULT_SUGGESTED_REWARDS: Omit<RewardItem, 'id' | 'user_id' | 'is_claimed' | 'created_at'>[] = [
  {
    title: '15-Minute Mindful Walk & Herbal Tea',
    description: 'Step away from all screens to enjoy fresh air and warm tea.',
    unlock_type: 'tasks',
    target_count: 10,
    category: 'break',
  },
  {
    title: 'Movie Night or Favorite Outdoor Activity',
    description: 'Dedicate an evening to a film or hobby you love guilt-free.',
    unlock_type: 'days',
    target_count: 7,
    category: 'activity',
  },
  {
    title: 'Personally Selected Book or Tool',
    description: 'Pick out an inspiring physical book or creative tool.',
    unlock_type: 'days',
    target_count: 30,
    category: 'treat',
  },
  {
    title: 'Grand Milestone Celebration & Day Trip',
    description: 'Celebrate completing 100 days of consistency with loved ones.',
    unlock_type: 'days',
    target_count: 100,
    category: 'celebration',
  },
];

/**
 * Calculates current and longest full-day streak.
 * Only days with 10/10 completed tasks count.
 * Rest days do NOT break streak!
 */
export function calculateFullDayStreak(
  completedDayNumbers: number[],
  restDayNumbers: number[],
  currentProgramDay: number
): { currentStreak: number; longestStreak: number } {
  const fullDaysSet = new Set(completedDayNumbers);
  const restDaysSet = new Set(restDayNumbers);

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  for (let day = 1; day <= currentProgramDay; day++) {
    if (fullDaysSet.has(day)) {
      runningStreak++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else if (restDaysSet.has(day)) {
      // Rest day: preserve running streak without incrementing or resetting
      continue;
    } else if (day < currentProgramDay) {
      // Missed past day: resets running streak (historical longestStreak remains intact)
      runningStreak = 0;
    }
    // If day === currentProgramDay and not yet 10/10, today is still ongoing so yesterday's streak remains active
  }

  currentStreak = runningStreak;
  return { currentStreak, longestStreak };
}
