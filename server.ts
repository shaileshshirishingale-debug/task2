import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import crypto from 'crypto';
import { db } from './src/lib/db.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  requireAuth,
  AuthenticatedRequest,
} from './src/lib/auth.js';
import {
  getLevelProgress,
  TASK_XP_REWARD,
  getRandomEncouragingMessage,
  SYSTEM_MILESTONES,
  DEFAULT_SUGGESTED_REWARDS,
  calculateFullDayStreak,
} from './src/lib/gamification.js';
import {
  calculateProgramDay,
  formatLocalDateStr,
  getDateForProgramDay,
  getProgramDayStatus,
  calculateDashboardAnalytics,
  validateTaskInput,
  PROGRAM_DURATION_DAYS,
  DAILY_TARGET_TASKS,
  TOTAL_TARGET_TASKS,
} from './src/lib/program.js';
import { blobStorage } from './src/lib/blob.js';
import type { Task, Category, Difficulty, DailyReview, UserBackup, ExportDataPayload } from './src/lib/types.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  aiClient = new GoogleGenAI({ apiKey: geminiApiKey });
}

// 10 Seed Microtasks (2 to 15 mins) for Day 1
const SEED_MICROTASKS_DAY_1: Omit<Task, 'id' | 'user_id' | 'created_at'>[] = [
  {
    day_number: 1,
    title: 'Drink 1 Glass of Cold Water',
    description: 'Hydrate immediately upon waking to jumpstart metabolism.',
    category: 'Health',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 2,
    order_index: 0,
    completed: false,
  },
  {
    day_number: 1,
    title: '5-Minute Posture Stretch',
    description: 'Relieve neck and shoulder tension with mobility moves.',
    category: 'Health',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 5,
    order_index: 1,
    completed: false,
  },
  {
    day_number: 1,
    title: 'Clear Desktop & Close Stale Tabs',
    description: 'Declutter workspace for maximum mental clarity.',
    category: 'Productivity',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 3,
    order_index: 2,
    completed: false,
  },
  {
    day_number: 1,
    title: 'Write Down Top 3 Priorities for Today',
    description: 'Identify the highest-leverage tasks to accomplish.',
    category: 'Productivity',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 5,
    order_index: 3,
    completed: false,
  },
  {
    day_number: 1,
    title: '10-Minute Deep Work Sprint',
    description: 'Execute uninterrupted focus on priority #1.',
    category: 'Productivity',
    difficulty: 'Medium',
    xp_reward: 10,
    estimated_minutes: 10,
    order_index: 4,
    completed: false,
  },
  {
    day_number: 1,
    title: '3-Minute Mindful Breathwork',
    description: 'Inhale for 4 seconds, hold for 4, exhale for 4.',
    category: 'Mindfulness',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 3,
    order_index: 5,
    completed: false,
  },
  {
    day_number: 1,
    title: 'Read 5 Pages of an Educative Book',
    description: 'Absorb a new concept or framework.',
    category: 'Learning',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 10,
    order_index: 6,
    completed: false,
  },
  {
    day_number: 1,
    title: '20 Bodyweight Pushups or Squats',
    description: 'Quick physical activation for energy.',
    category: 'Fitness',
    difficulty: 'Medium',
    xp_reward: 10,
    estimated_minutes: 5,
    order_index: 7,
    completed: false,
  },
  {
    day_number: 1,
    title: 'Send an Encouraging Note to a Friend',
    description: 'Cultivate strong relationships with a quick message.',
    category: 'Mindfulness',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 3,
    order_index: 8,
    completed: false,
  },
  {
    day_number: 1,
    title: 'Log Evening Reflection & Gratitude',
    description: 'Summarize today’s microtask victories.',
    category: 'Mindfulness',
    difficulty: 'Easy',
    xp_reward: 10,
    estimated_minutes: 5,
    order_index: 9,
    completed: false,
  },
];

