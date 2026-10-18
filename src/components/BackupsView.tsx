import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  HardDrive,
  FileText,
  ExternalLink,
  RotateCcw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Calendar,
  Volume2,
  VolumeX,
  Coffee,
  X,
} from 'lucide-react';
import type { UserBackup, UserProfileStats } from '../lib/types.ts';
import { localPersistence } from '../lib/indexeddb.ts';

interface BackupsViewProps {
  backups: UserBackup[];
  token: string | null;
  stats?: UserProfileStats | null;
  startDateStr?: string;
  currentProgramDay?: number;
  onUpdateStartDate?: (newDateStr: string) => void;
  onRefreshBackups: () => void;
  onRefreshAllData: () => void;
  onOpenAuth: () => void;
}

export const BackupsView: React.FC<BackupsViewProps> = ({
  backups,
  token,
  stats,
  startDateStr = '',
  currentProgramDay = 1,
  onUpdateStartDate,
  onRefreshBackups,
  onRefreshAllData,
  onOpenAuth,
}) => {
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [includePrivateJournals, setIncludePrivateJournals] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [lastExportPayload, setLastExportPayload] = useState<{
    rawContent: string;
    filename: string;
    contentType: string;
  } | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportFromCache, setExportFromCache] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Program Settings state
  const [editedStartDate, setEditedStartDate] = useState(startDateStr);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (startDateStr) {
      setEditedStartDate(startDateStr);
    }
  }, [startDateStr]);

  // Import JSON state
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset Program Confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const soundEnabled = stats?.user?.sound_enabled || false;
  const hapticsEnabled = stats?.user?.haptics_enabled || false;
  const isTodayRestDay = (stats?.rest_days || []).includes(currentProgramDay);

  const handleSaveStartDateSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedStartDate || !onUpdateStartDate) return;
    onUpdateStartDate(editedStartDate);
    setSettingsSavedMessage(`Program start date updated to ${editedStartDate}.`);
    setTimeout(() => setSettingsSavedMessage(null), 4000);
  };

  const handleTogglePreference = async (field: 'sound' | 'haptics') => {
    if (!token) {
      onOpenAuth();
      return;
    }
    try {
      const nextSound = field === 'sound' ? !soundEnabled : soundEnabled;
      const nextHaptics = field === 'haptics' ? !hapticsEnabled : hapticsEnabled;
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sound_enabled: nextSound,
          haptics_enabled: nextHaptics,
        }),
      });
      if (res.ok) {
        setSettingsSavedMessage('Reward feedback preferences saved.');
        setTimeout(() => setSettingsSavedMessage(null), 3000);
        onRefreshAllData();
      }
    } catch (err) {
      setErrorMessage('Failed to update preferences.');
    }
  };

  const handleToggleTodayRestDay = async () => {
    if (!token) {
      onOpenAuth();
      return;
    }
    try {
      const res = await fetch(`/api/days/${currentProgramDay}/toggle-rest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setSettingsSavedMessage(
          isTodayRestDay
            ? `Day ${currentProgramDay} resumed as an active mission day.`
            : `Day ${currentProgramDay} marked as a Rest Day (streak protected).`
        );
        setTimeout(() => setSettingsSavedMessage(null), 3000);
        onRefreshAllData();
      }
    } catch (err) {
      setErrorMessage('Failed to toggle rest day.');
    }
  };

  const triggerBrowserDownload = (content: string, filename: string, contentType: string) => {
    try {
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Browser download fallback:', err);
    }
  };

  const handleExportData = async () => {
    if (!token) {
      onOpenAuth();
      return;
    }

    setExporting(true);
    setDownloadUrl(null);
    setExportMessage(null);
    setExportFromCache(false);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/blob/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          format: exportFormat,
          includePrivateJournals,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const isCachedHit = Boolean(data.fromCache);
        setExportFromCache(isCachedHit);
        if (data.downloadUrl) {
          setDownloadUrl(data.downloadUrl);
        }
        if (data.rawContent && data.filename) {
          const cachedPayload = {
            rawContent: data.rawContent,
            filename: data.filename,
            contentType: data.contentType || 'application/json',
            contentHash: data.contentHash,
          };
          setLastExportPayload({
            rawContent: data.rawContent,
            filename: data.filename,
            contentType: data.contentType || 'application/json',
          });
          if (data.backup?.id) {
            await localPersistence.save(`blob_cache_id_${data.backup.id}`, cachedPayload);
          }
          if (data.downloadUrl) {
            await localPersistence.save(`blob_cache_url_${data.downloadUrl}`, cachedPayload);
          }
          triggerBrowserDownload(data.rawContent, data.filename, data.contentType || 'application/json');
        }
        setExportMessage(
          exportFormat === 'json'
            ? isCachedHit
              ? 'Full JSON backup served from cache (0 redundant Vercel Blob requests).'
              : 'Full JSON backup generated, cached, and downloaded.'
            : isCachedHit
            ? 'CSV task history & analytics served from cache (0 redundant Vercel Blob requests).'
            : 'CSV task history and analytics report generated, cached, and downloaded.'
        );
        onRefreshBackups();
      } else {
        setErrorMessage(data.error || 'Failed to generate export.');
      }
    } catch (err) {
      setErrorMessage('Network or storage error while generating export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSnapshot = async (backup: UserBackup, e?: React.MouseEvent<HTMLElement>) => {
    if (e) e.preventDefault();
    const contentType = backup.file_type === 'csv' ? 'text/csv' : 'application/json';

    // 1. Check client-side IndexedDB cache first to avoid any network request to Vercel Blob
    const cachedById = await localPersistence.load<{
      rawContent: string;
      filename: string;
      contentType: string;
    }>(`blob_cache_id_${backup.id}`);
    if (cachedById?.rawContent) {
      triggerBrowserDownload(cachedById.rawContent, backup.filename, cachedById.contentType || contentType);
      return;
    }

    const cachedByUrl = await localPersistence.load<{
      rawContent: string;
      filename: string;
      contentType: string;
    }>(`blob_cache_url_${backup.blob_url}`);
    if (cachedByUrl?.rawContent) {
      triggerBrowserDownload(cachedByUrl.rawContent, backup.filename, cachedByUrl.contentType || contentType);
      return;
    }

    // 2. Check server-side cached proxy endpoint (/api/blob/download/:backupId)
    if (token) {
      try {
        const res = await fetch(`/api/blob/download/${backup.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const text = await res.text();
          await localPersistence.save(`blob_cache_id_${backup.id}`, {
            rawContent: text,
            filename: backup.filename,
            contentType,
          });
          triggerBrowserDownload(text, backup.filename, contentType);
          return;
        }
      } catch {
        // Fallback to decoding data URI if embedded
      }
    }

    // 3. Decode embedded data URI directly in browser if present
    if (backup.blob_url.startsWith('data:')) {
      const commaIdx = backup.blob_url.indexOf(',');
      if (commaIdx !== -1) {
        try {
          const decoded = atob(backup.blob_url.slice(commaIdx + 1));
          triggerBrowserDownload(decoded, backup.filename, contentType);
          return;
        } catch {
          // ignore
        }
      }
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      onOpenAuth();
      return;
    }

    setImporting(true);
    setImportSuccess(null);
    setErrorMessage(null);

    try {
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        setErrorMessage('Invalid JSON file format. Please select a valid QuestHabit .json backup file.');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/user/import-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payload: parsed }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportSuccess(
          `Restored ${data.importedTasks} microtasks and ${data.importedCompletions} completions (${data.totalXP} Total XP). Duplicate IDs and duplicate XP were prevented.`
        );
        onRefreshAllData();
      } else {
        setErrorMessage(data.error || 'Failed to import JSON data.');
      }
    } catch (err) {
      setErrorMessage('Failed to read or import backup file.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      onOpenAuth();
      return;
    }

    if (resetConfirmationText.trim() !== 'RESET') {
      setErrorMessage('Please type RESET in uppercase to confirm resetting your program.');
      return;
    }

    setResetting(true);
    setErrorMessage(null);
    setResetSuccessMessage(null);

    try {
      const res = await fetch('/api/user/reset-program', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          confirmation: 'RESET',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await localPersistence.clearAll();
        setShowResetConfirm(false);
        setResetConfirmationText('');
        setResetSuccessMessage('100-Day Program has been reset to Day 1 with 10 fresh microtasks.');
        onRefreshAllData();
      } else {
        setErrorMessage(data.error || 'Failed to reset program.');
      }
    } catch (err) {
      setErrorMessage('Network error while resetting program.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div
          role="alert"
          className="bg-rose-950/70 border border-rose-700/80 text-rose-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-300 hover:text-white font-bold ml-4"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {resetSuccessMessage && (
        <div className="bg-emerald-950/70 border border-emerald-700/80 text-emerald-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{resetSuccessMessage}</span>
          </div>
          <button
            onClick={() => setResetSuccessMessage(null)}
            className="text-emerald-300 hover:text-white font-bold ml-4"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {settingsSavedMessage && (
        <div className="bg-teal-950/70 border border-teal-700/80 text-teal-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{settingsSavedMessage}</span>
          </div>
          <button
            onClick={() => setSettingsSavedMessage(null)}
            className="text-teal-300 hover:text-white font-bold ml-4"
            aria-label="Dismiss settings message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Program Settings & Preferences Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <Settings className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100">Program Settings & Preferences</h2>
              <p className="text-xs text-slate-400">
                Configure your 100-day start date, rest day protection, and reward feedback preferences.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-xl">
            Current Day: Day {currentProgramDay} of 100
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Setting 1: Program Start Date */}
          <form
            onSubmit={handleSaveStartDateSetting}
            className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
          >
            <div>
              <label htmlFor="settings-start-date" className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Program Start Date (Day 1)</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                Calculates your current program day (Day 1–100) using your local timezone.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="settings-start-date"
                type="date"
                value={editedStartDate}
                onChange={(e) => setEditedStartDate(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-all shrink-0"
              >
                Update Date
              </button>
            </div>
          </form>

          {/* Setting 2: Sound & Haptics Feedback */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>Sound & Haptic Feedback</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Optional gentle chime and haptic pulse on microtask completion (muted by default).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTogglePreference('sound')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  soundEnabled
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Sound: {soundEnabled ? 'ON' : 'Muted'}
              </button>
              <button
                type="button"
                onClick={() => handleTogglePreference('haptics')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  hapticsEnabled
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Haptics: {hapticsEnabled ? 'ON' : 'Off'}
              </button>
            </div>
          </div>

          {/* Setting 3: Today's Rest Day / Pause Mode */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <Coffee className="w-3.5 h-3.5 text-indigo-400" />
                <span>Rest Day / Streak Pause</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Pause Day {currentProgramDay} so a recovery day never breaks your consecutive full-day streak.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleTodayRestDay}
              className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isTodayRestDay
                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-indigo-500/40'
              }`}
            >
              {isTodayRestDay
                ? `Day ${currentProgramDay} Rest Mode: ACTIVE (Streak Protected)`
                : `Enable Rest Day for Today (Day ${currentProgramDay})`}
            </button>
          </div>
        </div>
      </div>

      {/* Export & Import Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Data (JSON & CSV) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-slate-100">Export Data & Analytics</h2>
            </div>
            <p className="text-xs text-slate-400">
              Export your complete 100-day program in <strong>JSON format</strong> for full backup & restore, or export <strong>CSV format</strong> for task completion history and daily analytics.
            </p>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full">
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  exportFormat === 'json'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                JSON (Full Data Backup)
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  exportFormat === 'csv'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CSV (Task History & Analytics)
              </button>
            </div>

            {exportFormat === 'json' && (
              <label className="flex items-center space-x-2.5 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includePrivateJournals}
                  onChange={(e) => setIncludePrivateJournals(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Include private daily journal reflections in JSON export</span>
                </span>
              </label>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="w-full px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold rounded-xl text-xs hover:brightness-110 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {exporting
                  ? 'Generating Export...'
                  : `Export ${exportFormat.toUpperCase()} (${exportFormat === 'json' ? 'Full Backup' : 'History & Analytics'})`}
              </span>
            </button>

            {exportMessage && (
              <div className="p-3 bg-cyan-950/60 border border-cyan-800/80 rounded-xl flex items-center justify-between text-xs">
                <span className="text-cyan-200 font-medium flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{exportMessage}</span>
                </span>
                {(lastExportPayload || downloadUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lastExportPayload) {
                        triggerBrowserDownload(
                          lastExportPayload.rawContent,
                          lastExportPayload.filename,
                          lastExportPayload.contentType
                        );
                      }
                    }}
                    className="px-3 py-1 bg-cyan-500 text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center space-x-1 shrink-0 ml-2"
                  >
                    <span>Download Copy</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Import Data (JSON) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-slate-100">Import User Data (JSON)</h2>
            </div>
            <p className="text-xs text-slate-400">
              Restore your tasks, completion history, streaks, custom rewards, and reflections from a previously exported QuestHabit <strong>.json</strong> file. Duplicate task IDs and duplicate XP awards are automatically prevented.
            </p>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Idempotent Import Protection:</div>
              <div>• Prevents duplicate task IDs and preserves existing progress</div>
              <div>• Recomputes XP from unique task completions (10 XP per task)</div>
              <div>• Keeps personal journal reflections private to your account</div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFileChange}
              className="hidden"
              id="json-import-input"
              aria-label="Upload JSON backup file"
            />
            <label
              htmlFor="json-import-input"
              className={`w-full px-5 py-2.5 bg-slate-950 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                importing ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{importing ? 'Importing & Validating JSON...' : 'Select JSON Backup File to Import'}</span>
            </label>

            {importSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-200 font-medium flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historical Backups List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100">Saved Export Snapshots</h3>
            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-0.5 rounded-lg">
              Edge & Local Cache Enabled
            </span>
          </div>
          <span className="text-xs text-slate-400">{backups.length} snapshot(s)</span>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/60 border border-slate-800/80 rounded-xl p-6">
            <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              No export snapshots generated yet. Use the Export button above to create a JSON or CSV snapshot.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <span>{b.filename}</span>
                      {(b.from_cache || exportFromCache) && (
                        <span className="text-[10px] font-semibold text-teal-300 bg-teal-950/80 border border-teal-800/60 px-2 py-0.5 rounded-md">
                          Cached
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(b.created_at).toLocaleString()} • {b.file_type.toUpperCase()} ({Math.max(1, Math.round(b.file_size / 1024))} KB)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDownloadSnapshot(b, e)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-xs font-semibold text-cyan-400 transition-all flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset 100-Day Program (With Explicit Confirmation Step) */}
      <div className="bg-slate-900 border border-rose-900/50 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-slate-100">Reset 100-Day Program</h3>
            </div>
            <p className="text-xs text-slate-400">
              Start a fresh 100-day cycle from Day 1. Historical data is never deleted without your explicit confirmation.
            </p>
          </div>

          {!showResetConfirm && (
            <button
              type="button"
              onClick={() => {
                setShowResetConfirm(true);
                setResetConfirmationText('');
              }}
              className="px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/70 rounded-xl text-xs font-bold transition-all shrink-0 self-start sm:self-auto"
            >
              Reset Program...
            </button>
          )}
        </div>

        {showResetConfirm && (
          <form
            onSubmit={handleResetProgram}
            className="bg-slate-950 border border-rose-800/80 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start space-x-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Confirm Program Reset</p>
                <p className="text-slate-400 mt-0.5">
                  This will clear your current task completions, XP balance, and daily reflections, and re-initialize Day 1 with 10 fresh microtasks. Consider exporting a JSON backup first.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="reset-confirm-input"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Type <span className="text-rose-400 font-mono font-bold">RESET</span> to confirm:
              </label>
              <input
                id="reset-confirm-input"
                type="text"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                placeholder="Type RESET"
                className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <button
                type="submit"
                disabled={resetting || resetConfirmationText.trim() !== 'RESET'}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all"
              >
                {resetting ? 'Resetting Program...' : 'Confirm & Reset Program'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmationText('');
                }}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
