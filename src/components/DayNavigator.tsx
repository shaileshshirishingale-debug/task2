import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Sparkles, Settings, Check, Clock, X } from 'lucide-react';
import { getDateForProgramDay } from '../lib/program.ts';

interface DayNavigatorProps {
  currentProgramDay: number; // Today's calculated program day (1..100)
  selectedDay: number; // Currently viewed day (1..100)
  startDateStr: string; // YYYY-MM-DD
  onSelectDay: (day: number) => void;
  onUpdateStartDate: (newDateStr: string) => void;
}

export const DayNavigator: React.FC<DayNavigatorProps> = ({
  currentProgramDay,
  selectedDay,
  startDateStr,
  onSelectDay,
  onUpdateStartDate,
}) => {
  const [showGridModal, setShowGridModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDateStr);

  useEffect(() => {
    setTempStartDate(startDateStr);
  }, [startDateStr]);

  const selectedDateStr = getDateForProgramDay(startDateStr, selectedDay);
  const isToday = selectedDay === currentProgramDay;

  const handleStartDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempStartDate) {
      onUpdateStartDate(tempStartDate);
      setShowSettingsModal(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Prev Day, Current Day Badge, Next Day */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => onSelectDay(Math.max(1, selectedDay - 1))}
            disabled={selectedDay <= 1}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 disabled:opacity-30 disabled:hover:text-slate-300 transition-all"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1.5">
                <span className="text-base font-extrabold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Day {selectedDay} of 100
                </span>
                {isToday && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    Today
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">{selectedDateStr}</div>
            </div>
          </div>

          <button
            onClick={() => onSelectDay(Math.min(100, selectedDay + 1))}
            disabled={selectedDay >= 100}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 disabled:opacity-30 disabled:hover:text-slate-300 transition-all"
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {!isToday && (
            <button
              onClick={() => onSelectDay(currentProgramDay)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold transition-all"
            >
              Jump to Today (Day {currentProgramDay})
            </button>
          )}

          <button
            onClick={() => setShowGridModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>100-Day Grid</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-semibold flex items-center space-x-1.5 transition-all"
            title="Configure Start Date"
            aria-label="Configure Start Date"
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>Start Date</span>
          </button>
        </div>
      </div>

      {/* 100-Day Calendar Grid Modal */}
      {showGridModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-label="100-Day Program Timeline" className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-100 flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <span>100-Day Program Timeline</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select any day from Day 1 to Day 100 to review or manage microtasks.
                </p>
              </div>
              <button
                onClick={() => setShowGridModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold p-1"
                aria-label="Close timeline modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 grid grid-cols-5 sm:grid-cols-10 gap-2 p-1">
              {Array.from({ length: 100 }, (_, i) => i + 1).map((dayNum) => {
                const isCurrent = dayNum === currentProgramDay;
                const isSelected = dayNum === selectedDay;

                return (
                  <button
                    key={dayNum}
                    onClick={() => {
                      onSelectDay(dayNum);
                      setShowGridModal(false);
                    }}
                    aria-label={`Select Day ${dayNum}`}
                    className={`p-2 rounded-xl text-xs font-extrabold flex flex-col items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30 scale-105'
                        : isCurrent
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {isCurrent && <span className="text-[8px] uppercase tracking-tighter">Today</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Configure Start Date Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-label="Configure Challenge Start Date" className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1"
              aria-label="Close start date modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-extrabold text-slate-100 mb-2 flex items-center space-x-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              <span>Configure Challenge Start Date</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Set the official launch date for your 100-day challenge. Your current program day will automatically recalculate in your local timezone.
            </p>

            <form onSubmit={handleStartDateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Challenge Start Date</label>
                <input
                  type="date"
                  required
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20"
                >
                  Save Start Date
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
