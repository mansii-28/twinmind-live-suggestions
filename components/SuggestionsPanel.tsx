'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Lightbulb, Loader2 } from 'lucide-react';
import { AISuggestion, SuggestionBatch } from '../lib/types';

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Question:        { bg: 'bg-violet-100',  text: 'text-violet-700' },
  Answer:          { bg: 'bg-blue-100',    text: 'text-blue-700' },
  'Fact-check':    { bg: 'bg-amber-100',   text: 'text-amber-700' },
  Clarifier:       { bg: 'bg-cyan-100',    text: 'text-cyan-700' },
  'Talking Point': { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  Risk:            { bg: 'bg-rose-100',    text: 'text-rose-700' },
  'Follow-up':     { bg: 'bg-teal-100',    text: 'text-teal-700' },
  Summary:         { bg: 'bg-slate-200',   text: 'text-slate-600' },
  Action:          { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  isLoading: boolean;
  isChatLoading: boolean;
  activeSuggestionId?: string;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: AISuggestion) => void;
}

function SuggestionCard({
  suggestion,
  onClick,
  disabled,
  isActive,
  mounted,
}: {
  suggestion: AISuggestion;
  onClick: (s: AISuggestion) => void;
  disabled: boolean;
  isActive: boolean;
  mounted: boolean;
}) {
  const style = TYPE_STYLES[suggestion.type] ?? { bg: 'bg-slate-200', text: 'text-slate-600' };

  return (
    <button
      onClick={() => onClick(suggestion)}
      disabled={disabled}
      aria-label={`${suggestion.type}: ${suggestion.title}`}
      className={`w-full text-left rounded-xl border transition-all px-4 py-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? 'border-blue-300 bg-blue-50/60 shadow-sm'
          : 'border-slate-200/80 bg-white hover:border-blue-200 hover:shadow-sm hover:bg-slate-50/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-0.5 ${style.bg} ${style.text}`}>
          {suggestion.type}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[13px] font-semibold leading-snug ${isActive ? 'text-blue-800' : 'text-slate-800 group-hover:text-blue-700'} transition-colors`}>
            {suggestion.title}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
            {suggestion.preview}
          </p>
          {mounted && suggestion.whyNow && (
            <p className="text-[10px] text-slate-400 mt-2 italic leading-snug">{suggestion.whyNow}</p>
          )}
        </div>
      </div>
    </button>
  );
}

export default function SuggestionsPanel({
  batches,
  isLoading,
  isChatLoading,
  activeSuggestionId,
  onRefresh,
  onSuggestionClick,
}: SuggestionsPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const formatTime = (isoStr: string) =>
    mounted ? new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const reversed = [...batches].reverse();

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white rounded-xl border border-slate-200/70 shadow-sm">
      {/* Panel header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" aria-hidden />
          Live Suggestions
          {isChatLoading && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-500 normal-case tracking-normal">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Thinking…
            </span>
          )}
        </h2>
        <button
          onClick={onRefresh}
          disabled={isLoading || isChatLoading}
          aria-label="Refresh suggestions"
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-blue-600 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-full px-2 py-1"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
          {isLoading ? 'Generating…' : 'Refresh'}
        </button>
      </div>

      {/* Loading — first batch */}
      {isLoading && batches.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <p className="text-[13px]">Generating 3 suggestions…</p>
        </div>
      )}

      {/* Scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-4">
        {reversed.map((batch, batchIdx) => (
          <div key={batch.id} className={batchIdx === 0 ? 'pt-3' : 'pt-2'}>
            {/* Batch header */}
            <div className="flex items-center gap-2 px-4 mb-2">
              {batchIdx === 0 ? (
                <>
                  <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest">Latest</span>
                  <div className="flex-1 h-px bg-blue-100" />
                </>
              ) : (
                <div className="flex-1 h-px bg-slate-100" />
              )}
              <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{formatTime(batch.createdAt)}</span>
              {batchIdx > 0 && <div className="flex-1 h-px bg-slate-100" />}
            </div>

            {/* Cards */}
            <div className="px-3 space-y-2">
              {batch.suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onClick={onSuggestionClick}
                  disabled={isChatLoading}
                  isActive={s.id === activeSuggestionId}
                  mounted={mounted}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {!isLoading && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 px-6 pt-16">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-[13px] text-center leading-relaxed">
              Start recording to generate<br />live suggestions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