// AUTH ROUTES
app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username, program_start_date } = req.body;
    if (!email || !password || !username) {
      res.status(400).json({ error: 'Email, password, and username are required' });
      return;
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists' });
      return;
    }

    const userId = `user_${crypto.randomBytes(8).toString('hex')}`;
    const password_hash = await hashPassword(password);
    const createdAt = new Date().toISOString();
    const startDateStr = program_start_date || formatLocalDateStr();

    const user = await db.createUser({
      id: userId,
      email,
      username,
      password_hash,
      program_start_date: startDateStr,
      sound_enabled: false,
      haptics_enabled: false,
      daily_minimum_mode: false,
      created_at: createdAt,
    });

    // Seed Day 1 microtasks
    for (const seed of SEED_MICROTASKS_DAY_1) {
      await db.createTask({
        id: `task_${crypto.randomBytes(8).toString('hex')}`,
        user_id: userId,
        ...seed,
        created_at: createdAt,
      });
    }

    // Seed default healthy rewards
    for (const rew of DEFAULT_SUGGESTED_REWARDS) {
      await db.createReward({
        id: `rew_${crypto.randomBytes(8).toString('hex')}`,
        user_id: userId,
        ...rew,
        is_claimed: false,
        created_at: createdAt,
      });
    }

    const token = generateToken(userId, email);
    res.json({ token, user });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register account' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const userWithHash = await db.getUserByEmail(email);
    if (!userWithHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const match = await comparePassword(password, userWithHash.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { password_hash, ...user } = userWithHash;
    const token = generateToken(user.id, user.email);

    res.json({ token, user });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await db.getUserById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// PREFERENCES & START DATE
app.post('/api/user/preferences', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sound_enabled, haptics_enabled, daily_minimum_mode, program_start_date } = req.body;
    const updated = await db.updateUserPreferences(req.userId!, {
      sound_enabled,
      haptics_enabled,
      daily_minimum_mode,
      program_start_date,
    });
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user preferences' });
  }
});

// TASKS ROUTES
app.get('/api/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dayParam = req.query.day ? parseInt(req.query.day as string, 10) : undefined;
    if (dayParam !== undefined && Number.isFinite(dayParam) && dayParam >= 1 && dayParam <= 100) {
      const tasks = await db.ensureDayTasksSeeded(req.userId!, dayParam, SEED_MICROTASKS_DAY_1);
      res.json({ tasks });
      return;
    }
    const tasks = await db.getTasksByUserId(req.userId!, dayParam);
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, difficulty, day_number, estimated_minutes, order_index } = req.body;
    const validation = validateTaskInput({
      title,
      description,
      category,
      difficulty,
      day_number,
      estimated_minutes,
    });
    if (!validation.valid) {
      res.status(400).json({ error: validation.error || 'Invalid microtask input' });
      return;
    }

    const { sanitized } = validation;
    const existingDayTasks = await db.getTasksByUserId(req.userId!, sanitized.day_number);
    const nextOrderIndex = order_index !== undefined ? order_index : existingDayTasks.length;

    const newTask: Task = {
      id: `task_${crypto.randomBytes(8).toString('hex')}`,
      user_id: req.userId!,
      day_number: sanitized.day_number,
      title: sanitized.title,
      description: sanitized.description,
      category: sanitized.category,
      difficulty: sanitized.difficulty,
      xp_reward: 10, // Exactly 10 XP
      estimated_minutes: sanitized.estimated_minutes,
      order_index: nextOrderIndex,
      completed: false,
      created_at: new Date().toISOString(),
    };

    const created = await db.createTask(newTask);
    res.json({ task: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create microtask' });
  }
});

app.put('/api/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id;
    const existing = await db.getTaskById(taskId);

    if (!existing || existing.user_id !== req.userId) {
      res.status(404).json({ error: 'Task not found or unauthorized' });
      return;
    }

    const { title, description, category, difficulty, estimated_minutes, order_index } = req.body;
    const updated: Task = {
      ...existing,
      title: title !== undefined ? title : existing.title,
      description: description !== undefined ? description : existing.description,
      category: category || existing.category,
      difficulty: difficulty || existing.difficulty,
      xp_reward: 10,
      estimated_minutes: estimated_minutes ? Math.min(15, Math.max(2, parseInt(estimated_minutes, 10))) : existing.estimated_minutes,
      order_index: order_index !== undefined ? order_index : existing.order_index,
    };

    const saved = await db.updateTask(updated);
    res.json({ task: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update microtask' });
  }
});

app.post('/api/tasks/reorder', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskOrders } = req.body;
    if (!Array.isArray(taskOrders)) {
      res.status(400).json({ error: 'taskOrders array is required' });
      return;
    }

    await db.reorderTasks(req.userId!, taskOrders);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder microtasks' });
  }
});

