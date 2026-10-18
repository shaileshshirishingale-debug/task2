import React from 'react';
import {
  Trophy,
  Flame,
  Sparkles,
  Target,
  ArrowRight,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  Activity,
  Award,
} from 'lucide-react';
import type { UserProfileStats } from '../lib/types.ts';
import { calculateDashboardAnalytics, buildDailyTaskTargetSlots } from '../lib/program.ts';

interface DashboardViewProps {
  stats: UserProfileStats | null;
  onContinueMission: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ stats, onContinueMission }) => {
  if (!stats) return null;

  const { program_stats, streak, level, level_title, total_xp } = stats;
  const analytics = calculateDashboardAnalytics(
    program_stats.daily_completed_count,
    program_stats.total_completed_count,
    program_stats.current_program_day
  );

  const dailyTargetSummary = buildDailyTaskTargetSlots(
    analytics.dailyCompletedCount,
    analytics.dailyTarget
  );

  const weeklyConsistencyPct = program_stats.weekly_consistency_pct ?? analytics.weeklyConsistencyPct;
  const overallConsistencyPct = program_stats.overall_consistency_pct ?? analytics.overallConsistencyPct;
  const isProgramComplete = Boolean(program_stats.is_program_complete || program_stats.day_100_completed);

  // SVG Circular progress calculation for Today's 10 Microtasks
  const circleRadius = 54;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (analytics.dailyPct / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* 100-Day Program Complete Celebration Banner */}
      {isProgramComplete && (
        <div
          role="status"
          className="bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border-2 border-amber-400/60 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                100-Day Program Complete
              </div>
              <div className="text-base sm:text-lg font-black text-slate-100">
                Congratulations! You completed Day 100 — all historical progress, tasks, and {total_xp} XP are permanently preserved.
              </div>
            </div>
          </div>
          <span className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs whitespace-nowrap">
            Program Complete
          </span>
        </div>
      )}

      {/* Top Hero Banner & Primary CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-emerald-950 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Day {program_stats.current_program_day} of 100</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              1,000 Microtask Conquest
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              10 microtasks every day for 100 days. Turn small 2–15 minute daily habits into legendary momentum.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <span className="inline-flex items-center text-xs text-slate-300 font-semibold bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                <span>{analytics.daysRemaining} Days Remaining</span>
              </span>
              <span className="text-xs text-amber-300 font-semibold bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-800/40">
                Level {level}: {level_title} ({total_xp} XP)
              </span>
            </div>
          </div>

          {/* Prominent CTA Button */}
          <button
            onClick={onContinueMission}
            className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-3 group"
          >
            <span>Continue Today's Mission</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Main Gauges Row: Distinct Today's 10-Task Target Indicator vs Linear 100-Day Program Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Today's 10-Task Visual Progress Indicator (Radial Gauge + 10-Segment Step Tracker) */}
        <div
          data-testid="daily-tasks-progress-card"
          className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-base font-extrabold text-slate-100">Today's 10-Task Target</h2>
                <p className="text-[11px] text-slate-400">
                  Day {program_stats.current_program_day} Daily Microtask Goal (10 Tasks = Full Day)
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                analytics.dailyCompletedCount >= 10
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : analytics.dailyCompletedCount > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              {analytics.dailyCompletedCount >= 10
                ? 'Fully Completed (10/10)'
                : analytics.dailyCompletedCount > 0
                ? `Partially Completed (${analytics.dailyCompletedCount}/10)`
                : 'Not Started (0/10)'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-6 py-2">
            {/* Animated SVG Circular Progress Ring */}
            <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
                {/* Background Ring */}
                <circle
                  cx="64"
                  cy="64"
                  r={circleRadius}
                  stroke="currentColor"
                  strokeWidth="11"
                  className="text-slate-950"
                  fill="transparent"
                />
                {/* Animated Gradient Progress Ring */}
                <circle
                  cx="64"
                  cy="64"
                  r={circleRadius}
                  stroke="url(#emeraldGradient)"
                  strokeWidth="11"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-100">{analytics.dailyPct}%</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">
                  {dailyTargetSummary.completedSlots}/{dailyTargetSummary.targetCount} Done
                </span>
              </div>
            </div>

            {/* Daily Stats & 10-Task Segmented Progress Tracker */}
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-emerald-400">
                    {analytics.dailyCompletedCount} / {analytics.dailyTarget}
                  </span>
                  <span className="ml-2 text-xs text-slate-400 font-semibold">
                    Microtasks Completed
                  </span>
                </div>
                <span className="text-xs font-extrabold text-teal-300 bg-teal-950/60 border border-teal-800/50 px-2 py-0.5 rounded-lg">
                  +{dailyTargetSummary.dailyXpEarned} / {dailyTargetSummary.dailyXpTarget} XP
                </span>
              </div>

              {/* 10-Segment Discrete Visual Progress Indicator for Today's 10 Tasks */}
              <div
                role="progressbar"
                aria-label="Today's 10-task completion target"
                aria-valuenow={dailyTargetSummary.completedSlots}
                aria-valuemin={0}
                aria-valuemax={dailyTargetSummary.targetCount}
                data-testid="daily-10-task-segmented-indicator"
                className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-300 uppercase tracking-wider">
                    10-Task Daily Target Steps
                  </span>
                  <span className="text-emerald-400">
                    {dailyTargetSummary.remainingSlots === 0
                      ? 'Target Reached!'
                      : `${dailyTargetSummary.remainingSlots} to reach 10-task goal`}
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {dailyTargetSummary.slots.map((slot) => (
                    <div
                      key={slot.slotNumber}
                      data-testid={`daily-task-slot-${slot.slotNumber}`}
                      data-completed={slot.completed ? 'true' : 'false'}
                      title={
                        slot.completed
                          ? `Task #${slot.slotNumber}: Completed`
                          : slot.isCurrentTarget
                          ? `Task #${slot.slotNumber}: Next Task Toward 10-Task Target`
                          : `Task #${slot.slotNumber}: Remaining`
                      }
                      className={`h-8 rounded-lg flex flex-col items-center justify-center text-[11px] font-black transition-all border ${
                        slot.completed
                          ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 border-emerald-300 shadow-sm shadow-emerald-500/30'
                          : slot.isCurrentTarget
                          ? 'bg-emerald-950/50 text-emerald-300 border-emerald-400/80 ring-1 ring-emerald-400/40'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      <span>{slot.slotNumber}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-0.5">
                  <span>Start (0/10)</span>
                  <span>Halfway (5/10)</span>
                  <span className="text-emerald-400 font-bold">Target: 10/10 Tasks</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
                {analytics.dailyCompletedCount >= 10 ? (
                  <span className="text-emerald-400 font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Fully Completed (10/10) — Daily Target Achieved!</span>
                  </span>
                ) : analytics.dailyCompletedCount > 0 ? (
                  <span>
                    Partially Completed ({analytics.dailyCompletedCount}/10) — Complete{' '}
                    <strong className="text-emerald-300">
                      {10 - analytics.dailyCompletedCount} more{' '}
                      {10 - analytics.dailyCompletedCount === 1 ? 'task' : 'tasks'}
                    </strong>{' '}
                    to lock in today's 10/10 target.
                  </span>
                ) : (
                  <span>
                    Complete all <strong className="text-emerald-300">10 microtasks</strong> today to earn +100 XP and advance your full-day streak.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Linear Progress Bar for 100-Day Program (1,000 Tasks) */}
        <div
          data-testid="program-100-day-progress-card"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-base font-extrabold text-slate-100">100-Day Grand Progress</h2>
                <p className="text-[11px] text-slate-400">
                  Cumulative Program Horizon (1,000 Total Microtasks)
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-xs font-bold text-amber-300">
              {analytics.overallPct}% Complete
            </span>
          </div>

          <div className="space-y-6 my-auto">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-3xl font-black text-slate-100">
                  {analytics.totalCompletedCount}{' '}
                  <span className="text-sm font-semibold text-slate-400">/ 1,000</span>
                </span>
                <span className="text-xs font-bold text-amber-400">
                  Program Target: 1,000 Microtasks
                </span>
              </div>

              {/* Continuous Linear Progress Bar for 100-Day Program (capped at 100%) */}
              <div
                role="progressbar"
                aria-label="100-day program 1,000 microtask progress"
                aria-valuenow={analytics.totalCompletedCount}
                aria-valuemin={0}
                aria-valuemax={analytics.totalTarget}
                data-testid="program-100-day-linear-bar"
                className="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5"
              >
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 rounded-full transition-all duration-700 shadow-lg shadow-amber-500/20"
                  style={{ width: `${analytics.overallPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mt-1.5">
                <span>Day 1 (0)</span>
                <span>Day 25 (250)</span>
                <span>Day 50 (500)</span>
                <span>Day 75 (750)</span>
                <span className="text-amber-400 font-bold">Day 100 (1,000)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-500">Current Program Day</div>
                <div className="text-base font-bold text-slate-200 mt-0.5">Day {program_stats.current_program_day} of 100</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-500">Days Remaining</div>
                <div className="text-base font-bold text-teal-400 mt-0.5">{analytics.daysRemaining} Days</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Analytics: Streaks, XP, Consistency */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Current Streak */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center space-x-2 text-orange-400 mb-2">
            <Flame className="w-5 h-5 fill-orange-400/20" />
            <span className="text-xs font-bold uppercase tracking-wider">Current Streak</span>
          </div>
          <div className="text-2xl font-black text-slate-100">{streak?.current_streak || 0} Days</div>
          <div className="text-[10px] text-slate-500 mt-1">Consecutive full 10/10 days</div>
        </div>

        {/* Best Streak */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center space-x-2 text-teal-400 mb-2">
            <Award className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Best Streak</span>
          </div>
          <div className="text-2xl font-black text-slate-100">{streak?.longest_streak || 0} Days</div>
          <div className="text-[10px] text-slate-500 mt-1">Personal record streak</div>
        </div>

        {/* Weekly Consistency */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center space-x-2 text-indigo-400 mb-2">
            <Activity className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">7-Day Consistency</span>
          </div>
          <div className="text-2xl font-black text-indigo-300">{weeklyConsistencyPct}%</div>
          <div className="text-[10px] text-slate-500 mt-1">Last 7 days completion rate</div>
        </div>

        {/* Overall Consistency */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center space-x-2 text-amber-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Overall Pace</span>
          </div>
          <div className="text-2xl font-black text-amber-300">{overallConsistencyPct}%</div>
          <div className="text-[10px] text-slate-500 mt-1">Target pace to date</div>
        </div>
      </div>
    </div>
  );
};
