import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Trophy,
  Flame,
  CheckCircle2,
  TrendingUp,
  Layers,
  Award,
  Sparkles,
  Calendar,
  Lock,
  Info,
} from 'lucide-react';
import { LEVEL_TIERS, SYSTEM_MILESTONES } from '../lib/gamification.ts';
import { formatLocalDateStr } from '../lib/program.ts';
import type { UserProfileStats } from '../lib/types.ts';

interface AnalyticsViewProps {
  token: string | null;
  stats: UserProfileStats | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ token, stats }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const localDate = (window as any).__QUESTHABIT_LOCAL_DATE__ || formatLocalDateStr(new Date());
    fetch(`/api/analytics?localDate=${encodeURIComponent(localDate)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load analytics:', err);
        setLoading(false);
      });
  }, [token, stats?.total_xp, stats?.program_stats?.current_program_day]);

  if (loading || !report) {
    return (
      <div className="text-center py-12 text-xs text-slate-400">Generating Analytics & Reports...</div>
    );
  }

  const { analytics, heatmap, categoryCounts, bestDayOfWeek, dayOfWeekCompletions, totalXP, levelProgress } = report;
  const maxDow = Math.max(1, ...(dayOfWeekCompletions || []).map((d: any) => d.count));
  const totalCategoryTasks = Math.max(
    1,
    Object.values(categoryCounts || {}).reduce((acc: number, v: any) => acc + (v || 0), 0) as number
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Program Analytics & Reports</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Transparent tracking of completed microtasks versus fully completed (10/10) days.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs">
          <Info className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <span className="text-slate-300">
            10/10 tasks = 1 Full Day. Partial days still award 10 XP per task.
          </span>
        </div>
      </div>

      {/* Primary KPI Grid (Distinguishing Tasks vs Full Days) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[10px] font-bold uppercase text-slate-400">Completed Tasks</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {analytics.totalCompletedCount} <span className="text-xs text-slate-500">/ 1,000</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{analytics.overallPct}% of total goal</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[10px] font-bold uppercase text-slate-400">Full (10/10) Days</div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {analytics.fullCompletedDaysCount} <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">100% completed days</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[10px] font-bold uppercase text-slate-400">Avg Tasks / Day</div>
          <div className="text-2xl font-black text-teal-300 mt-1">{analytics.averageTasksPerDay}</div>
          <div className="text-[10px] text-slate-500 mt-1">Target: 10.0 / day</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[10px] font-bold uppercase text-slate-400">Daily Rate</div>
          <div className="text-2xl font-black text-indigo-300 mt-1">{analytics.overallConsistencyPct}%</div>
          <div className="text-[10px] text-slate-500 mt-1">Completion rate to date</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[10px] font-bold uppercase text-slate-400">Full-Day Streak</div>
          <div className="text-2xl font-black text-orange-400 mt-1">{analytics.currentFullDayStreak}d</div>
          <div className="text-[10px] text-slate-500 mt-1">Best: {analytics.longestFullDayStreak}d</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[10px] font-bold uppercase text-slate-400">Best Day of Week</div>
          <div className="text-lg font-black text-slate-100 mt-1 truncate">
            {bestDayOfWeek?.completions > 0 ? bestDayOfWeek.name : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {bestDayOfWeek?.completions || 0} tasks finished
          </div>
        </div>
      </div>

      {/* 100-Day Completion Heatmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100">100-Day Completion Heatmap</h3>
            <p className="text-xs text-slate-400">
              Visualizing daily task density across all 100 days of the challenge.
            </p>
          </div>

          {/* Heatmap Intensity Legend */}
          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
            <span>0/10</span>
            <span className="w-3 h-3 rounded bg-slate-950 border border-slate-800 inline-block" />
            <span className="w-3 h-3 rounded bg-emerald-950 border border-emerald-800 inline-block" />
            <span className="w-3 h-3 rounded bg-emerald-700 inline-block" />
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
            <span>10/10</span>
          </div>
        </div>

        <div className="grid grid-cols-10 sm:grid-cols-20 gap-1.5 pt-2">
          {(heatmap || []).map((h: any) => {
            let colorClass = 'bg-slate-950 border-slate-800 text-slate-600';
            if (h.is_rest) {
              colorClass = 'bg-indigo-900/70 border-indigo-600 text-indigo-200';
            } else if (h.completed_count >= 10) {
              colorClass = 'bg-amber-400 border-amber-300 text-slate-950 font-black';
            } else if (h.completed_count >= 7) {
              colorClass = 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold';
            } else if (h.completed_count >= 4) {
              colorClass = 'bg-emerald-700/80 border-emerald-600 text-emerald-100';
            } else if (h.completed_count >= 1) {
              colorClass = 'bg-emerald-950 border-emerald-800 text-emerald-300';
            }

            return (
              <div
                key={h.day_number}
                title={`Day ${h.day_number} (${h.date}): ${h.completed_count}/10 completed`}
                className={`h-8 rounded-lg border flex flex-col items-center justify-center text-[9px] transition-transform hover:scale-110 ${colorClass}`}
              >
                <span>{h.day_number}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row: Day-of-Week Chart & Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Day of Week Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-1">Weekly Day Performance</h3>
            <p className="text-xs text-slate-400 mb-6">
              Completed microtasks grouped by day of the week.
            </p>
          </div>

          <div className="flex items-end justify-between gap-2 h-44 pt-4 px-2 border-b border-slate-800">
            {(dayOfWeekCompletions || []).map((d: any) => {
              const heightPct = Math.max(6, Math.round((d.count / maxDow) * 100));
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400">{d.count}</span>
                  <div className="w-full bg-slate-950 rounded-t-lg h-32 flex items-end p-0.5 border border-slate-800/80">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md transition-all duration-500"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 pb-1">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category-wise Task Completion */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-1">Category-Wise Task Completion</h3>
            <p className="text-xs text-slate-400">
              Distribution of completed microtasks across focus areas.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {Object.entries(categoryCounts || {}).map(([cat, count]: [string, any]) => {
              const pct = Math.min(100, Math.round(((count || 0) / totalCategoryTasks) * 100));
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-200">{cat}</span>
                    <span className="text-emerald-400">{count} tasks ({pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* XP & Transparent Level System Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100">Transparent XP & Level System</h3>
            <p className="text-xs text-slate-400">
              Every completed task awards a fixed, predictable 10 XP. Current Balance: <strong className="text-amber-400">{totalXP} XP (Level {levelProgress.level})</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {LEVEL_TIERS.slice(0, 5).map((tier) => {
            const isCurrent = levelProgress.level === tier.level;
            const isPassed = levelProgress.level > tier.level;
            return (
              <div
                key={tier.level}
                className={`p-3.5 rounded-xl border text-left ${
                  isCurrent
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md'
                    : isPassed
                    ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-xs font-black uppercase">Level {tier.level}</div>
                <div className="text-xs font-bold mt-0.5 truncate">{tier.title}</div>
                <div className="text-[10px] opacity-80 mt-1">{tier.minXP}–{tier.maxXP} XP</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestone Celebrations Progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span>Program Milestones</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(stats?.milestones || SYSTEM_MILESTONES).map((m: any) => {
            const unlocked = !!m.unlocked_at;
            return (
              <div
                key={m.key}
                className={`p-4 rounded-xl border flex items-start space-x-3 ${
                  unlocked
                    ? 'bg-slate-950 border-amber-500/40 text-slate-100'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60'
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${
                    unlocked ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-900 text-slate-600'
                  }`}
                >
                  {unlocked ? <Trophy className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold">{m.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{m.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