app.delete('/api/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id;
    const deleted = await db.deleteTask(taskId, req.userId!);
    if (!deleted) {
      res.status(404).json({ error: 'Task not found or unauthorized' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// LOW-ENERGY TASK REPLACEMENT
app.post('/api/tasks/:id/low-energy', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id;
    const { easierTitle, easierMinutes } = req.body;
    const task = await db.getTaskById(taskId);
    if (!task || task.user_id !== req.userId) {
      res.status(404).json({ error: 'Task not found or unauthorized' });
      return;
    }

    const updatedTask = await db.updateTask({
      ...task,
      original_title: task.original_title || task.title,
      title: easierTitle || `Gentle: 3m Light ${task.title.slice(0, 25)}`,
      estimated_minutes: easierMinutes ? Math.min(15, Math.max(2, easierMinutes)) : 3,
      difficulty: 'Easy',
      is_low_energy_replacement: true,
    });

    res.json({ task: updatedTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to replace with low-energy task' });
  }
});

// NEXT-DAY PLANNING (Duplicate tasks from Day D to Day D+1)
app.post('/api/tasks/copy-to-next-day', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { fromDay, toDay } = req.body;
    const sourceDay = Math.min(100, Math.max(1, parseInt(fromDay, 10)));
    const destDay = Math.min(100, Math.max(1, parseInt(toDay, 10) || sourceDay + 1));

    const sourceTasks = await db.getTasksByUserId(req.userId!, sourceDay);
    if (sourceTasks.length === 0) {
      res.status(400).json({ error: 'No tasks to copy from source day' });
      return;
    }

    const existingDestTasks = await db.getTasksByUserId(req.userId!, destDay);
    let orderOffset = existingDestTasks.length;

    const createdTasks = [];
    for (const st of sourceTasks) {
      const copy = await db.createTask({
        id: `task_${crypto.randomBytes(8).toString('hex')}`,
        user_id: req.userId!,
        day_number: destDay,
        title: st.title,
        description: st.description,
        category: st.category,
        difficulty: st.difficulty,
        xp_reward: 10,
        estimated_minutes: st.estimated_minutes,
        order_index: orderOffset++,
        completed: false,
        created_at: new Date().toISOString(),
      });
      createdTasks.push(copy);
    }

    res.json({ success: true, copiedCount: createdTasks.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to copy tasks to next day' });
  }
});

// TASK COMPLETION & UNCOMPLETION (Exact 10 XP & Varied Encouragement)
app.post('/api/tasks/:id/complete', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id;
    const userId = req.userId!;
    const user = await db.getUserById(userId);

    const task = await db.getTaskById(taskId);
    if (!task || task.user_id !== userId) {
      res.status(404).json({ error: 'Task not found or unauthorized' });
      return;
    }

    // Check if already completed (prevent double-awarding)
    const existingCompletion = await db.getCompletionForTask(taskId);
    if (existingCompletion) {
      res.json({
        alreadyCompleted: true,
        xpAwarded: 0,
        task,
        encouragingMessage: 'Task already completed!',
      });
      return;
    }

    const startDateStr = user?.program_start_date || formatLocalDateStr();
    const taskDateStr = getDateForProgramDay(startDateStr, task.day_number);
    const createdAt = new Date().toISOString();

    // 1. Record completion with exactly 10 XP
    await db.recordTaskCompletion({
      id: `comp_${crypto.randomBytes(8).toString('hex')}`,
      task_id: taskId,
      user_id: userId,
      day_number: task.day_number,
      completed_date: taskDateStr,
      xp_awarded: TASK_XP_REWARD,
      created_at: createdAt,
    });

    // 2. Record 10 XP transaction
    await db.recordXPTransaction({
      id: `xp_${crypto.randomBytes(8).toString('hex')}`,
      user_id: userId,
      task_id: taskId,
      amount: TASK_XP_REWARD,
      reason: `Completed Day ${task.day_number} microtask: ${task.title}`,
      created_at: createdAt,
    });

    // 3. Mark task completed
    const updatedTask = await db.updateTask({
      ...task,
      completed: true,
      completed_at: createdAt,
    });

    // 4. Calculate total XP & level progress
    const newTotalXP = await db.getTotalXP(userId);
    const levelProgress = getLevelProgress(newTotalXP);

    // 5. Check milestone celebration
    const allCompletions = await db.getTaskCompletionsByUserId(userId);
    const dayTasks = await db.getTasksByUserId(userId, task.day_number);
    const dayCompletedCount = dayTasks.filter((t) => t.completed).length;

    let milestoneCelebration: string | null = null;
    if (task.day_number === 100 && dayCompletedCount >= 10) {
      milestoneCelebration = 'Centurion of 1,000 Tasks: Day 100 & 100-Day Program Complete!';
    } else if (allCompletions.length === 1) {
      milestoneCelebration = 'First Step into Action: 1st task completed!';
    } else if (dayCompletedCount === 10) {
      milestoneCelebration = `Flawless Ten: All 10 tasks completed for Day ${task.day_number}!`;
    }

    const encouragingMessage = getRandomEncouragingMessage();

    res.json({
      alreadyCompleted: false,
      xpAwarded: TASK_XP_REWARD,
      task: updatedTask,
      totalXP: newTotalXP,
      levelProgress,
      encouragingMessage,
      milestoneCelebration,
    });
  } catch (err: any) {
    console.error('Complete task error:', err);
    res.status(500).json({ error: 'Failed to complete microtask' });
  }
});

app.post('/api/tasks/:id/uncomplete', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id;
    const userId = req.userId!;

    const task = await db.getTaskById(taskId);
    if (!task || task.user_id !== userId) {
      res.status(404).json({ error: 'Task not found or unauthorized' });
      return;
    }

    // Uncomplete reverses XP consistently and removes completion entry
    await db.removeTaskCompletion(taskId, userId);

    const updatedTask = await db.updateTask({
      ...task,
      completed: false,
      completed_at: undefined,
    });

    const newTotalXP = await db.getTotalXP(userId);
    const levelProgress = getLevelProgress(newTotalXP);

    res.json({
      success: true,
      task: updatedTask,
      totalXP: newTotalXP,
      levelProgress,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to uncomplete microtask' });
  }
});

// REST DAYS
app.post('/api/days/:day/toggle-rest', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dayNum = Math.min(100, Math.max(1, parseInt(req.params.day, 10)));
    const user = await db.getUserById(req.userId!);
    const startDateStr = user?.program_start_date || formatLocalDateStr();
    const dateStr = getDateForProgramDay(startDateStr, dayNum);

    const result = await db.toggleRestDay(req.userId!, dayNum, dateStr, req.body.reason);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle rest day' });
  }
});

