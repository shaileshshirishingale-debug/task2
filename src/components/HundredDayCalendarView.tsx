import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Circle,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Sparkles,
  Filter,
} from 'lucide-react';
import { formatLocalDateStr, type DayStatus } from '../lib/program.ts';

interface HeatmapDayItem {
  day_number: number;
  date: string;
  completed_count: number;
  status: DayStatus;
  is_rest: boolean;
  percentage: number;
}

interface HundredDayCalendarViewProps {
  token: string | null;
  currentProgramDay: number;
  selectedDay: number;
  onSelectDayAndNavigate: (day: number) => void;
  onOpenReviewForDay: (day: number) => void;
}

export const HundredDayCalendarView: React.FC<HundredDayCalendarViewProps> = ({
  token,
  currentProgramDay,
  selectedDay,
  onSelectDayAndNavigate,
  onOpenReviewForDay,
}) => {
  const [days, setDays] = useState<HeatmapDayItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete' | 'rest' | 'upcoming'>('all');
  const [loading, setLoading] = useState(true);
  const [inspectedDay, setInspectedDay] = useState<HeatmapDayItem | null>(null);

  const fetchCalendarData = async () => {
    if (!token) return;
    try {
      const localDate = encodeURIComponent((window as any).__QUESTHABIT_LOCAL_DATE__ || formatLocalDateStr());
      const res = await fetch(`/api/analytics?localDate=${localDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDays(data.heatmap || []);
        const current = (data.heatmap || []).find((d: HeatmapDayItem) => d.day_number === selectedDay);
        if (current) setInspectedDay(current);
      }
    } catch (err) {
      console.error('Failed to fetch calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [token, selectedDay]);

  const handleToggleRestDay = async (dayNum: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/days/${dayNum}/toggle-rest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        await fetchCalendarData();
      }
    } catch (err) {
      console.error('Failed to toggle rest day:', err);
    }
  };

  const filteredDays = days.filter((d) => {
    if (filter === 'completed') return d.status === 'fully_completed';
    if (filter === 'incomplete')
      return d.status === 'partially_completed' || d.status === 'in_progress' || d.status === 'not_started';
    if (filter === 'rest') return d.is_rest || d.status === 'rest_day';
    if (filter === 'upcoming') return d.status === 'future';
    return true;
  });

  const getStatusBadge = (status: DayStatus) => {
    switch (status) {
      case 'fully_completed':
        return {
          label: 'Fully Completed (10/10)',
          classes: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300',
          cellClasses: 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20',
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          classes: 'bg-amber-500/20 border-amber-500/60 text-amber-300',
          cellClasses: 'bg-amber-500/30 text-amber-200 border-amber-500/60',
        };
      case 'partially_completed':
        return {
          label: 'Partially Completed',
          classes: 'bg-teal-500/20 border-teal-500/60 text-teal-300',
          cellClasses: 'bg-teal-950/90 text-teal-300 border-teal-700/60',
        };
      case 'rest_day':
        return {
          label: 'Rest / Paused Day',
          classes: 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300',
          cellClasses: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60',
        };
      case 'not_started':
        return {
          label: 'Not Started',
          classes: 'bg-slate-800 border-slate-700 text-slate-300',
          cellClasses: 'bg-slate-900 text-slate-400 border-slate-800',
        };
      case 'future':
      default:
        return {
          label: 'Future Day',
          classes: 'bg-slate-950 border-slate-800 text-slate-500',
          cellClasses: 'bg-slate-950/50 text-slate-600 border-slate-900',
        };
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-xs text-slate-400">Loading 100-Day Program Calendar...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Legend */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span>100-Day Challenge Calendar</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Click any day to inspect completion percentage, mark a Rest Day, or jump to its task list and review notes.
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All (100)' },
              { id: 'completed', label: 'Completed (10/10)' },
              { id: 'incomplete', label: 'Incomplete / Partial' },
              { id: 'rest', label: 'Rest Days' },
              { id: 'upcoming', label: 'Upcoming' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  filter === tab.id
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span>Fully Completed (10/10)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-500 inline-block" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-teal-900 border border-teal-600 inline-block" />
            <span>Partially Completed</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-indigo-900 border border-indigo-600 inline-block" />
            <span>Rest / Paused Day</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-slate-900 border border-slate-700 inline-block" />
            <span>Not Started</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-slate-950 border border-slate-900 inline-block" />
            <span>Future Day</span>
          </div>
        </div>
      </div>

      {/* Main Grid + Side Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 100-Day Grid */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
            {filteredDays.map((item) => {
              const badge = getStatusBadge(item.status);
              const isToday = item.day_number === currentProgramDay;
              const isInspected = inspectedDay?.day_number === item.day_number;

              return (
                <button
                  key={item.day_number}
                  onClick={() => setInspectedDay(item)}
                  className={`relative p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center min-h-[58px] ${
                    badge.cellClasses
                  } ${isInspected ? 'ring-2 ring-white scale-105 z-10' : 'hover:scale-105'}`}
                >
                  <span className="text-xs font-black">D{item.day_number}</span>
                  <span className="text-[9px] font-bold opacity-85 mt-0.5">
                    {item.is_rest ? 'REST' : `${item.completed_count}/10`}
                  </span>
                  {isToday && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-slate-950" title="Today" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          {inspectedDay ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Selected Program Day</span>
                    <h3 className="text-2xl font-black text-slate-100">Day {inspectedDay.day_number} of 100</h3>
                    <span className="text-xs text-slate-400">{inspectedDay.date}</span>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      getStatusBadge(inspectedDay.status).classes
                    }`}
                  >
                    {getStatusBadge(inspectedDay.status).label}
                  </div>
                </div>

                {/* Progress Bar for Inspected Day */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">Daily Completion</span>
                    <span className="text-emerald-400">
                      {inspectedDay.completed_count} / 10 Tasks ({inspectedDay.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${inspectedDay.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Rest Day Option */}
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Coffee className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-200">Rest / Pause Day Option</span>
                    </div>
                    <button
                      onClick={() => handleToggleRestDay(inspectedDay.day_number)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        inspectedDay.is_rest
                          ? 'bg-indigo-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {inspectedDay.is_rest ? 'Marked as Rest Day' : 'Mark as Rest Day'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Taking a planned rest day preserves your full-day streak without penalty.
                  </p>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="space-y-2.5 pt-4 border-t border-slate-800">
                <button
                  onClick={() => onSelectDayAndNavigate(inspectedDay.day_number)}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-extrabold rounded-xl text-xs hover:brightness-110 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20"
                >
                  <span>Open Day {inspectedDay.day_number} Task List</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onOpenReviewForDay(inspectedDay.day_number)}
                  className="w-full py-2.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-indigo-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open Day {inspectedDay.day_number} Review & Notes</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">Select a day from the grid to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
};
