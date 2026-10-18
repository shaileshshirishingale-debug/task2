import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, ArrowRight, Zap, Feather, Clock, Sparkles, X } from 'lucide-react';
import type { Task } from '../lib/types.ts';
import { playGentleSuccessSound, triggerGentleHaptic } from '../utils/audioFeedback.ts';

interface AntiProcrastinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  token: string | null;
  dayNumber: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onRefreshData: () => void;
}

export const AntiProcrastinationModal: React.FC<AntiProcrastinationModalProps> = ({
  isOpen,
  onClose,
  tasks,
  token,
  dayNumber,
  soundEnabled,
  hapticsEnabled,
  onRefreshData,
}) => {
  // Find incomplete tasks sorted by difficulty/minutes
  const incompleteTasks = tasks.filter((t) => !t.completed);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 2-Minute Starter Timer State
  const STARTER_SECONDS = 120; // 2 minutes
  const [secondsRemaining, setSecondsRemaining] = useState(STARTER_SECONDS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  // Low-energy replacement state
  const [replacingLowEnergy, setReplacingLowEnergy] = useState(false);

  const activeTask: Task | undefined = incompleteTasks[currentIndex];

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      playGentleSuccessSound(soundEnabled);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining, soundEnabled]);

  useEffect(() => {
    // Reset timer when active task changes
    setSecondsRemaining(STARTER_SECONDS);
    setIsTimerRunning(false);
    setCompletionMessage(null);
  }, [activeTask?.id]);

  if (!isOpen) return null;

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setSecondsRemaining(STARTER_SECONDS);
  };

  const handleCompleteCurrentTask = async () => {
    if (!token || !activeTask) return;
    setCompleting(true);

    try {
      const res = await fetch(`/api/tasks/${activeTask.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        playGentleSuccessSound(soundEnabled);
        triggerGentleHaptic(hapticsEnabled);
        setCompletionMessage(data.encouragingMessage || 'One small win. Keep moving.');
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleNextTask = () => {
    setCompletionMessage(null);
    if (currentIndex < incompleteTasks.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleLowEnergyReplace = async () => {
    if (!token || !activeTask) return;
    setReplacingLowEnergy(true);

    try {
      const easierTitle = `Gentle: 3m Light ${activeTask.title.replace(/^Gentle: /, '')}`;
      const res = await fetch(`/api/tasks/${activeTask.id}/low-energy`, {
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
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed low energy replacement:', err);
    } finally {
      setReplacingLowEnergy(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const timerPct = ((STARTER_SECONDS - secondsRemaining) / STARTER_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div role="dialog" aria-label="Just Start Mode" className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        <button
          onClick={onClose}
          aria-label="Close Just Start Mode"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider mb-3">
          <Zap className="w-3.5 h-3.5" />
          <span>Anti-Procrastination Single-Task Focus</span>
        </div>

        <h2 className="text-xl font-extrabold text-slate-100">Just Start Mode</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Overwhelmed? Forget the full list. Focus on this single tiny action for just 2 minutes.
        </p>

        {/* Single Task Display */}
        {!activeTask ? (
          <div className="my-8 p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-200">All Microtasks Complete for Day {dayNumber}!</h3>
            <p className="text-xs text-slate-400">You crushed your 10-task target today.</p>
            <button
              onClick={onClose}
              className="mt-3 px-6 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="my-6 space-y-6">
            {/* Task Focus Card */}
            <div className="p-6 bg-slate-950 rounded-2xl border border-emerald-500/40 shadow-lg shadow-emerald-500/5 text-left relative">
              {activeTask.is_low_energy_replacement && (
                <span className="absolute top-3 right-3 text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/50 flex items-center space-x-1">
                  <Feather className="w-3 h-3" />
                  <span>Low-Energy Version</span>
                </span>
              )}

              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                {activeTask.category} • ~{activeTask.estimated_minutes} Mins
              </div>
              <h3 className="text-lg font-bold text-slate-100 mt-1">{activeTask.title}</h3>
              {activeTask.description && (
                <p className="text-xs text-slate-400 mt-1">{activeTask.description}</p>
              )}

              {/* Success / Encouragement Message Banner */}
              {completionMessage && (
                <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 font-bold flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{completionMessage} (+10 XP)</span>
                </div>
              )}
            </div>

            {/* 2-Minute Starter Timer */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col items-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>2-Minute Starter Timer</span>
              </div>

              <div className="text-3xl font-black text-slate-100 font-mono my-1">
                {formatTimer(secondsRemaining)}
              </div>

              {/* Progress bar */}
              <div className="w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden my-2">
                <div
                  className="h-full bg-emerald-400 transition-all duration-1000"
                  style={{ width: `${timerPct}%` }}
                />
              </div>

              <div className="flex items-center space-x-2 mt-2">
                {!isTimerRunning ? (
                  <button
                    onClick={handleStartTimer}
                    className="px-4 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center space-x-1 hover:bg-emerald-500/30"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start 2m Timer</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePauseTimer}
                    className="px-4 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center space-x-1 hover:bg-amber-500/30"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  onClick={handleResetTimer}
                  className="p-1.5 text-slate-500 hover:text-slate-300 rounded-xl"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {!completionMessage ? (
                <button
                  onClick={handleCompleteCurrentTask}
                  disabled={completing}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-extrabold text-sm rounded-xl hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{completing ? 'Completing...' : 'Mark Microtask Done (+10 XP)'}</span>
                </button>
              ) : (
                <button
                  onClick={handleNextTask}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-teal-400 text-slate-950 font-extrabold text-sm rounded-xl hover:brightness-110 shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  <span>Next Small Task</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}

              {/* Low-Energy Mode Option */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  onClick={handleLowEnergyReplace}
                  disabled={replacingLowEnergy || activeTask.is_low_energy_replacement}
                  className="text-slate-400 hover:text-amber-400 flex items-center space-x-1 disabled:opacity-40"
                  title="Replace task with smaller gentle version"
                >
                  <Feather className="w-3.5 h-3.5 text-amber-400" />
                  <span>Low-Energy Mode (Make Easier)</span>
                </button>

                {incompleteTasks.length > 1 && (
                  <button
                    onClick={handleNextTask}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    Skip to another task →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