// REWARD MENU ROUTES
app.get('/api/rewards', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rewards = await db.getRewards(req.userId!);
    res.json({ rewards });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reward menu' });
  }
});

app.post('/api/rewards', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, unlock_type, target_count, category } = req.body;
    if (!title || !target_count) {
      res.status(400).json({ error: 'Title and target count are required' });
      return;
    }

    const newReward = await db.createReward({
      id: `rew_${crypto.randomBytes(8).toString('hex')}`,
      user_id: req.userId!,
      title,
      description: description || '',
      unlock_type: unlock_type === 'days' ? 'days' : 'tasks',
      target_count: Math.max(1, parseInt(target_count, 10)),
      category: category || 'break',
      is_claimed: false,
      created_at: new Date().toISOString(),
    });

    res.json({ reward: newReward });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create reward' });
  }
});

app.post('/api/rewards/:id/toggle-claim', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const updated = await db.toggleRewardClaim(req.userId!, req.params.id);
    if (!updated) {
      res.status(404).json({ error: 'Reward not found' });
      return;
    }
    res.json({ reward: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle reward claim' });
  }
});

// DAILY REVIEW ROUTES
app.get('/api/reviews/:day', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dayNum = Math.min(100, Math.max(1, parseInt(req.params.day, 10)));
    const review = await db.getDailyReview(req.userId!, dayNum);
    res.json({ review });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily review' });
  }
});

app.post('/api/reviews/:day', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dayNum = Math.min(100, Math.max(1, parseInt(req.params.day, 10)));
    const user = await db.getUserById(req.userId!);
    const startDateStr = user?.program_start_date || formatLocalDateStr();
    const dateStr = getDateForProgramDay(startDateStr, dayNum);

    const { what_went_well, what_learned, what_distracted, improvement_tomorrow, energy_level, mood_level } = req.body;

    const saved = await db.saveDailyReview({
      id: `rev_${crypto.randomBytes(8).toString('hex')}`,
      user_id: req.userId!,
      day_number: dayNum,
      date: dateStr,
      what_went_well: what_went_well || '',
      what_learned: what_learned || '',
      what_distracted: what_distracted || '',
      improvement_tomorrow: improvement_tomorrow || '',
      energy_level: Math.min(5, Math.max(1, parseInt(energy_level, 10) || 3)),
      mood_level: Math.min(5, Math.max(1, parseInt(mood_level, 10) || 3)),
      created_at: new Date().toISOString(),
    });

    res.json({ review: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save daily review' });
  }
});

