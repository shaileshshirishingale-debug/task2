import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { QuestBoard } from './components/QuestBoard.tsx';
import { HundredDayCalendarView } from './components/HundredDayCalendarView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { BackupsView } from './components/BackupsView.tsx';
import { RewardMenuModal } from './components/RewardMenuModal.tsx';
import { DailyReviewModal } from './components/DailyReviewModal.tsx';
import { AntiProcrastinationModal } from './components/AntiProcrastinationModal.tsx';
import { MilestoneCelebrationModal } from './components/MilestoneCelebrationModal.tsx';
import type { Task, UserProfileStats, UserBackup } from './lib/types.ts';
import { calculateProgramDay, formatLocalDateStr } from './lib/program.ts';
import { localPersistence } from './lib/indexeddb.ts';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('questhabit_token'));
  const [stats, setStats] = useState<UserProfileStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [backups, setBackups] = useState<UserBackup[]>([]);

  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [currentProgramDay, setCurrentProgramDay] = useState<number>(1);
  const [startDateStr, setStartDateStr] = useState<string>(formatLocalDateStr());

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRewardMenu, setShowRewardMenu] = useState(false);
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [showJustStart, setShowJustStart] = useState(false);
  const [milestoneCelebration, setMilestoneCelebration] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [activeLocalDate, setActiveLocalDate] = useState<string>(() => {
    return (window as any).__QUESTHABIT_LOCAL_DATE__ || formatLocalDateStr();
  });

  const getClientLocalDate = () => {
    return (window as any).__QUESTHABIT_LOCAL_DATE__ || formatLocalDateStr();
  };

  useEffect(() => {
    const initSession = async () => {
      // Load cached state from IndexedDB immediately for resilient offline/reload experience
      const cachedStats = await localPersistence.load<UserProfileStats>('profile_stats');
      if (cachedStats) {
        setStats(cachedStats);
        if (cachedStats.program_stats) {
          const curDay = cachedStats.program_stats.current_program_day;
          setCurrentProgramDay(curDay);
          setSelectedDay(curDay);
          setStartDateStr(cachedStats.program_stats.program_start_date);
          const cachedTasks = await localPersistence.load<Task[]>(`tasks_day_${curDay}`);
          if (cachedTasks && cachedTasks.length > 0) {
            setTasks(cachedTasks);
          }
        }
      }

      let activeToken = token;

      if (!activeToken) {
        try {
          const demoEmail = `demo_${Math.floor(Math.random() * 10000)}@questhabit.dev`;
          const demoUsername = `QuestHero_${Math.floor(Math.random() * 900 + 100)}`;
          const demoPassword = 'DemoPassword123!';

          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: demoEmail,
              username: demoUsername,
              password: demoPassword,
              program_start_date: getClientLocalDate(),
            }),
          });

          const data = await res.json();
          if (res.ok && data.token) {
            activeToken = data.token;
            localStorage.setItem('questhabit_token', data.token);
            setToken(data.token);
          }
        } catch (err) {
          console.warn('Auto demo creation fallback:', err);
        }
      }

      if (activeToken) {
        await refreshAllData(activeToken, undefined, true);
      }
      setLoading(false);
    };

    initSession();
  }, []);

  // Midnight Crossing & Local Timezone Boundary Detector
  useEffect(() => {
    const checkMidnightBoundary = () => {
      const nowLocalStr = getClientLocalDate();
      if (nowLocalStr !== activeLocalDate) {
        setActiveLocalDate(nowLocalStr);
        const newProgramDay = calculateProgramDay(startDateStr, nowLocalStr);
        setCurrentProgramDay(newProgramDay);
        setSelectedDay(newProgramDay);
        if (token) {
          refreshAllData(token, newProgramDay);
        }
      }
    };

    const interval = setInterval(checkMidnightBoundary, 5000);
    window.addEventListener('focus', checkMidnightBoundary);
    window.addEventListener('questhabit-date-change', checkMidnightBoundary);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkMidnightBoundary);
      window.removeEventListener('questhabit-date-change', checkMidnightBoundary);
    };
  }, [activeLocalDate, startDateStr, token]);

  const refreshProfileStats = async (
    activeToken: string = token!,
    dayToFetch: number = selectedDay
  ): Promise<UserProfileStats | null> => {
    if (!activeToken) return null;
    try {
      const localDateParam = encodeURIComponent(getClientLocalDate());
      const res = await fetch(`/api/profile?selectedDay=${dayToFetch}&localDate=${localDateParam}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setStorageWarning(null);
        await localPersistence.save('profile_stats', data);

        if (data.program_stats) {
          setCurrentProgramDay(data.program_stats.current_program_day);
          setStartDateStr(data.program_stats.program_start_date);
        }
        return data;
      } else if (res.status === 401 || res.status === 404) {
        // Token expired or user not found: re-initialize session gracefully
        localStorage.removeItem('questhabit_token');
      }
    } catch (err) {
      const cached = await localPersistence.load<UserProfileStats>('profile_stats');
      if (cached) {
        setStats(cached);
        return cached;
      }
      setStorageWarning('Using local IndexedDB cache while connection recovers.');
    }
    return null;
  };

  const refreshTasks = async (activeToken: string = token!, dayToFetch: number = selectedDay) => {
    if (!activeToken) return;
    try {
      const res = await fetch(`/api/tasks?day=${dayToFetch}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const dayTasks = data.tasks || [];
        setTasks(dayTasks);
        await localPersistence.save(`tasks_day_${dayToFetch}`, dayTasks);
      }
    } catch (err) {
      const cached = await localPersistence.load<Task[]>(`tasks_day_${dayToFetch}`);
      if (cached) setTasks(cached);
    }
  };

  const refreshBackups = async (activeToken: string = token!) => {
    if (!activeToken) return;
    try {
      const res = await fetch('/api/blob/backups', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.backups || [];
        setBackups(list);
        await localPersistence.save('backups_list', list);
      }
    } catch (err) {
      const cached = await localPersistence.load<UserBackup[]>('backups_list');
      if (cached) setBackups(cached);
    }
  };

  const refreshAllData = async (
    activeToken: string = token!,
    dayToFetch?: number,
    syncSelectedToCurrent: boolean = false
  ) => {
    const profileData = await refreshProfileStats(activeToken, dayToFetch ?? selectedDay);
    const effectiveDay =
      syncSelectedToCurrent && profileData?.program_stats?.current_program_day
        ? profileData.program_stats.current_program_day
        : dayToFetch ?? selectedDay;

    if (syncSelectedToCurrent && profileData?.program_stats?.current_program_day) {
      setSelectedDay(effectiveDay);
    }

    await Promise.all([
      refreshTasks(activeToken, effectiveDay),
      refreshBackups(activeToken),
    ]);
  };

  const handleSelectDay = (dayNum: number) => {
    const clamped = Math.min(100, Math.max(1, dayNum));
    setSelectedDay(clamped);
    if (token) {
      refreshTasks(token, clamped);
      refreshProfileStats(token, clamped);
    }
  };

  const handleUpdateStartDate = async (newDateStr: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ program_start_date: newDateStr }),
      });

      if (res.ok) {
        setStartDateStr(newDateStr);
        const recalculatedDay = calculateProgramDay(newDateStr, getClientLocalDate());
        setCurrentProgramDay(recalculatedDay);
        setSelectedDay(recalculatedDay);
        await refreshAllData(token, recalculatedDay);
      }
    } catch (err) {
      console.error('Failed to update start date:', err);
    }
  };

  const handleAuthSuccess = async (newToken: string, user: any) => {
    localStorage.setItem('questhabit_token', newToken);
    setToken(newToken);
    await refreshAllData(newToken, undefined, true);
  };

  const handleLogout = async () => {
    localStorage.removeItem('questhabit_token');
    await localPersistence.clearAll();
    setToken(null);
    setStats(null);
    setTasks([]);
    setBackups([]);
    setShowAuthModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400 font-bold text-sm">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span>Entering 100-Day Challenge...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Navbar
        stats={stats}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenRewardMenu={() => setShowRewardMenu(true)}
        onLogout={handleLogout}
        onNavigate={(tab) => setCurrentTab(tab)}
        currentTab={currentTab}
      />

      {storageWarning && (
        <div
          role="status"
          className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-2 text-center text-xs text-amber-200 flex items-center justify-center space-x-3"
        >
          <span>{storageWarning}</span>
          <button
            onClick={() => token && refreshAllData(token, selectedDay)}
            className="underline font-bold hover:text-white"
          >
            Retry Sync
          </button>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            onContinueMission={() => {
              handleSelectDay(currentProgramDay);
              setCurrentTab('quests');
            }}
          />
        )}

        {currentTab === 'quests' && (
          <QuestBoard
            tasks={tasks}
            stats={stats}
            token={token}
            selectedDay={selectedDay}
            currentProgramDay={currentProgramDay}
            startDateStr={startDateStr}
            onSelectDay={handleSelectDay}
            onUpdateStartDate={handleUpdateStartDate}
            onRefreshTasks={() => refreshTasks(token!, selectedDay)}
            onRefreshStats={() => refreshProfileStats(token!, selectedDay)}
            onOpenAuth={() => setShowAuthModal(true)}
            onOpenJustStart={() => setShowJustStart(true)}
            onOpenDailyReview={() => setShowDailyReview(true)}
            onTriggerMilestone={(title) => setMilestoneCelebration(title)}
          />
        )}

        {currentTab === 'calendar' && (
          <HundredDayCalendarView
            token={token}
            currentProgramDay={currentProgramDay}
            selectedDay={selectedDay}
            onSelectDayAndNavigate={(day) => {
              handleSelectDay(day);
              setCurrentTab('quests');
            }}
            onOpenReviewForDay={(day) => {
              handleSelectDay(day);
              setShowDailyReview(true);
            }}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView
            token={token}
            stats={stats}
          />
        )}

        {currentTab === 'backups' && (
          <BackupsView
            backups={backups}
            token={token}
            stats={stats}
            startDateStr={startDateStr}
            currentProgramDay={currentProgramDay}
            onUpdateStartDate={handleUpdateStartDate}
            onRefreshBackups={() => refreshBackups()}
            onRefreshAllData={() => refreshAllData(token!, undefined, true)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      <RewardMenuModal
        isOpen={showRewardMenu}
        onClose={() => setShowRewardMenu(false)}
        rewards={stats?.rewards || []}
        totalTasksCount={stats?.program_stats?.total_completed_count || 0}
        fullDaysCount={stats?.program_stats?.total_full_days_count || 0}
        token={token}
        onRefreshProfile={() => refreshProfileStats(token!, selectedDay)}
      />

      <DailyReviewModal
        isOpen={showDailyReview}
        onClose={() => setShowDailyReview(false)}
        dayNumber={selectedDay}
        token={token}
        onRefreshData={() => refreshAllData(token!, selectedDay)}
      />

      <AntiProcrastinationModal
        isOpen={showJustStart}
        onClose={() => setShowJustStart(false)}
        tasks={tasks}
        token={token}
        dayNumber={selectedDay}
        soundEnabled={stats?.user?.sound_enabled || false}
        hapticsEnabled={stats?.user?.haptics_enabled || false}
        onRefreshData={() => refreshAllData(token!, selectedDay)}
      />

      <MilestoneCelebrationModal
        milestoneTitle={milestoneCelebration}
        onClose={() => setMilestoneCelebration(null)}
      />

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>QuestHabit • 100 Days • 1,000 Microtasks Challenge • Healthy Reward & Consistency Tracker</p>
      </footer>
    </div>
  );
}
