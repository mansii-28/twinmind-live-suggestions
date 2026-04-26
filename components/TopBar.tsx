'use client';

import { useState } from 'react';
import { Settings, Download, Mic, Square, CheckCircle2, Loader2 } from 'lucide-react';
import type { AppStatus } from './TranscriptPanel';

interface TopBarProps {
  onSettingsClick: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onExport: () => void;
  appStatus: AppStatus;
}

const STATUS_CONFIG: Record<AppStatus, { label: string; dot?: boolean; cls: string }> = {
  Ready:        { label: 'Ready',               cls: 'text-slate-500 bg-slate-100' },
  Recording:    { label: 'Listening',  dot: true, cls: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
  Transcribing: { label: 'Transcribing', dot: true, cls: 'text-blue-700 bg-blue-50 border border-blue-200' },
  Stopping:     { label: 'Finishing…',  dot: true, cls: 'text-teal-700 bg-teal-50 border border-teal-200' },
  Error:        { label: 'Error',               cls: 'text-rose-700 bg-rose-50 border border-rose-200' },
};

export default function TopBar({
  onSettingsClick,
  isRecording,
  onToggleRecording,
  onExport,
  appStatus,
}: TopBarProps) {
  const [exportSuccess, setExportSuccess] = useState(false);
  const status = STATUS_CONFIG[appStatus] ?? STATUS_CONFIG.Ready;

  const handleExport = () => {
    onExport();
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2500);
  };

  return (
    <header className="shrink-0 flex items-center justify-between px-6 h-14 bg-white border-b border-slate-200/80 z-10">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-xs tracking-tight">TM</span>
        </div>
        <span className="text-sm font-semibold text-slate-800 tracking-tight">TwinMind Live</span>

        {/* Session status pill */}
        <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${status.cls}`}>
          {status.dot && (
            appStatus === 'Transcribing' || appStatus === 'Stopping'
              ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
              : <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          )}
          {status.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Record / Stop */}
        <button
          onClick={onToggleRecording}
          aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
            isRecording
              ? 'bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500'
          }`}
        >
          {isRecording ? (
            <><Square className="w-3.5 h-3.5 fill-current" aria-hidden /> Stop</>
          ) : (
            <><Mic className="w-3.5 h-3.5" aria-hidden /> Record</>
          )}
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          aria-label="Export session as JSON"
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400 ${
            exportSuccess
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          {exportSuccess ? (
            <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden /> Exported</>
          ) : (
            <><Download className="w-3.5 h-3.5" aria-hidden /> Export</>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          aria-label="Open settings"
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-400"
        >
          <Settings className="w-3.5 h-3.5" aria-hidden />
          Settings
        </button>
      </div>
    </header>
  );
}