// DETAILED ANALYTICS AND REPORTS
app.get('/api/analytics', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await db.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const clientLocalDate = typeof req.query.localDate === 'string' ? req.query.localDate : formatLocalDateStr();
    const startDateStr = user.program_start_date || clientLocalDate;
    const currentProgramDay = calculateProgramDay(startDateStr, clientLocalDate);

    const allTasks = await db.getAllTasksByUserId(userId);
    const allCompletions = await db.getTaskCompletionsByUserId(userId);
    const restDays = await db.getRestDays(userId);
    const totalXP = await db.getTotalXP(userId);

    // Heatmap array for 100 days
    const dayCounts: Record<number, number> = {};
    allCompletions.forEach((c) => {
      dayCounts[c.day_number] = (dayCounts[c.day_number] || 0) + 1;
    });

    const heatmap = Array.from({ length: 100 }, (_, i) => {
      const dayNum = i + 1;
      const count = dayCounts[dayNum] || 0;
      const isRest = restDays.includes(dayNum);
      const status = getProgramDayStatus(dayNum, count, currentProgramDay, isRest);
      const date = getDateForProgramDay(startDateStr, dayNum);
      return {
        day_number: dayNum,
        date,
        completed_count: count,
        status,
        is_rest: isRest,
        percentage: Math.min(100, Math.round((count / 10) * 100)),
      };
    });

    // Category breakdown
    const categoryCounts: Record<string, number> = {
      Health: 0,
      Productivity: 0,
      Mindfulness: 0,
      Learning: 0,
      Fitness: 0,
    };

    allTasks.forEach((t) => {
      if (t.completed && categoryCounts[t.category] !== undefined) {
        categoryCounts[t.category]++;
      }
    });

    // Best-performing day of week (0=Sun, 1=Mon, ..., 6=Sat)
    const dayOfWeekCompletions: number[] = [0, 0, 0, 0, 0, 0, 0];
    allCompletions.forEach((c) => {
      const d = new Date(c.completed_date + 'T12:00:00Z');
      const dow = d.getUTCDay();
      dayOfWeekCompletions[dow]++;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDayIdx = 1;
    let maxDowCount = -1;
    dayOfWeekCompletions.forEach((cnt, idx) => {
      if (cnt > maxDowCount) {
        maxDowCount = cnt;
        bestDayIdx = idx;
      }
    });

    const analytics = calculateDashboardAnalytics(
      dayCounts[currentProgramDay] || 0,
      allCompletions.length,
      currentProgramDay,
      allCompletions,
      restDays
    );

    res.json({
      analytics,
      heatmap,
      categoryCounts,
      bestDayOfWeek: {
        name: dayNames[bestDayIdx],
        completions: maxDowCount,
      },
      dayOfWeekCompletions: dayNames.map((name, i) => ({
        day: name.slice(0, 3),
        count: dayOfWeekCompletions[i],
      })),
      totalXP,
      levelProgress: getLevelProgress(totalXP),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate analytics report' });
  }
});

// PROFILE & PROGRAM STATS
app.get('/api/profile', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await db.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const clientLocalDate = typeof req.query.localDate === 'string' ? req.query.localDate : formatLocalDateStr();
    const startDateStr = user.program_start_date || clientLocalDate;
    const currentProgramDay = calculateProgramDay(startDateStr, clientLocalDate);
    const selectedDayParam = req.query.selectedDay ? parseInt(req.query.selectedDay as string, 10) : currentProgramDay;
    const selectedDay = Math.min(100, Math.max(1, selectedDayParam));

    const totalXP = await db.getTotalXP(userId);
    const levelProgress = getLevelProgress(totalXP);
    const allCompletions = await db.getTaskCompletionsByUserId(userId);
    const restDays = await db.getRestDays(userId);
    const rewards = await db.getRewards(userId);

    const todayCompletedCount = allCompletions.filter((c) => c.day_number === currentProgramDay).length;
    const selectedDayCompletedCount = allCompletions.filter((c) => c.day_number === selectedDay).length;

    const analytics = calculateDashboardAnalytics(
      todayCompletedCount,
      allCompletions.length,
      currentProgramDay,
      allCompletions,
      restDays
    );

    const allTasks = await db.getAllTasksByUserId(userId);

    // Milestones check
    const milestones = SYSTEM_MILESTONES.map((m) => {
      let isUnlocked = false;
      if (m.threshold_type === 'first_task' && allCompletions.length >= 1) {
        isUnlocked = true;
      } else if (m.threshold_type === 'first_full_day' && analytics.fullCompletedDaysCount >= 1) {
        isUnlocked = true;
      } else if (m.key === 'days_100' && analytics.isProgramComplete) {
        isUnlocked = true;
      } else if (m.threshold_type === 'days' && analytics.fullCompletedDaysCount >= m.threshold_value) {
        isUnlocked = true;
      }
      return {
        ...m,
        id: `milestone_${m.key}`,
        unlocked_at: isUnlocked ? 'Unlocked' : undefined,
      };
    });

    res.json({
      user,
      program_stats: {
        program_start_date: startDateStr,
        current_program_day: currentProgramDay,
        selected_day: selectedDay,
        daily_completed_count: analytics.dailyCompletedCount,
        selected_day_completed_count: selectedDayCompletedCount,
        daily_target_count: DAILY_TARGET_TASKS,
        daily_completion_pct: analytics.dailyPct,
        total_completed_count: analytics.totalCompletedCount,
        total_target_count: TOTAL_TARGET_TASKS,
        overall_program_pct: analytics.overallPct,
        total_full_days_count: analytics.fullCompletedDaysCount,
        current_full_day_streak: analytics.currentFullDayStreak,
        longest_full_day_streak: analytics.longestFullDayStreak,
        total_xp: totalXP,
        level: levelProgress.level,
        level_title: levelProgress.level_title,
        xp_in_current_level: levelProgress.xp_in_current_level,
        xp_required_for_next_level: levelProgress.xp_required_for_next_level,
        days_remaining: analytics.daysRemaining,
        weekly_consistency_pct: analytics.weeklyConsistencyPct,
        overall_consistency_pct: analytics.overallConsistencyPct,
        day_100_completed: analytics.isDay100Complete,
        is_program_complete: analytics.isProgramComplete,
      },
      total_xp: totalXP,
      level: levelProgress.level,
      level_title: levelProgress.level_title,
      xp_in_current_level: levelProgress.xp_in_current_level,
      xp_required_for_next_level: levelProgress.xp_required_for_next_level,
      streak: {
        id: `streak_${userId}`,
        user_id: userId,
        current_streak: analytics.currentFullDayStreak,
        longest_streak: analytics.longestFullDayStreak,
        updated_at: new Date().toISOString(),
      },
      milestones,
      rewards,
      rest_days: restDays,
      completed_today_count: analytics.dailyCompletedCount,
      total_tasks_count: allTasks.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile & 100-day program stats' });
  }
});

// DATA EXPORT (JSON & CSV FOR TASK HISTORY AND ANALYTICS)
app.post('/api/blob/export-data', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const format = req.body.format === 'csv' ? 'csv' : 'json';
    const includePrivateJournals = req.body.includePrivateJournals !== false;

    const user = await db.getUserById(userId);
    const tasks = await db.getAllTasksByUserId(userId);
    const completions = await db.getTaskCompletionsByUserId(userId);
    const xpTransactions = await db.getXPTransactionsByUserId(userId);
    const restDays = await db.getRestDays(userId);
    const rewards = await db.getRewards(userId);
    const dailyReviews = includePrivateJournals ? await db.getAllDailyReviews(userId) : [];
    const totalXP = await db.getTotalXP(userId);
    const startDateStr = user?.program_start_date || formatLocalDateStr();
    const currentProgramDay = calculateProgramDay(startDateStr);

    let exportContent = '';
    let contentType = 'application/json';
    const filename = `questhabit_100day_${format}_${Date.now()}.${format}`;

    if (format === 'json') {
      const exportObject: ExportDataPayload = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        program: {
          duration_days: PROGRAM_DURATION_DAYS,
          daily_target: DAILY_TARGET_TASKS,
          total_target: TOTAL_TARGET_TASKS,
          xp_per_task: 10,
          min_task_minutes: 2,
          max_task_minutes: 15,
          start_date: startDateStr,
        },
        user: user
          ? {
              username: user.username,
              program_start_date: user.program_start_date,
              sound_enabled: user.sound_enabled,
              haptics_enabled: user.haptics_enabled,
              daily_minimum_mode: user.daily_minimum_mode,
            }
          : undefined,
        stats: {
          totalXP,
          level: getLevelProgress(totalXP).level,
          totalCompletedMicrotasks: completions.length,
        },
        tasks,
        completions,
        xpTransactions,
        restDays,
        rewards,
        dailyReviews: includePrivateJournals ? dailyReviews : undefined,
      };
      exportContent = JSON.stringify(exportObject, null, 2);
      contentType = 'application/json';
    } else {
      contentType = 'text/csv';
      const analytics = calculateDashboardAnalytics(
        completions.filter((c) => c.day_number === currentProgramDay).length,
        completions.length,
        currentProgramDay,
        completions,
        restDays
      );

      const csvLines = [
        'Record_Type,Day_Number,Date,Task_ID,Title,Category,Difficulty,Estimated_Minutes,XP_Awarded,Status,Completed_At,Completion_Pct',
      ];

      // Section 1: Task History
      tasks.forEach((t) => {
        const dateStr = getDateForProgramDay(startDateStr, t.day_number);
        const safeTitle = `"${(t.title || '').replace(/"/g, '""')}"`;
        csvLines.push(
          `Task_History,Day ${t.day_number},${dateStr},${t.id},${safeTitle},${t.category},${t.difficulty},${t.estimated_minutes}m,${t.completed ? 10 : 0},${t.completed ? 'Completed' : 'Pending'},${t.completed_at || ''},`
        );
      });

      // Section 2: Daily Analytics Summary
      for (let d = 1; d <= currentProgramDay; d++) {
        const count = analytics.dayCompletionsMap[d] || 0;
        const pct = Math.min(100, Math.round((count / 10) * 100));
        const isRest = restDays.includes(d);
        const status = getProgramDayStatus(d, count, currentProgramDay, isRest);
        const dateStr = getDateForProgramDay(startDateStr, d);
        csvLines.push(
          `Daily_Analytics,Day ${d},${dateStr},,"Day ${d} Summary (${count}/10 completed)",All,Standard,0m,${count * 10},${status},,${pct}%`
        );
      }

      // Section 3: Overall Program Analytics Row
      csvLines.push(
        `Program_Summary,Day ${currentProgramDay},${formatLocalDateStr()},,"Overall 100-Day Program (${completions.length}/1000 tasks | Current Streak: ${analytics.currentFullDayStreak}d | Best Streak: ${analytics.longestFullDayStreak}d)",All,All,0m,${totalXP},Active,,${analytics.overallPct}%`
      );

      exportContent = csvLines.join('\n');
    }

    const uploadRes = await blobStorage.uploadFile(filename, exportContent, contentType);
    const existingBackups = await db.getUserBackups(userId);
    const matchingExisting = existingBackups.find(
      (b) =>
        b.file_type === format &&
        ((uploadRes.contentHash && b.content_hash === uploadRes.contentHash) || b.blob_url === uploadRes.url)
    );

    let savedBackup: UserBackup;
    if (uploadRes.fromCache && matchingExisting) {
      savedBackup = {
        ...matchingExisting,
        from_cache: true,
      };
    } else {
      const backupRecord: UserBackup = {
        id: `backup_${crypto.randomBytes(8).toString('hex')}`,
        user_id: userId,
        blob_url: uploadRes.url,
        filename,
        file_type: format,
        file_size: uploadRes.size,
        content_hash: uploadRes.contentHash,
        from_cache: uploadRes.fromCache,
        created_at: new Date().toISOString(),
      };
      savedBackup = await db.saveUserBackup(backupRecord);
    }

    res.json({
      backup: savedBackup,
      blobConfigured: blobStorage.isConfigured(),
      downloadUrl: uploadRes.url,
      rawContent: exportContent,
      filename: savedBackup.filename,
      contentType,
      fromCache: uploadRes.fromCache,
      contentHash: uploadRes.contentHash,
      cacheStats: blobStorage.getCacheStats(),
    });
  } catch (err: any) {
    console.error('Export data error:', err);
    res.status(500).json({ error: 'Failed to generate data export' });
  }
});

