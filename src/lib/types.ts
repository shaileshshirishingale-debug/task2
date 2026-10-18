export type Category = 'Health' | 'Productivity' | 'Mindfulness' | 'Learning' | 'Fitness';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Epic';

export interface UserSettings {
  program_start_date: string; // YYYY-MM-DD
  sound_enabled: boolean;
  haptics_enabled: boolean;
  daily_minimum_mode: boolean; // Guidance mode for tough days
}

export interface ProgramConfig {
  duration_days: number; // 100
  daily_target: number; // 10
  total_target: number; // 1000
  xp_per_task: number; // 10
  min_task_minutes: number; // 2
  max_task_minutes: number; // 15
  start_date: string; // YYYY-MM-DD
}

export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  program_start_date?: string; // YYYY-MM-DD
  sound_enabled?: boolean;
  haptics_enabled?: boolean;
  daily_minimum_mode?: boolean; // Guidance mode for tough days
}

export interface Task {
  id: string;
  user_id: string;
  day_number: number; // Day 1 to Day 100
  title: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  xp_reward: number; // Always 10 XP
  estimated_minutes: number; // 2 to 15 minutes
  order_index: number;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  original_title?: string; // If replaced via Low-Energy Mode
  is_low_energy_replacement?: boolean;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  user_id: string;
  day_number: number;
  completed_date: string; // YYYY-MM-DD
  xp_awarded: number; // 10 XP
  created_at: string;
}

export interface RestDayRecord {
  id: string;
  user_id: string;
  day_number: number;
  date: string;
  reason?: string;
  created_at: string;
}

export interface RewardItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  unlock_type: 'tasks' | 'days';
  target_count: number; // e.g. 10 tasks, 7 days, 30 days, 100 days
  category: 'break' | 'activity' | 'treat' | 'celebration';
  is_claimed: boolean;
  claimed_at?: string;
  created_at: string;
}

export interface DailyReview {
  id: string;
  user_id: string;
  day_number: number;
  date: string;
  what_went_well: string;
  what_learned: string;
  what_distracted: string;
  improvement_tomorrow: string;
  energy_level: number; // 1 to 5
  mood_level: number; // 1 to 5
  created_at: string;
}

export interface MilestoneCelebration {
  id: string;
  key: string;
  title: string;
  description: string;
  threshold_type: 'first_task' | 'first_full_day' | 'days';
  threshold_value: number;
  unlocked_at?: string;
  badge_icon: string;
}

export interface ProgramStats {
  program_start_date: string;
  current_program_day: number;
  selected_day: number;
  daily_completed_count: number;
  daily_target_count: number; // 10
  daily_completion_pct: number;
  total_completed_count: number;
  total_target_count: number; // 1000
  overall_program_pct: number;
  total_full_days_count: number; // Days with 10/10 tasks done
  current_full_day_streak: number;
  longest_full_day_streak: number;
  total_xp: number;
  level: number;
  level_title: string;
  xp_in_current_level: number;
  xp_required_for_next_level: number;
  days_remaining: number;
  weekly_consistency_pct: number;
  overall_consistency_pct: number;
  selected_day_completed_count?: number;
  day_100_completed?: boolean;
  is_program_complete?: boolean;
}

export interface XPTransaction {
  id: string;
  user_id: string;
  task_id?: string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string;
  updated_at: string;
}

export interface UserBackup {
  id: string;
  user_id: string;
  blob_url: string;
  filename: string;
  file_type: 'json' | 'csv';
  file_size: number;
  content_hash?: string;
  from_cache?: boolean;
  created_at: string;
}

export interface UserProfileStats {
  user: User;
  program_stats: ProgramStats;
  total_xp: number;
  level: number;
  level_title: string;
  xp_in_current_level: number;
  xp_required_for_next_level: number;
  streak: UserStreak;
  milestones: MilestoneCelebration[];
  rewards: RewardItem[];
  rest_days: number[];
  completed_today_count: number;
  total_tasks_count: number;
}

export interface ExportDataPayload {
  version: string;
  exported_at: string;
  program: ProgramConfig;
  user?: Partial<User>;
  stats?: {
    totalXP: number;
    level: number;
    totalCompletedMicrotasks: number;
  };
  tasks: Task[];
  completions: TaskCompletion[];
  xpTransactions?: XPTransaction[];
  restDays: number[];
  rewards?: RewardItem[];
  dailyReviews?: DailyReview[];
}
