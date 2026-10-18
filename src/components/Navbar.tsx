import React from 'react';
import {
  Shield,
  Sparkles,
  Flame,
  LogOut,
  LayoutDashboard,
  Target,
  Calendar,
  BarChart3,
  Gift,
  HardDrive,
} from 'lucide-react';
import type { UserProfileStats } from '../lib/types.ts';

export type NavTab = 'dashboard' | 'quests' | 'calendar' | 'analytics' | 'backups';

interface NavbarProps {
  stats: UserProfileStats | null;
  onOpenAuth: () => void;
  onOpenRewardMenu: () => void;
  onLogout: () => void;
  onNavigate: (tab: NavTab) => void;
  currentTab: NavTab;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  onOpenAuth,
  onOpenRewardMenu,
  onLogout,
  onNavigate,
  currentTab,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer shrink-0" onClick={() => onNavigate('dashboard')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="text-base sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                QuestHabit
              </span>
              <span className="hidden lg:inline-block ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                100 Days • 1,000 Tasks
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 whitespace-nowrap">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentTab === 'dashboard'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('quests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentTab === 'quests'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>Daily Quests</span>
            </button>

            <button
              onClick={() => onNavigate('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentTab === 'calendar'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>100-Day Calendar</span>
            </button>

            <button
              onClick={() => onNavigate('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentTab === 'analytics'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => onNavigate('backups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentTab === 'backups'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 shrink-0" />
              <span>Data & Backups</span>
            </button>
          </nav>

          {/* Right: Reward Menu + Level / XP / Streak */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 whitespace-nowrap">
            {stats ? (
              <>
                <button
                  onClick={onOpenRewardMenu}
                  className="px-2.5 py-1.5 sm:px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap"
                  title="Open Healthy Reward Menu"
                  aria-label="Open Reward Menu"
                >
                  <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Reward Menu</span>
                </button>

                <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-950 px-2.5 py-1.5 sm:px-3 rounded-xl border border-slate-800 shadow-inner whitespace-nowrap">
                  <div className="flex items-center space-x-1 text-amber-400 font-bold text-xs whitespace-nowrap">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>LVL {stats.level}</span>
                    <span className="text-[10px] text-slate-400">({stats.total_xp} XP)</span>
                  </div>
                  <div className="w-px h-3 bg-slate-800" />
                  <div className="flex items-center space-x-1 text-orange-400 font-bold text-xs whitespace-nowrap" title="Full (10/10) Day Streak">
                    <Flame className="w-3.5 h-3.5 fill-orange-400/20 shrink-0" />
                    <span>{stats.streak?.current_streak || 0}d</span>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all"
              >
                Sign In / Demo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex border-t border-slate-800/80 bg-slate-950/90 px-2 py-1.5 justify-around overflow-x-auto">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`px-2 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap ${
            currentTab === 'dashboard' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onNavigate('quests')}
          className={`px-2 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap ${
            currentTab === 'quests' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'
          }`}
        >
          Daily Quests
        </button>
        <button
          onClick={() => onNavigate('calendar')}
          className={`px-2 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap ${
            currentTab === 'calendar' ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => onNavigate('analytics')}
          className={`px-2 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap ${
            currentTab === 'analytics' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400'
          }`}
        >
          Analytics
        </button>
        <button
          onClick={() => onNavigate('backups')}
          className={`px-2 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap ${
            currentTab === 'backups' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400'
          }`}
        >
          Data & Backups
        </button>
      </div>
    </header>
  );
};