// CACHED SNAPSHOT DOWNLOAD (Serves from in-memory cache or decodes data URI / proxies blob without 404 redirects)
app.get('/api/blob/download/:backupId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const backupId = req.params.backupId;
    const backups = await db.getUserBackups(userId);
    const backup = backups.find((b) => b.id === backupId);

    if (!backup) {
      res.status(404).json({ error: 'Backup snapshot not found' });
      return;
    }

    const fallbackContentType = backup.file_type === 'csv' ? 'text/csv' : 'application/json';

    const cached =
      (backup.content_hash ? blobStorage.getCachedContentByHash(backup.content_hash) : null) ||
      blobStorage.getCachedContentByUrl(backup.blob_url);

    if (cached) {
      const etag = `"${backup.content_hash || 'cached'}"`;
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader('Content-Type', cached.contentType || fallbackContentType);
      res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      res.setHeader('X-Blob-Cache', 'HIT');
      res.status(200).send(cached.rawContent);
      return;
    }

    // Handle embedded data: URI snapshots directly without redirecting
    if (backup.blob_url.startsWith('data:')) {
      const commaIndex = backup.blob_url.indexOf(',');
      if (commaIndex !== -1) {
        const base64Data = backup.blob_url.slice(commaIndex + 1);
        const decodedContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        res.setHeader('Content-Type', fallbackContentType);
        res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
        res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        res.setHeader('X-Blob-Cache', 'DATA-URI');
        res.status(200).send(decodedContent);
        return;
      }
    }

    // Fetch remote Vercel Blob URL server-side if present
    if (backup.blob_url.startsWith('http://') || backup.blob_url.startsWith('https://')) {
      try {
        const upstream = await fetch(backup.blob_url);
        if (upstream.ok) {
          const text = await upstream.text();
          res.setHeader('Content-Type', fallbackContentType);
          res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
          res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
          res.setHeader('X-Blob-Cache', 'UPSTREAM-OK');
          res.status(200).send(text);
          return;
        }
      } catch (upstreamErr) {
        console.warn('Upstream blob fetch failed, regenerating snapshot fallback:', upstreamErr);
      }
    }

    // Fallback: regenerate current user export payload so download never 404s
    const user = await db.getUserById(userId);
    const tasks = await db.getAllTasksByUserId(userId);
    const completions = await db.getTaskCompletionsByUserId(userId);
    const xpTransactions = await db.getXPTransactionsByUserId(userId);
    const restDays = await db.getRestDays(userId);
    const rewards = await db.getRewards(userId);
    const dailyReviews = await db.getAllDailyReviews(userId);
    const totalXP = await db.getTotalXP(userId);
    const startDateStr = user?.program_start_date || formatLocalDateStr();

    const fallbackPayload: ExportDataPayload = {
      version: '1.0',
      exported_at: backup.created_at || new Date().toISOString(),
      program: {
        duration_days: PROGRAM_DURATION_DAYS,
        daily_target: DAILY_TARGET_TASKS,
        total_target: TOTAL_TARGET_TASKS,
        xp_per_task: 10,
        min_task_minutes: 2,
        max_task_minutes: 15,
        start_date: startDateStr,
      },
      tasks,
      completions,
      xpTransactions,
      restDays,
      rewards,
      dailyReviews,
      stats: {
        totalXP,
        level: getLevelProgress(totalXP).level,
        totalCompletedMicrotasks: completions.length,
      },
    };

    res.setHeader('Content-Type', fallbackContentType);
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('X-Blob-Cache', 'REGENERATED');
    res.status(200).send(JSON.stringify(fallbackPayload, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to download backup snapshot' });
  }
});

