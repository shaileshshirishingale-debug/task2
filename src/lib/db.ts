import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  User,
  Task,
  TaskCompletion,
  XPTransaction,
  UserStreak,
  RestDayRecord,
  RewardItem,
  DailyReview,
  UserBackup,
  ExportDataPayload,
} from './types.ts';
import { deduplicateAndCalculateAuthoritativeXP, formatLocalDateStr, getDateForProgramDay } from './program.ts';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
let pool: pg.Pool | null = null;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

const DEV_DB_FILE = process.env.VERCEL
  ? path.resolve('/tmp', '.dev_db.json')
  : path.resolve(process.cwd(), '.dev_db.json');

interface DevStore {
  users: Record<string, User & { password_hash: string }>;
  tasks: Record<string, Task>;
  task_completions: Record<string, TaskCompletion>;
  xp_transactions: Record<string, XPTransaction>;
  streaks: Record<string, UserStreak>;
  rest_days: Record<string, RestDayRecord>;
  reward_items: Record<string, RewardItem>;
  daily_reviews: Record<string, DailyReview>;
  user_backups: Record<string, UserBackup>;
  initialized_days: Record<string, boolean>;
}

const pgInitializedDays = new Set<string>();

function loadDevStore(): DevStore {
  try {
    if (fs.existsSync(DEV_DB_FILE)) {
      const content = fs.readFileSync(DEV_DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        users: parsed.users || {},
        tasks: parsed.tasks || {},
        task_completions: parsed.task_completions || {},
        xp_transactions: parsed.xp_transactions || {},
        streaks: parsed.streaks || {},
        rest_days: parsed.rest_days || {},
        reward_items: parsed.reward_items || {},
        daily_reviews: parsed.daily_reviews || {},
        user_backups: parsed.user_backups || {},
        initialized_days: parsed.initialized_days || {},
      };
    }
  } catch (err) {
    console.warn('Failed to read dev store file:', err);
  }
  return {
    users: {},
    tasks: {},
    task_completions: {},
    xp_transactions: {},
    streaks: {},
    rest_days: {},
    reward_items: {},
    daily_reviews: {},
    user_backups: {},
    initialized_days: {},
  };
}

const devStore: DevStore = loadDevStore();

