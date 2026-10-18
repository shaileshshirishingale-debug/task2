import React, { useState } from 'react';
import { Gift, CheckCircle2, Plus, Sparkles, X } from 'lucide-react';
import type { RewardItem } from '../lib/types.ts';

interface RewardMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewards: RewardItem[];
  totalTasksCount: number;
  fullDaysCount: number;
  token: string | null;
  onRefreshProfile: () => void;
}

export const RewardMenuModal: React.FC<RewardMenuModalProps> = ({
  isOpen,
  onClose,
  rewards,
  totalTasksCount,
  fullDaysCount,
  token,
  onRefreshProfile,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [unlockType, setUnlockType] = useState<'tasks' | 'days'>('tasks');
  const [targetCount, setTargetCount] = useState<number>(10);
  const [category, setCategory] = useState<'break' | 'activity' | 'treat' | 'celebration'>('break');

  if (!isOpen) return null;

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !title.trim()) return;

    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          unlock_type: unlockType,
          target_count: targetCount,
          category,
        }),
      });

      if (res.ok) {
        setTitle('');
        setDescription('');
        setShowAddForm(false);
        onRefreshProfile();
      }
    } catch (err) {
      console.error('Failed to create reward:', err);
    }
  };

  const handleToggleClaim = async (rewardId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/rewards/${rewardId}/toggle-claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onRefreshProfile();
      }
    } catch (err) {
      console.error('Failed to toggle claim:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div role="dialog" aria-label="Healthy Reward Menu" className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          aria-label="Close Reward Menu"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2.5 mb-2">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Healthy Reward Menu</h2>
            <p className="text-xs text-slate-400">
              Low-cost, restorative incentives to celebrate genuine milestones and consistency.
            </p>
          </div>
        </div>

        {/* Informational Guidance */}
        <div className="my-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            Rewards are personal celebrations of showing up. They should encourage rest, nature, connection, and simple joys—never excessive spending or sleep deprivation.
          </div>
        </div>

        <div className="flex justify-between items-center my-2">
          <span className="text-xs font-bold text-slate-300">
            Current Progress: {totalTasksCount} Tasks Completed • {fullDaysCount} Full (10/10) Days
          </span>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1 shadow-md shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Reward</span>
          </button>
        </div>

        {/* Add Reward Form */}
        {showAddForm && (
          <form onSubmit={handleCreateReward} className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 space-y-3">
            <div className="text-xs font-bold text-emerald-400">Define a Restorative Reward</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Reward Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 20m park walk or special coffee"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Milestone Trigger</label>
                <div className="flex gap-2">
                  <select
                    value={unlockType}
                    onChange={(e) => setUnlockType(e.target.value as any)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                  >
                    <option value="tasks">Total Tasks Done</option>
                    <option value="days">Full (10/10) Days</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={targetCount}
                    onChange={(e) => setTargetCount(parseInt(e.target.value, 10))}
                    className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="How you will enjoy this win..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-400"
              >
                Save Reward
              </button>
            </div>
          </form>
        )}

        {/* Rewards List */}
        <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
          {rewards.map((rew) => {
            const currentVal = rew.unlock_type === 'tasks' ? totalTasksCount : fullDaysCount;
            const isUnlocked = currentVal >= rew.target_count;

            return (
              <div
                key={rew.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  rew.is_claimed
                    ? 'bg-emerald-950/20 border-emerald-800/40 opacity-70'
                    : isUnlocked
                    ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  <div
                    className={`p-2 rounded-xl flex-shrink-0 ${
                      isUnlocked
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Gift className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-200">{rew.title}</span>
                      <span className="text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40">
                        {rew.target_count} {rew.unlock_type === 'tasks' ? 'Tasks' : 'Full Days'}
                      </span>
                    </div>
                    {rew.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{rew.description}</p>
                    )}
                    <div className="text-[10px] text-slate-500 mt-1">
                      {isUnlocked ? (
                        <span className="text-emerald-400 font-semibold inline-flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ready to Enjoy!</span>
                        </span>
                      ) : (
                        <span>
                          {rew.target_count - currentVal} more {rew.unlock_type === 'tasks' ? 'tasks' : 'full days'} to unlock
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isUnlocked && (
                  <button
                    onClick={() => handleToggleClaim(rew.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all ${
                      rew.is_claimed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                    }`}
                  >
                    {rew.is_claimed ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enjoyed</span>
                      </>
                    ) : (
                      <span>Claim Win</span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
