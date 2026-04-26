'use client';

import { useState, useEffect, useRef, KeyboardEvent, ReactNode } from 'react';
import { ChatMessage } from '../lib/types';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onSendMessage: (text: string) => Promise<void>;
}

// ─── Markdown-lite renderer ──────────────────────────────────────────────────

function parseBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
      : part
  );
}

// Section labels that get special callout styling
const SECTION_LABELS = [
  'suggested wording', 'why this matters', 'next step', 'next steps',
  'risks', 'caveats', 'action items', 'explanation', 'talking points',
  'risks or caveats', 'concrete next steps', 'summary', 'decision',
  'action item', 'key decisions', 'risk or caveat', 'suggested reply',
];

function renderMessageContent(text: string): ReactNode {
  // 1. First Pass: Split into lines and clean up each line's formatting
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (!bulletBuffer.length) return;
    elements.push(
      <ul key={key++} className="my-2.5 space-y-1.5 ml-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-slate-700">
            <span className="text-slate-300 mt-1 shrink-0 text-[10px]">●</span>
            <span className="flex-1">{parseBold(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    let rawLine = line.trim();
    if (!rawLine) { flushBullets(); continue; }

    // Detect and strip bullet prefixes
    const bulletMatch = rawLine.match(/^[-*]\s+(.+)/) ?? rawLine.match(/^\d+\.\s+(.+)/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      continue;
    }

    flushBullets();

    // 2. Identify and Clean Section Headers
    // Matches: "### Header", "**Header**", "**Header:**", "Header:"
    // Extracts just the text "Header"
    const headerMatch = rawLine.match(/^(?:#{1,6}\s+)?(?:\*\*)?([^*:]+)(?::)?(?:\*\*)?\s*$/);
    if (headerMatch) {
      const labelText = headerMatch[1].trim();
      const lowerLabel = labelText.toLowerCase();
      const isKnownLabel = SECTION_LABELS.some(sl => lowerLabel.includes(sl));

      if (isKnownLabel || (labelText.length < 40 && labelText.length > 2)) {
        elements.push(
          <p key={key++} className={`text-[11px] font-bold uppercase tracking-widest mt-5 mb-1.5 ${
            isKnownLabel ? 'text-blue-600' : 'text-slate-500'
          }`}>
            {labelText}
          </p>
        );
        continue;
      }
    }

    // 3. Fallback Header Logic (e.g. "Suggested wording:")
    const inlineHeaderMatch = rawLine.match(/^([A-Z][^:]{2,40}):$/);
    if (inlineHeaderMatch && SECTION_LABELS.some(sl => inlineHeaderMatch[1].toLowerCase().includes(sl))) {
      elements.push(
        <p key={key++} className="text-[11px] font-bold uppercase tracking-widest text-blue-600 mt-5 mb-1.5">
          {inlineHeaderMatch[1]}
        </p>
      );
      continue;
    }

    // 4. Normal Paragraph cleanup
    // Sometimes the AI wraps a whole paragraph in bold - strip it if so
    if (rawLine.startsWith('**') && rawLine.endsWith('**')) {
      rawLine = rawLine.slice(2, -2).trim();
    }

    elements.push(
      <p key={key++} className="text-[13.5px] leading-relaxed text-slate-700 mb-2">
        {parseBold(rawLine)}
      </p>
    );
  }

  flushBullets();
  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChatPanel({ messages, isLoading = false, onSendMessage }: ChatPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to START of newest message so long answers begin from the top
  useEffect(() => {
    if (lastMessageRef.current && scrollAreaRef.current) {
      const top = lastMessageRef.current.offsetTop - 16;
      scrollAreaRef.current.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }, [messages]);

  // Keep typing indicator visible
  useEffect(() => {
    if (isLoading && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isLoading]);

  const formatTime = (isoStr: string) =>
    mounted ? new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const busy = isLoading || isSending;

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || busy) return;
    setInputValue('');
    setIsSending(true);
    try { await onSendMessage(text); }
    finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 50); }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white rounded-xl border border-slate-200/70 shadow-sm">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-100">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-blue-400" aria-hidden />
          Copilot Chat
        </h2>
      </div>

      {/* Messages */}
      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const isAssistant = msg.sender === 'assistant';

          return (
            <div
              key={msg.id}
              ref={isLast ? lastMessageRef : undefined}
              className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`flex max-w-[94%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                  isAssistant ? 'bg-blue-100 mr-2' : 'bg-slate-100 ml-2'
                }`}>
                  {isAssistant
                    ? <Bot className="w-3 h-3 text-blue-600" aria-hidden />
                    : <User className="w-3 h-3 text-slate-500" aria-hidden />}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
                  <div className={`px-4 py-3 rounded-2xl ${
                    isAssistant
                      ? 'bg-slate-50 border border-slate-200/70 rounded-tl-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm'
                  }`}>
                    {isAssistant
                      ? renderMessageContent(msg.text)
                      : <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-0.5">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {busy && (
          <div className="flex justify-start">
            <div className="flex flex-row max-w-[94%]">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2 mt-0.5">
                <Bot className="w-3 h-3 text-blue-600" aria-hidden />
              </div>
              <div className="px-4 py-3 bg-slate-50 border border-slate-200/70 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                <span className="text-[13px] text-slate-500">Thinking…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-white">
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Ask about the meeting</label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={busy ? 'Thinking…' : 'Ask about the meeting…'}
            disabled={busy}
            autoComplete="off"
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60 transition-all resize-none max-h-[120px]"
          />
          <button
            onClick={handleSend}
            disabled={busy || !inputValue.trim()}
            aria-label="Send message"
            className="shrink-0 mb-1 w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 shadow-sm"
          >
            {isSending
              ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              : <Send className="w-4 h-4" aria-hidden />}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 pl-1 flex justify-between">
          <span>Press Enter to send</span>
          <span>Shift+Enter for newline</span>
        </p>
      </div>
    </div>
  );
}