function saveDevStore() {
  try {
    fs.writeFileSync(DEV_DB_FILE, JSON.stringify(devStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to write dev store file:', err);
  }
}

export const db = {
  isPgConnected(): boolean {
    return !!pool;
  },

  // USER CRUD & SETTINGS
  async createUser(user: User & { password_hash: string }): Promise<User> {
    if (pool) {
      const res = await pool.query(
        `INSERT INTO users (id, email, username, password_hash, avatar_url, program_start_date, sound_enabled, haptics_enabled, daily_minimum_mode, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, email, username, avatar_url, program_start_date, sound_enabled, haptics_enabled, daily_minimum_mode, created_at`,
        [
          user.id,
          user.email,
          user.username,
          user.password_hash,
          user.avatar_url || null,
          user.program_start_date,
          user.sound_enabled || false,
          user.haptics_enabled || false,
          user.daily_minimum_mode || false,
          user.created_at,
        ]
      );
      return res.rows[0];
    } else {
      devStore.users[user.id] = user;
      saveDevStore();
      const { password_hash, ...publicUser } = user;
      return publicUser;
    }
  },

  async getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
      return res.rows[0] || null;
    } else {
      const found = Object.values(devStore.users).find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      return found || null;
    }
  },

  async getUserById(id: string): Promise<User | null> {
    if (pool) {
      const res = await pool.query(
        `SELECT id, email, username, avatar_url, program_start_date, sound_enabled, haptics_enabled, daily_minimum_mode, created_at FROM users WHERE id = $1`,
        [id]
      );
      return res.rows[0] || null;
    } else {
      const found = devStore.users[id];
      if (!found) return null;
      const { password_hash, ...publicUser } = found;
      return publicUser;
    }
  },

  async updateUserPreferences(
    userId: string,
    prefs: { sound_enabled?: boolean; haptics_enabled?: boolean; daily_minimum_mode?: boolean; program_start_date?: string }
  ): Promise<User | null> {
    const existing = await this.getUserById(userId);
    if (!existing) return null;

    const sound = prefs.sound_enabled !== undefined ? prefs.sound_enabled : existing.sound_enabled;
    const haptics = prefs.haptics_enabled !== undefined ? prefs.haptics_enabled : existing.haptics_enabled;
    const minMode = prefs.daily_minimum_mode !== undefined ? prefs.daily_minimum_mode : existing.daily_minimum_mode;
    const startDate = prefs.program_start_date !== undefined ? prefs.program_start_date : existing.program_start_date;

    if (pool) {
      const res = await pool.query(
        `UPDATE users
         SET sound_enabled = $1, haptics_enabled = $2, daily_minimum_mode = $3, program_start_date = $4
         WHERE id = $5
         RETURNING id, email, username, avatar_url, program_start_date, sound_enabled, haptics_enabled, daily_minimum_mode, created_at`,
        [sound, haptics, minMode, startDate, userId]
      );
      return res.rows[0] || null;
    } else {
      const user = devStore.users[userId];
      if (!user) return null;
      user.sound_enabled = sound;
      user.haptics_enabled = haptics;
      user.daily_minimum_mode = minMode;
      user.program_start_date = startDate;
      saveDevStore();
      const { password_hash, ...publicUser } = user;
      return publicUser;
    }
  },

  // TASKS CRUD & REORDERING (Prevents duplicate task IDs)
  async getTasksByUserId(userId: string, dayNumber?: number): Promise<Task[]> {
    if (pool) {
      let query = `SELECT * FROM tasks WHERE user_id = $1`;
      const params: any[] = [userId];
      if (dayNumber !== undefined) {
        query += ` AND day_number = $2`;
        params.push(dayNumber);
      }
      query += ` ORDER BY order_index ASC, created_at ASC`;
      const res = await pool.query(query, params);
      return res.rows;
    } else {
      return Object.values(devStore.tasks)
        .filter((t) => t.user_id === userId && (dayNumber === undefined || t.day_number === dayNumber))
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
  },

  async ensureDayTasksSeeded(
    userId: string,
    dayNumber: number,
    seedTemplates: Omit<Task, 'id' | 'user_id' | 'created_at'>[]
  ): Promise<Task[]> {
    const clampedDay = Math.min(100, Math.max(1, dayNumber));
    const existing = await this.getTasksByUserId(userId, clampedDay);
    const key = `${userId}_${clampedDay}`;

    if (existing.length > 0) {
      if (pool) {
        pgInitializedDays.add(key);
      } else if (!devStore.initialized_days[key]) {
        devStore.initialized_days[key] = true;
        saveDevStore();
      }
      return existing;
    }

    const isInitialized = pool ? pgInitializedDays.has(key) : Boolean(devStore.initialized_days[key]);
    if (isInitialized) {
      return existing;
    }

    if (pool) {
      pgInitializedDays.add(key);
    } else {
      devStore.initialized_days[key] = true;
    }

    const createdAt = new Date().toISOString();
    const seeded: Task[] = [];
    for (const template of seedTemplates) {
      const created = await this.createTask({
        id: `task_${crypto.randomBytes(8).toString('hex')}`,
        user_id: userId,
        ...template,
        day_number: clampedDay,
        completed: false,
        completed_at: undefined,
        created_at: createdAt,
      });
      seeded.push(created);
    }
    return seeded;
  },

  async getAllTasksByUserId(userId: string): Promise<Task[]> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM tasks WHERE user_id = $1 ORDER BY day_number ASC, order_index ASC`, [userId]);
      return res.rows;
    } else {
      return Object.values(devStore.tasks)
        .filter((t) => t.user_id === userId)
        .sort((a, b) => a.day_number - b.day_number || (a.order_index ?? 0) - (b.order_index ?? 0));
    }
  },

  async createTask(task: Task): Promise<Task> {
    if (pool) {
      const existing = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [task.id]);
      if (existing.rows.length > 0) {
        return existing.rows[0];
      }
      const res = await pool.query(
        `INSERT INTO tasks (id, user_id, day_number, title, description, category, difficulty, xp_reward, estimated_minutes, order_index, completed, completed_at, original_title, is_low_energy_replacement, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [
          task.id,
          task.user_id,
          task.day_number,
          task.title,
          task.description || null,
          task.category,
          task.difficulty,
          10, // Always 10 XP
          task.estimated_minutes || 5,
          task.order_index || 0,
          task.completed,
          task.completed_at || null,
          task.original_title || null,
          task.is_low_energy_replacement || false,
          task.created_at,
        ]
      );
      return res.rows[0] || task;
    } else {
      if (devStore.tasks[task.id]) {
        return devStore.tasks[task.id];
      }
      devStore.tasks[task.id] = { ...task, xp_reward: 10 };
      saveDevStore();
      return devStore.tasks[task.id];
    }
  },

  async updateTask(task: Task): Promise<Task> {
    if (pool) {
      const res = await pool.query(
        `UPDATE tasks
         SET title = $1, description = $2, category = $3, difficulty = $4, xp_reward = $5,
             estimated_minutes = $6, order_index = $7, completed = $8, completed_at = $9,
             original_title = $10, is_low_energy_replacement = $11
         WHERE id = $12 AND user_id = $13
         RETURNING *`,
        [
          task.title,
          task.description || null,
          task.category,
          task.difficulty,
          10, // Always 10 XP
          task.estimated_minutes,
          task.order_index,
          task.completed,
          task.completed_at || null,
          task.original_title || null,
          task.is_low_energy_replacement || false,
          task.id,
          task.user_id,
        ]
      );
      return res.rows[0];
    } else {
      devStore.tasks[task.id] = { ...task, xp_reward: 10 };
      saveDevStore();
      return devStore.tasks[task.id];
    }
  },

  async reorderTasks(userId: string, taskOrders: { id: string; order_index: number }[]): Promise<boolean> {
    if (pool) {
      for (const item of taskOrders) {
        await pool.query(`UPDATE tasks SET order_index = $1 WHERE id = $2 AND user_id = $3`, [item.order_index, item.id, userId]);
      }
      return true;
    } else {
      taskOrders.forEach((item) => {
        if (devStore.tasks[item.id] && devStore.tasks[item.id].user_id === userId) {
          devStore.tasks[item.id].order_index = item.order_index;
        }
      });
      saveDevStore();
      return true;
    }
  },

  async deleteTask(taskId: string, userId: string): Promise<boolean> {
    if (pool) {
      await pool.query(`DELETE FROM task_completions WHERE task_id = $1 AND user_id = $2`, [taskId, userId]);
      await pool.query(`DELETE FROM xp_transactions WHERE task_id = $1 AND user_id = $2`, [taskId, userId]);
      const res = await pool.query(`DELETE FROM tasks WHERE id = $1 AND user_id = $2`, [taskId, userId]);
      return (res.rowCount || 0) > 0;
    } else {
      const existing = devStore.tasks[taskId];
      if (existing && existing.user_id === userId) {
        delete devStore.tasks[taskId];
        Object.keys(devStore.task_completions).forEach((k) => {
          if (devStore.task_completions[k].task_id === taskId && devStore.task_completions[k].user_id === userId) {
            delete devStore.task_completions[k];
          }
        });
        Object.keys(devStore.xp_transactions).forEach((k) => {
          if (devStore.xp_transactions[k].task_id === taskId && devStore.xp_transactions[k].user_id === userId) {
            delete devStore.xp_transactions[k];
          }
        });
        saveDevStore();
        return true;
      }
      return false;
    }
  },

  async getTaskById(taskId: string): Promise<Task | null> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [taskId]);
      return res.rows[0] || null;
    } else {
      return devStore.tasks[taskId] || null;
    }
  },

  // COMPLETION & UNCOMPLETION (Idempotent 10 XP award / reversal)
  async getCompletionForTask(taskId: string): Promise<TaskCompletion | null> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM task_completions WHERE task_id = $1`, [taskId]);
      return res.rows[0] || null;
    } else {
      const found = Object.values(devStore.task_completions).find((c) => c.task_id === taskId);
      return found || null;
    }
  },

  async recordTaskCompletion(completion: TaskCompletion): Promise<TaskCompletion> {
    const existing = await this.getCompletionForTask(completion.task_id);
    if (existing) {
      return existing;
    }

    if (pool) {
      const res = await pool.query(
        `INSERT INTO task_completions (id, task_id, user_id, day_number, completed_date, xp_awarded, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (task_id, completed_date) DO NOTHING
         RETURNING *`,
        [
          completion.id,
          completion.task_id,
          completion.user_id,
          completion.day_number,
          completion.completed_date,
          10, // Fixed 10 XP
          completion.created_at,
        ]
      );
      return res.rows[0] || completion;
    } else {
      const deterministicKey = `comp_${completion.user_id}_${completion.task_id}`;
      devStore.task_completions[deterministicKey] = {
        ...completion,
        id: deterministicKey,
        xp_awarded: 10,
      };
      saveDevStore();
      return devStore.task_completions[deterministicKey];
    }
  },

  async removeTaskCompletion(taskId: string, userId: string): Promise<boolean> {
    if (pool) {
      await pool.query(`DELETE FROM task_completions WHERE task_id = $1 AND user_id = $2`, [taskId, userId]);
      await pool.query(`DELETE FROM xp_transactions WHERE task_id = $1 AND user_id = $2`, [taskId, userId]);
      return true;
    } else {
      const compKeys = Object.keys(devStore.task_completions).filter(
        (k) => devStore.task_completions[k].task_id === taskId && devStore.task_completions[k].user_id === userId
      );
      compKeys.forEach((k) => delete devStore.task_completions[k]);

      const xpKeys = Object.keys(devStore.xp_transactions).filter(
        (k) => devStore.xp_transactions[k].task_id === taskId && devStore.xp_transactions[k].user_id === userId
      );
      xpKeys.forEach((k) => delete devStore.xp_transactions[k]);

      saveDevStore();
      return true;
    }
  },

  async getTaskCompletionsByUserId(userId: string): Promise<TaskCompletion[]> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM task_completions WHERE user_id = $1 ORDER BY created_at ASC`, [userId]);
      const seen = new Set<string>();
      return res.rows.filter((c: TaskCompletion) => {
        if (seen.has(c.task_id)) return false;
        seen.add(c.task_id);
        return true;
      });
    } else {
      const seen = new Set<string>();
      return Object.values(devStore.task_completions)
        .filter((c) => c.user_id === userId)
        .filter((c) => {
          if (seen.has(c.task_id)) return false;
          seen.add(c.task_id);
          return true;
        });
    }
  },

  // XP TRANSACTIONS & SINGLE AUTHORITATIVE TOTAL XP
  async recordXPTransaction(tx: XPTransaction): Promise<XPTransaction> {
    if (tx.task_id) {
      if (pool) {
        const existing = await pool.query(
          `SELECT * FROM xp_transactions WHERE user_id = $1 AND task_id = $2`,
          [tx.user_id, tx.task_id]
        );
        if (existing.rows.length > 0) {
          return existing.rows[0];
        }
      } else {
        const existing = Object.values(devStore.xp_transactions).find(
          (item) => item.user_id === tx.user_id && item.task_id === tx.task_id
        );
        if (existing) {
          return existing;
        }
      }
    }

    if (pool) {
      const res = await pool.query(
        `INSERT INTO xp_transactions (id, user_id, task_id, amount, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tx.id, tx.user_id, tx.task_id || null, tx.amount, tx.reason, tx.created_at]
      );
      return res.rows[0];
    } else {
      devStore.xp_transactions[tx.id] = tx;
      saveDevStore();
      return tx;
    }
  },

  async getXPTransactionsByUserId(userId: string): Promise<XPTransaction[]> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM xp_transactions WHERE user_id = $1 ORDER BY created_at ASC`, [userId]);
      return res.rows;
    } else {
      return Object.values(devStore.xp_transactions).filter((tx) => tx.user_id === userId);
    }
  },

  /**
   * Authoritative Total XP calculation:
   * Uses deduplicated task completions (10 XP per unique completed task) as the single authoritative source
   * so duplicate XP awards or out-of-sync state can never occur.
   */
  async getTotalXP(userId: string): Promise<number> {
    const completions = await this.getTaskCompletionsByUserId(userId);
    return completions.length * 10;
  },

  // REST DAYS & PAUSED DAYS
  async getRestDays(userId: string): Promise<number[]> {
    if (pool) {
      const res = await pool.query(`SELECT day_number FROM rest_days WHERE user_id = $1 ORDER BY day_number ASC`, [userId]);
      return res.rows.map((r) => r.day_number);
    } else {
      return Object.values(devStore.rest_days)
        .filter((r) => r.user_id === userId)
        .map((r) => r.day_number)
        .sort((a, b) => a - b);
    }
  },

  async toggleRestDay(userId: string, dayNumber: number, dateStr: string, reason?: string): Promise<{ isRestDay: boolean }> {
    if (pool) {
      const existing = await pool.query(`SELECT * FROM rest_days WHERE user_id = $1 AND day_number = $2`, [userId, dayNumber]);
      if (existing.rows.length > 0) {
        await pool.query(`DELETE FROM rest_days WHERE user_id = $1 AND day_number = $2`, [userId, dayNumber]);
        return { isRestDay: false };
      } else {
        const id = `rest_${userId}_${dayNumber}`;
        await pool.query(
          `INSERT INTO rest_days (id, user_id, day_number, date, reason, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, userId, dayNumber, dateStr, reason || 'Rest / recharge day', new Date().toISOString()]
        );
        return { isRestDay: true };
      }
    } else {
      const key = `${userId}_${dayNumber}`;
      if (devStore.rest_days[key]) {
        delete devStore.rest_days[key];
        saveDevStore();
        return { isRestDay: false };
      } else {
        devStore.rest_days[key] = {
          id: key,
          user_id: userId,
          day_number: dayNumber,
          date: dateStr,
          reason: reason || 'Rest / recharge day',
          created_at: new Date().toISOString(),
        };
        saveDevStore();
        return { isRestDay: true };
      }
    }
  },

  // REWARD MENU & REWARDS
  async getRewards(userId: string): Promise<RewardItem[]> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM reward_items WHERE user_id = $1 ORDER BY target_count ASC, created_at ASC`, [userId]);
      return res.rows;
    } else {
      return Object.values(devStore.reward_items)
        .filter((r) => r.user_id === userId)
        .sort((a, b) => a.target_count - b.target_count);
    }
  },

  async createReward(reward: RewardItem): Promise<RewardItem> {
    if (pool) {
      const res = await pool.query(
        `INSERT INTO reward_items (id, user_id, title, description, unlock_type, target_count, category, is_claimed, claimed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [
          reward.id,
          reward.user_id,
          reward.title,
          reward.description || null,
          reward.unlock_type,
          reward.target_count,
          reward.category,
          reward.is_claimed,
          reward.claimed_at || null,
          reward.created_at,
        ]
      );
      return res.rows[0] || reward;
    } else {
      devStore.reward_items[reward.id] = reward;
      saveDevStore();
      return reward;
    }
  },

  async toggleRewardClaim(userId: string, rewardId: string): Promise<RewardItem | null> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM reward_items WHERE id = $1 AND user_id = $2`, [rewardId, userId]);
      if (res.rows.length === 0) return null;
      const current = res.rows[0];
      const newClaimed = !current.is_claimed;
      const claimedAt = newClaimed ? new Date().toISOString() : null;

      const updateRes = await pool.query(
        `UPDATE reward_items SET is_claimed = $1, claimed_at = $2 WHERE id = $3 AND user_id = $4 RETURNING *`,
        [newClaimed, claimedAt, rewardId, userId]
      );
      return updateRes.rows[0];
    } else {
      const current = devStore.reward_items[rewardId];
      if (!current || current.user_id !== userId) return null;
      current.is_claimed = !current.is_claimed;
      current.claimed_at = current.is_claimed ? new Date().toISOString() : undefined;
      saveDevStore();
      return current;
    }
  },

  // DAILY REVIEW (PRIVATE JOURNAL ENTRIES)
  async getDailyReview(userId: string, dayNumber: number): Promise<DailyReview | null> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM daily_reviews WHERE user_id = $1 AND day_number = $2`, [userId, dayNumber]);
      return res.rows[0] || null;
    } else {
      const key = `${userId}_${dayNumber}`;
      return devStore.daily_reviews[key] || null;
    }
  },

  async getAllDailyReviews(userId: string): Promise<DailyReview[]> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM daily_reviews WHERE user_id = $1 ORDER BY day_number ASC`, [userId]);
      return res.rows;
    } else {
      return Object.values(devStore.daily_reviews)
        .filter((r) => r.user_id === userId)
        .sort((a, b) => a.day_number - b.day_number);
    }
  },

  async saveDailyReview(review: DailyReview): Promise<DailyReview> {
    if (pool) {
      const res = await pool.query(
        `INSERT INTO daily_reviews (id, user_id, day_number, date, what_went_well, what_learned, what_distracted, improvement_tomorrow, energy_level, mood_level, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id, day_number) DO UPDATE
         SET what_went_well = EXCLUDED.what_went_well,
             what_learned = EXCLUDED.what_learned,
             what_distracted = EXCLUDED.what_distracted,
             improvement_tomorrow = EXCLUDED.improvement_tomorrow,
             energy_level = EXCLUDED.energy_level,
             mood_level = EXCLUDED.mood_level
         RETURNING *`,
        [
          review.id,
          review.user_id,
          review.day_number,
          review.date,
          review.what_went_well,
          review.what_learned,
          review.what_distracted,
          review.improvement_tomorrow,
          review.energy_level,
          review.mood_level,
          review.created_at,
        ]
      );
      return res.rows[0];
    } else {
      const key = `${review.user_id}_${review.day_number}`;
      devStore.daily_reviews[key] = review;
      saveDevStore();
      return review;
    }
  },

  // RESET PROGRAM (Only called after explicit confirmation)
  async resetUserProgram(
    userId: string,
    newStartDateStr: string,
    seedTasks: Omit<Task, 'id' | 'user_id' | 'created_at'>[]
  ): Promise<{ reset: boolean; tasksSeeded: number }> {
    const createdAt = new Date().toISOString();

    if (pool) {
      await pool.query(`DELETE FROM xp_transactions WHERE user_id = $1`, [userId]);
      await pool.query(`DELETE FROM task_completions WHERE user_id = $1`, [userId]);
      await pool.query(`DELETE FROM tasks WHERE user_id = $1`, [userId]);
      await pool.query(`DELETE FROM rest_days WHERE user_id = $1`, [userId]);
      await pool.query(`DELETE FROM daily_reviews WHERE user_id = $1`, [userId]);
      await pool.query(`UPDATE reward_items SET is_claimed = false, claimed_at = null WHERE user_id = $1`, [userId]);
      await pool.query(`UPDATE users SET program_start_date = $1 WHERE id = $2`, [newStartDateStr, userId]);
    } else {
      Object.keys(devStore.xp_transactions).forEach((k) => {
        if (devStore.xp_transactions[k].user_id === userId) delete devStore.xp_transactions[k];
      });
      Object.keys(devStore.task_completions).forEach((k) => {
        if (devStore.task_completions[k].user_id === userId) delete devStore.task_completions[k];
      });
      Object.keys(devStore.tasks).forEach((k) => {
        if (devStore.tasks[k].user_id === userId) delete devStore.tasks[k];
      });
      Object.keys(devStore.rest_days).forEach((k) => {
        if (devStore.rest_days[k].user_id === userId) delete devStore.rest_days[k];
      });
      Object.keys(devStore.daily_reviews).forEach((k) => {
        if (devStore.daily_reviews[k].user_id === userId) delete devStore.daily_reviews[k];
      });
      Object.keys(devStore.reward_items).forEach((k) => {
        if (devStore.reward_items[k].user_id === userId) {
          devStore.reward_items[k].is_claimed = false;
          devStore.reward_items[k].claimed_at = undefined;
        }
      });
      if (devStore.users[userId]) {
        devStore.users[userId].program_start_date = newStartDateStr;
      }
      Object.keys(devStore.initialized_days).forEach((k) => {
        if (k.startsWith(`${userId}_`)) delete devStore.initialized_days[k];
      });
      saveDevStore();
    }

    Array.from(pgInitializedDays).forEach((k) => {
      if (k.startsWith(`${userId}_`)) pgInitializedDays.delete(k);
    });

    if (pool) {
      pgInitializedDays.add(`${userId}_1`);
    } else {
      devStore.initialized_days[`${userId}_1`] = true;
    }

    for (const seed of seedTasks) {
      await this.createTask({
        id: `task_${crypto.randomBytes(8).toString('hex')}`,
        user_id: userId,
        ...seed,
        created_at: createdAt,
      });
    }

    return { reset: true, tasksSeeded: seedTasks.length };
  },

  // IMPORT USER DATA (Idempotent, prevents duplicate task IDs and duplicate XP awards)
  async importUserData(
    userId: string,
    payload: Partial<ExportDataPayload>
  ): Promise<{
    importedTasks: number;
    importedCompletions: number;
    totalXP: number;
  }> {
    const rawTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const rawCompletions = Array.isArray(payload.completions) ? payload.completions : [];
    const { uniqueTasks, uniqueCompletions } = deduplicateAndCalculateAuthoritativeXP(rawTasks, rawCompletions);

    if (payload.program?.start_date) {
      await this.updateUserPreferences(userId, { program_start_date: payload.program.start_date });
    } else if (payload.user?.program_start_date) {
      await this.updateUserPreferences(userId, { program_start_date: payload.user.program_start_date });
    }

    const user = await this.getUserById(userId);
    const startDateStr = user?.program_start_date || formatLocalDateStr();

    // Map imported task IDs scoped to this user while preventing duplicates
    let importedTasksCount = 0;
    const completedTaskIdSet = new Set(uniqueCompletions.map((c) => c.task_id));

    // For days included in the imported backup, remove any existing tasks on those days that are not part of the import
    const importedDaysSet = new Set<number>();
    const importedScopedTaskIds = new Set<string>();
    for (const t of uniqueTasks) {
      const dayNum = Math.min(100, Math.max(1, Number(t.day_number) || 1));
      const scopedId = t.user_id === userId ? t.id : `${t.id}_${userId.slice(-6)}`;
      importedDaysSet.add(dayNum);
      importedScopedTaskIds.add(scopedId);
    }

    for (const dayNum of importedDaysSet) {
      const existingDayTasks = await this.getTasksByUserId(userId, dayNum);
      for (const existingTask of existingDayTasks) {
        if (!importedScopedTaskIds.has(existingTask.id)) {
          await this.deleteTask(existingTask.id, userId);
        }
      }
      if (pool) {
        pgInitializedDays.add(`${userId}_${dayNum}`);
      } else {
        devStore.initialized_days[`${userId}_${dayNum}`] = true;
      }
    }

    for (const t of uniqueTasks) {
      const scopedTaskId = t.user_id === userId ? t.id : `${t.id}_${userId.slice(-6)}`;
      const isCompleted = Boolean(t.completed || completedTaskIdSet.has(t.id));
      const existing = await this.getTaskById(scopedTaskId);

      const taskObj: Task = {
        id: scopedTaskId,
        user_id: userId,
        day_number: Math.min(100, Math.max(1, Number(t.day_number) || 1)),
        title: String(t.title || 'Imported Microtask').slice(0, 140),
        description: t.description ? String(t.description).slice(0, 500) : '',
        category: t.category || 'Productivity',
        difficulty: t.difficulty || 'Easy',
        xp_reward: 10,
        estimated_minutes: Math.min(15, Math.max(2, Number(t.estimated_minutes) || 5)),
        order_index: Number(t.order_index) || 0,
        completed: isCompleted,
        completed_at: isCompleted ? t.completed_at || new Date().toISOString() : undefined,
        original_title: t.original_title,
        is_low_energy_replacement: Boolean(t.is_low_energy_replacement),
        created_at: t.created_at || new Date().toISOString(),
      };

      if (existing && existing.user_id === userId) {
        await this.updateTask(taskObj);
      } else {
        await this.createTask(taskObj);
      }
      importedTasksCount++;

      if (isCompleted) {
        const compDate = getDateForProgramDay(startDateStr, taskObj.day_number);
        await this.recordTaskCompletion({
          id: `comp_${userId}_${scopedTaskId}`,
          task_id: scopedTaskId,
          user_id: userId,
          day_number: taskObj.day_number,
          completed_date: compDate,
          xp_awarded: 10,
          created_at: taskObj.completed_at || new Date().toISOString(),
        });
        await this.recordXPTransaction({
          id: `xp_${scopedTaskId}`,
          user_id: userId,
          task_id: scopedTaskId,
          amount: 10,
          reason: `Completed Day ${taskObj.day_number} microtask: ${taskObj.title}`,
          created_at: taskObj.completed_at || new Date().toISOString(),
        });
      } else {
        await this.removeTaskCompletion(scopedTaskId, userId);
      }
    }

    // Restore rest days
    if (Array.isArray(payload.restDays)) {
      const currentRestDays = await this.getRestDays(userId);
      for (const dayNum of payload.restDays) {
        const validDay = Math.min(100, Math.max(1, Number(dayNum)));
        if (!currentRestDays.includes(validDay)) {
          const dateStr = getDateForProgramDay(startDateStr, validDay);
          await this.toggleRestDay(userId, validDay, dateStr, 'Restored from backup');
        }
      }
    }

    // Restore daily reviews
    if (Array.isArray(payload.dailyReviews)) {
      for (const rev of payload.dailyReviews) {
        if (rev && rev.day_number) {
          const validDay = Math.min(100, Math.max(1, Number(rev.day_number)));
          await this.saveDailyReview({
            id: `rev_${userId}_${validDay}`,
            user_id: userId,
            day_number: validDay,
            date: rev.date || getDateForProgramDay(startDateStr, validDay),
            what_went_well: String(rev.what_went_well || ''),
            what_learned: String(rev.what_learned || ''),
            what_distracted: String(rev.what_distracted || ''),
            improvement_tomorrow: String(rev.improvement_tomorrow || ''),
            energy_level: Math.min(5, Math.max(1, Number(rev.energy_level) || 3)),
            mood_level: Math.min(5, Math.max(1, Number(rev.mood_level) || 3)),
            created_at: rev.created_at || new Date().toISOString(),
          });
        }
      }
    }

    const allCompletions = await this.getTaskCompletionsByUserId(userId);
    const totalXP = await this.getTotalXP(userId);

    return {
      importedTasks: importedTasksCount,
      importedCompletions: allCompletions.length,
      totalXP,
    };
  },

  // USER BACKUPS
  async saveUserBackup(backup: UserBackup): Promise<UserBackup> {
    if (pool) {
      const res = await pool.query(
        `INSERT INTO user_backups (id, user_id, blob_url, filename, file_type, file_size, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          backup.id,
          backup.user_id,
          backup.blob_url,
          backup.filename,
          backup.file_type,
          backup.file_size,
          backup.created_at,
        ]
      );
      return res.rows[0];
    } else {
      devStore.user_backups[backup.id] = backup;
      saveDevStore();
      return backup;
    }
  },

  async getUserBackups(userId: string): Promise<UserBackup[]> {
    if (pool) {
      const res = await pool.query(`SELECT * FROM user_backups WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
      return res.rows;
    } else {
      return Object.values(devStore.user_backups)
        .filter((b) => b.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },
};
