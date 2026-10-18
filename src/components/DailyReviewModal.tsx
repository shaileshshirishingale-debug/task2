import React, { useState, useEffect } from 'react';
import { BookOpen, Star, Battery, CheckCircle2, Copy, Lock, X } from 'lucide-react';

interface DailyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumber: number;
  token: string | null;
  onRefreshData: () => void;
}

export const DailyReviewModal: React.FC<DailyReviewModalProps> = ({
  isOpen,
  onClose,
  dayNumber,
  token,
  onRefreshData,
}) => {
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatLearned, setWhatLearned] = useState('');
  const [whatDistracted, setWhatDistracted] = useState('');
  const [improvementTomorrow, setImprovementTomorrow] = useState('');
  const [energyLevel, setEnergyLevel] = useState<number>(3);
  const [moodLevel, setMoodLevel] = useState<number>(3);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Next-day planning state
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetch(`/api/reviews/${dayNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.review) {
            setWhatWentWell(data.review.what_went_well || '');
            setWhatLearned(data.review.what_learned || '');
            setWhatDistracted(data.review.what_distracted || '');
            setImprovementTomorrow(data.review.improvement_tomorrow || '');
            setEnergyLevel(data.review.energy_level || 3);
            setMoodLevel(data.review.mood_level || 3);
          } else {
            setWhatWentWell('');
            setWhatLearned('');
            setWhatDistracted('');
            setImprovementTomorrow('');
            setEnergyLevel(3);
            setMoodLevel(3);
          }
        })
        .catch((err) => console.warn('Failed to load review:', err));
    }
  }, [isOpen, dayNumber, token]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch(`/api/reviews/${dayNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          what_went_well: whatWentWell,
          what_learned: whatLearned,
          what_distracted: whatDistracted,
          improvement_tomorrow: improvementTomorrow,
          energy_level: energyLevel,
          mood_level: moodLevel,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to save review:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToNextDay = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/tasks/copy-to-next-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromDay: dayNumber,
          toDay: Math.min(100, dayNumber + 1),
        }),
      });

      if (res.ok) {
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 3000);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to copy tasks to next day:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div role="dialog" aria-label={`Day ${dayNumber} Daily Review`} className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          aria-label="Close Daily Review modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-between pr-8 mb-2 flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Day {dayNumber} Daily Review</h2>
              <p className="text-xs text-slate-400">
                Optional evening reflection to close your day with clarity.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-semibold text-indigo-300">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>Private Journal Entry</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 pr-1 flex-1 py-2">
          {/* Energy & Mood Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1.5">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span>Energy Level: {energyLevel} / 5</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={energyLevel}
                onChange={(e) => setEnergyLevel(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1 - Exhausted</span>
                <span>3 - Balanced</span>
                <span>5 - High Energy</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1.5">
                <Star className="w-4 h-4 text-amber-400" />
                <span>Mindset / Mood: {moodLevel} / 5</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={moodLevel}
                onChange={(e) => setMoodLevel(parseInt(e.target.value, 10))}
                className="w-full accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1 - Heavy</span>
                <span>3 - Calm</span>
                <span>5 - Triumphant</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">What went well today?</label>
            <textarea
              rows={2}
              value={whatWentWell}
              onChange={(e) => setWhatWentWell(e.target.value)}
              placeholder="Wins, microtasks executed, or positive moments..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">What did I learn?</label>
            <textarea
              rows={2}
              value={whatLearned}
              onChange={(e) => setWhatLearned(e.target.value)}
              placeholder="Insights about your pacing, focus, or thoughts..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">What distracted me?</label>
            <textarea
              rows={2}
              value={whatDistracted}
              onChange={(e) => setWhatDistracted(e.target.value)}
              placeholder="Obstacles, friction, or loss of attention..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">What is one improvement for tomorrow?</label>
            <textarea
              rows={2}
              value={improvementTomorrow}
              onChange={(e) => setImprovementTomorrow(e.target.value)}
              placeholder={`One concrete tweak for Day ${Math.min(100, dayNumber + 1)}...`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {/* Next Day Planning Button */}
            <button
              type="button"
              onClick={handleCopyToNextDay}
              className="w-full sm:w-auto px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all"
            >
              {copiedSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {copiedSuccess
                  ? `Copied to Day ${Math.min(100, dayNumber + 1)}`
                  : `Copy Tasks to Day ${Math.min(100, dayNumber + 1)}`}
              </span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-teal-500 text-slate-950 font-bold rounded-xl text-xs hover:brightness-110 shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2"
            >
              {savedSuccess && <CheckCircle2 className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : savedSuccess ? 'Review Saved!' : 'Save Daily Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