// IMPORT USER DATA (JSON)
app.post('/api/user/import-data', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const payload = req.body.payload as Partial<ExportDataPayload>;

    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.tasks)) {
      res.status(400).json({
        error: 'Invalid JSON backup file. Expected an object containing a "tasks" array.',
      });
      return;
    }

    const result = await db.importUserData(userId, payload);
    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Import data error:', err);
    res.status(500).json({ error: 'Failed to import JSON backup data' });
  }
});

// RESET 100-DAY PROGRAM (Requires explicit confirmation)
app.post('/api/user/reset-program', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { confirmation, program_start_date } = req.body;

    if (confirmation !== 'RESET') {
      res.status(400).json({
        error: 'Explicit confirmation ("RESET") is required before resetting historical program data.',
      });
      return;
    }

    const newStartDateStr = program_start_date || formatLocalDateStr();
    const result = await db.resetUserProgram(userId, newStartDateStr, SEED_MICROTASKS_DAY_1);

    res.json({
      success: true,
      program_start_date: newStartDateStr,
      ...result,
    });
  } catch (err: any) {
    console.error('Reset program error:', err);
    res.status(500).json({ error: 'Failed to reset 100-day program' });
  }
});

app.get('/api/blob/backups', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const backups = await db.getUserBackups(req.userId!);
    res.json({
      backups,
      blobConfigured: blobStorage.isConfigured(),
      cacheStats: blobStorage.getCacheStats(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user backups' });
  }
});

// SYSTEM STATUS
app.get('/api/system/status', (req: Request, res: Response) => {
  res.json({
    postgresConnected: db.isPgConnected(),
    blobConfigured: blobStorage.isConfigured(),
    blobCacheStats: blobStorage.getCacheStats(),
    geminiConfigured: !!geminiApiKey,
    nodeEnv: process.env.NODE_ENV || 'development',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const fsPromises = await import('fs/promises');
        let template = await fsPromises.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`QuestHabit 100-Day Microtask Server listening on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
