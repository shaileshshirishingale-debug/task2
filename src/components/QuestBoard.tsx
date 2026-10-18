import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Sparkles,
  Clock,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Target,
  Trophy,
  Layers,
  Zap,
  Feather,
  Coffee,
  BookOpen,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Task, Category, Difficulty, UserProfileStats } from '../lib/types.ts';
import { formatTaskDuration } from '../lib/program.ts';
import { DayNavigator } from './DayNavigator.tsx';
import { playGentleSuccessSound, triggerGentleHaptic } from '../utils/audioFeedback.ts';

interface QuestBoardProps {
  tasks: Task[];
  stats: UserProfileStats | null;
  token: string | null;
  selectedDay: number;
  currentProgramDay: number;
  startDateStr: string;
  onSelectDay: (day: number) => void;
  onUpdateStartDate: (newDateStr: string) => void;
  onRefreshTasks: () => void;
  onRefreshStats: () => void;
  onOpenAuth: () => void;
  onOpenJustStart: () => void;
  onOpenDailyReview: () => void;
  onTriggerMilestone: (title: string) => void;
}

const CATEGORIES: Category[] = ['Health', 'Productivity', 'Mindfulness', 'Learning', 'Fitness'];

export const QuestBoard: React.FC<QuestBoardProps> = ({
  tasks,
  stats,
  token,
  selectedDay,
  currentProgramDay,
  startDateStr,
  onSelectDay,
  onUpdateStartDate,
  onRefreshTasks,
  onRefreshStats,
  onOpenAuth,
  onOpenJustStart,
  onOpenDailyReview,
  onTriggerMilestone,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // New / Edit Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Productivity');
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(5);

  // Instant Dopamine-Supportive Feedback State
  const [feedbackBanner, setFeedbackBanner] = useState<{ taskId: string; message: string; xp: number } | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Daily Minimum Mode (3-task anchor for tough days without changing 10-task target)
  const [dailyMinimumMode, setDailyMinimumMode] = useState(false);

  const filteredTasks = tasks.filter(
    (t) => selectedCategory === 'All' || t.category === selectedCategory
  );

  const dailyCompletedCount = tasks.filter((t) => t.completed).length;
  const dailyCompletionPct = Math.min(100, Math.round((dailyCompletedCount / 10) * 100));
  const totalMinutesEstimated = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 5), 0);
  const isRestDay = (stats?.rest_days || []).includes(selectedDay);

  const soundEnabled = stats?.user?.sound_enabled || false;
  const hapticsEnabled = stats?.user?.haptics_enabled || false;

  const handleToggleSoundPreference = async () => {
    if (!token) return;
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sound_enabled: !soundEnabled,
          haptics_enabled: !hapticsEnabled,
        }),
      });
      onRefreshStats();
    } catch (err) {
      console.error('Failed to update audio preference:', err);
    }
  };

  const handleToggleRestDay = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/days/${selectedDay}/toggle-rest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        onRefreshStats();
      }
    } catch (err) {
      console.error('Failed to toggle rest day:', err);
    }
  };

  const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      onOpenAuth();
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Please enter a microtask title.');
      return;
    }
    if (trimmedTitle.length > 140) {
      setFormError('Microtask title must be 140 characters or fewer.');
      return;
    }
    if (estimatedMinutes < 2 || estimatedMinutes > 15) {
      setFormError('Estimated duration must be between 2 and 15 minutes.');
      return;
    }
    setFormError(null);

    try {
      if (editingTask) {
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: trimmedTitle,
            description: description.trim(),
            category,
            difficulty,
            estimated_minutes: estimatedMinutes,
          }),
        });

        if (res.ok) {
          setEditingTask(null);
          resetForm();
          onRefreshTasks();
        } else {
          const data = await res.json();
          setFormError(data.error || 'Failed to update microtask.');
        }
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: trimmedTitle,
            description: description.trim(),
            category,
            difficulty,
            day_number: selectedDay,
            estimated_minutes: estimatedMinutes,
          }),
        });

        if (res.ok) {
          resetForm();
          setShowNewTaskForm(false);
          onRefreshTasks();
        } else {
          const data = await res.json();
          setFormError(data.error || 'Failed to create microtask.');
        }
      }
    } catch (err) {
      setFormError('Network error while saving microtask. Please try again.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('Productivity');
    setDifficulty('Easy');
    setEstimatedMinutes(5);
  };

  const startEditTask = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setCategory(task.category);
    setDifficulty(task.difficulty);
    setEstimatedMinutes(task.estimated_minutes || 5);
  };

  const handleToggleCompletion = async (task: Task) => {
    if (!token) {
      onOpenAuth();
      return;
    }

    setCompletingTaskId(task.id);
    const endpoint = task.completed ? `/api/tasks/${task.id}/uncomplete` : `/api/tasks/${task.id}/complete`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        if (!task.completed && !data.alreadyCompleted) {
          playGentleSuccessSound(soundEnabled);
          triggerGentleHaptic(hapticsEnabled);

          setFeedbackBanner({
            taskId: task.id,
            message: data.encouragingMessage || 'One small win. Keep moving.',
            xp: 10,
          });
          setTimeout(() => setFeedbackBanner(null), 4000);

          if (data.milestoneCelebration) {
            onTriggerMilestone(data.milestoneCelebration);
          }
        } else if (task.completed) {
          setFeedbackBanner({
            taskId: task.id,
            message: 'Task marked pending (-10 XP reversed per reversal policy).',
            xp: -10,
          });
          setTimeout(() => setFeedbackBanner(null), 3500);
        }
        onRefreshTasks();
        onRefreshStats();
      }
    } catch (err) {
      console.error('Failed to toggle completion:', err);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleLowEnergyReplace = async (task: Task) => {
    if (!token) return;
    try {
      const easierTitle = `Gentle: 3m Light ${task.title.replace(/^Gentle: /, '')}`;
      const res = await fetch(`/api/tasks/${task.id}/low-energy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          easierTitle,
          easierMinutes: 3,
        }),
      });
      if (res.ok) {
        onRefreshTasks();
      }
    } catch (err) {
      console.error('Failed low-energy replacement:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onRefreshTasks();
        onRefreshStats();
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleMoveTask = async (index: number, direction: 'up' | 'down') => {
    if (!token) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    const newTasks = [...tasks];
    const temp = newTasks[index];
    newTasks[index] = newTasks[targetIndex];
    newTasks[targetIndex] = temp;

    const taskOrders = newTasks.map((t, idx) => ({ id: t.id, order_index: idx }));

    try {
      const res = await fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskOrders }),
      });

      if (res.ok) {
        onRefreshTasks();
      }
    } catch (err) {
      console.error('Failed to reorder tasks:', err);
    }
  };

  const programStats = stats?.program_stats;
  const isProgramComplete = Boolean(
    programStats?.is_program_complete ||
      programStats?.day_100_completed ||
      (selectedDay === 100 && dailyCompletedCount >= 10)
  );

  return (
    <div className="space-y-6">
      {/* Day Navigation Bar */}
      <DayNavigator
        currentProgramDay={currentProgramDay}
        selectedDay={selectedDay}
        startDateStr={startDateStr}
        onSelectDay={onSelectDay}
        onUpdateStartDate={onUpdateStartDate}
      />

      {/* 100-Day Program Complete Banner when Day 100 is completed */}
      {isProgramComplete && (
        <div
          role="status"
          className="bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border-2 border-amber-400/60 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                100-Day Program Complete
              </div>
              <div className="text-sm font-bold text-slate-100">
                Day 100 conquered! Your program is marked complete and all historical progress is preserved.
              </div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs whitespace-nowrap">
            100/100 Complete
          </span>
        </div>
      )}

      {/* Instant Encouraging Feedback / Reversal Policy Banner */}
      {feedbackBanner && (
        <div
          role="status"
          className={`border rounded-2xl p-4 shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 ${
            feedbackBanner.xp > 0
              ? 'bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-emerald-500/60'
              : 'bg-slate-900 border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-9 px-2 rounded-xl flex items-center justify-center font-black text-xs shadow-md ${
                feedbackBanner.xp > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {feedbackBanner.xp > 0 ? `+${feedbackBanner.xp} XP` : `${feedbackBanner.xp} XP`}
            </div>
            <div>
              <div className={`text-xs font-extrabold ${feedbackBanner.xp > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                {feedbackBanner.xp > 0 ? 'Microtask Completed!' : 'Completion Reversed'}
              </div>
              <div className="text-sm font-bold text-slate-100">“{feedbackBanner.message}”</div>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
      )}

      {/* Target Gauge Header & Anti-Procrastination Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Day Target: 10 Microtasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                  <Target className="w-4 h-4" />
                  <span>Day {selectedDay} Completion: {dailyCompletionPct}%</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    isRestDay
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                      : dailyCompletedCount >= 10
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : dailyCompletedCount > 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  {isRestDay
                    ? 'Rest Day'
                    : dailyCompletedCount >= 10
                    ? 'Fully Completed'
                    : dailyCompletedCount > 0
                    ? 'Partially Completed'
                    : 'Not Started'}
                </span>
              </div>
              <span className="text-sm font-extrabold text-slate-100">
                {dailyCompletedCount} / 10 Tasks
              </span>
            </div>

            <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${dailyCompletionPct}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>
                {dailyCompletedCount >= 10
                  ? '★ Full 10/10 Day Achieved! (Fully Completed)'
                  : dailyCompletedCount > 0
                  ? `Partially Completed (${dailyCompletedCount}/10) — ${10 - dailyCompletedCount} more for Full-Day Streak`
                  : dailyMinimumMode
                  ? `Daily Minimum Anchor: ${Math.min(3, dailyCompletedCount)} / 3 tasks (Standard goal: 10/10)`
                  : '10/10 required for Full-Day Streak'}
              </span>
              <span className="flex items-center space-x-1 text-slate-300 font-semibold">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>~{totalMinutesEstimated}m total</span>
              </span>
            </div>
          </div>

          {/* Anti-Procrastination & Evening Review Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {/* Prominent JUST START Button */}
            <button
              onClick={onOpenJustStart}
              className="px-5 py-3 bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center space-x-2"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Just Start (1-Task Focus)</span>
            </button>

            {/* Daily Review Button */}
            <button
              onClick={onOpenDailyReview}
              className="px-4 py-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-indigo-300 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5"
            >
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Daily Review</span>
            </button>

            {/* Rest Day Toggle */}
            <button
              onClick={handleToggleRestDay}
              className={`px-3.5 py-3 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                isRestDay
                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Mark day as Rest / Pause Day to protect streak"
            >
              <Coffee className="w-4 h-4" />
              <span>{isRestDay ? 'Rest Day Active' : 'Rest Day'}</span>
            </button>
          </div>
        </div>

        {/* Sub-bar: Tough Day Minimum Mode + Sound/Haptics Toggle */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setDailyMinimumMode(!dailyMinimumMode)}
              className={`px-3 py-1 rounded-lg font-semibold border transition-all flex items-center space-x-1.5 ${
                dailyMinimumMode
                  ? 'bg-teal-950 border-teal-500/50 text-teal-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-teal-400" />
              <span>{dailyMinimumMode ? 'Daily Minimum Mode: ON (3-Task Anchor)' : 'Tough Day? Enable 3-Task Minimum Anchor'}</span>
            </button>
          </div>

          <button
            onClick={handleToggleSoundPreference}
            className="text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800"
            title="Toggle optional completion sound & haptics (muted by default)"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Sound & Haptics: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                <span>Sound & Haptics: Muted</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Category Filter Bar & Add Task Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-1 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'All'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            All Microtasks ({tasks.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = tasks.filter((t) => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            setEditingTask(null);
            resetForm();
            setShowNewTaskForm(!showNewTaskForm);
          }}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Microtask (+10 XP)</span>
        </button>
      </div>

      {/* New or Edit Task Form */}
      {(showNewTaskForm || editingTask) && (
        <form onSubmit={handleCreateOrUpdateTask} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-100">
              {editingTask ? `Edit Microtask (Day ${selectedDay})` : `New Microtask for Day ${selectedDay}`}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowNewTaskForm(false);
                setEditingTask(null);
                setFormError(null);
              }}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div role="alert" className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Microtask Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5-Minute Stretch or Drink Water"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief guidance or context..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Estimated Duration (2 - 15 Mins)</label>
              <select
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value={2}>2 Minutes (Quick Win)</option>
                <option value={3}>3 Minutes</option>
                <option value={5}>5 Minutes (Standard Microtask)</option>
                <option value={10}>10 Minutes (Focus Sprint)</option>
                <option value={15}>15 Minutes (Max Microtask)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20"
          >
            {editingTask ? 'Save Microtask Changes' : 'Add Microtask to Day ' + selectedDay}
          </button>
        </form>
      )}

      {/* Task List with Reordering, Low-Energy Mode & Instant 10 XP Toggle */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-300 font-bold text-sm">No microtasks on Day {selectedDay} list</h3>
          <p className="text-slate-500 text-xs mt-1">
            Click 'Add Microtask' above to build your 10 microtasks for Day {selectedDay}!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task, index) => {
            const isJustCompleted = feedbackBanner?.taskId === task.id;
            return (
              <div
                key={task.id}
                className={`relative group bg-slate-900 border rounded-2xl p-4 transition-all duration-300 ${
                  task.completed
                    ? 'border-emerald-800/60 bg-emerald-950/15 scale-[0.995]'
                    : 'border-slate-800 hover:border-slate-700 shadow-md'
                } ${isJustCompleted ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Reorder + Complete Checkbox + Content */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex flex-col space-y-1 text-slate-600 group-hover:text-slate-400 transition-colors">
                      <button
                        onClick={() => handleMoveTask(index, 'up')}
                        disabled={index === 0}
                        className="hover:text-emerald-400 disabled:opacity-20"
                        title="Move Up"
                        aria-label={`Move '${task.title}' up`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveTask(index, 'down')}
                        disabled={index === filteredTasks.length - 1}
                        className="hover:text-emerald-400 disabled:opacity-20"
                        title="Move Down"
                        aria-label={`Move '${task.title}' down`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleCompletion(task)}
                      disabled={completingTaskId === task.id}
                      className="text-slate-400 hover:text-emerald-400 transition-transform active:scale-125"
                      title={task.completed ? 'Click to Uncomplete (-10 XP)' : 'Click to Complete (+10 XP)'}
                      aria-label={task.completed ? `Uncomplete '${task.title}'` : `Complete '${task.title}'`}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-400/20 transition-all" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-600 hover:text-emerald-400 transition-all" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span
                          className={`text-sm font-semibold transition-all ${
                            task.completed ? 'text-slate-400 line-through' : 'text-slate-100'
                          }`}
                        >
                          {task.title}
                        </span>

                        {task.is_low_energy_replacement && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/50 flex items-center space-x-1">
                            <Feather className="w-2.5 h-2.5" />
                            <span>Low-Energy Version (Replaced: {task.original_title})</span>
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                      )}

                      <div className="flex items-center space-x-2 mt-2 flex-wrap gap-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>{formatTaskDuration(task.estimated_minutes)}</span>
                        </span>

                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-950 text-slate-400 border border-slate-800">
                          {task.category}
                        </span>

                        <span className="px-2 py-0.5 text-[10px] font-bold text-amber-300 bg-amber-950/50 border border-amber-800/40 rounded-md">
                          +10 XP
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Low-Energy Replace, Edit, Delete */}
                  <div className="flex items-center space-x-1">
                    {!task.completed && !task.is_low_energy_replacement && (
                      <button
                        onClick={() => handleLowEnergyReplace(task)}
                        className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Low-Energy Mode: Replace with easier 3-minute version"
                        aria-label={`Low-energy replacement for '${task.title}'`}
                      >
                        <Feather className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => startEditTask(task)}
                      className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Edit Microtask"
                      aria-label={`Edit '${task.title}'`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete Microtask"
                      aria-label={`Delete '${task.title}'`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
