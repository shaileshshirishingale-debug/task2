import React from 'react';
import { Trophy, Sparkles, Crown, Flame, CheckCircle2, Star, Zap } from 'lucide-react';

interface MilestoneCelebrationModalProps {
  milestoneTitle: string | null;
  onClose: () => void;
}

export const MilestoneCelebrationModal: React.FC<MilestoneCelebrationModalProps> = ({
  milestoneTitle,
  onClose,
}) => {
  if (!milestoneTitle) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        role="dialog"
        aria-label="Milestone Celebration"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/50 rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-amber-500/10"
      >
        {/* Animated Icon Ring */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-400 to-emerald-400 p-1 flex items-center justify-center shadow-xl shadow-amber-500/30 mb-4 motion-safe:animate-bounce">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Trophy className="w-10 h-10 text-amber-400" />
          </div>
        </div>

        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-extrabold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Milestone Achieved!</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-100">{milestoneTitle}</h2>

        <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
          Every milestone is proof of your consistency and self-trust. Take a quiet breath and honor this win.
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          Continue Forward
        </button>
      </div>
    </div>
  );
};
