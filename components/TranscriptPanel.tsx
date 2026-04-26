'use client';

import { useEffect, useRef, useState } from 'react';
import { TranscriptEntry } from '../lib/types';
import { Mic, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export type AppStatus = 'Ready' | 'Recording' | 'Transcribing' | 'Stopping' | 'Error';

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  status: AppStatus;
}

export default function TranscriptPanel({ entries, status }: TranscriptPanelProps) {
  const [mounted, setMounted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const formatTime = (isoStr: string) =>
    mounted ? new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  const statusBadge = () => {
    switch (status) {
      case 'Recording':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Listening
          </span>
        );
      case 'Transcribing':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Transcribing
          </span>
        );
      case 'Stopping':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Finishing…
          </span>
        );
      case 'Error':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
            <AlertTriangle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Ready
          </span>
        );
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white rounded-xl border border-slate-200/70 shadow-sm">
      {/* Panel header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-slate-400" aria-hidden />
          Transcript
        </h2>
        {statusBadge()}
      </div>

      {/* Scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Mic className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-[13px] text-center text-slate-400 leading-relaxed">
              Start recording to<br />capture the live transcript.
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-slate-50 rounded-lg px-3.5 py-3 border border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-600 tracking-wide">{entry.speaker}</span>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">{formatTime(entry.timestamp)}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{entry.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
