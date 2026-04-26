'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import TranscriptPanel, { AppStatus } from '@/components/TranscriptPanel';
import SuggestionsPanel from '@/components/SuggestionsPanel';
import ChatPanel from '@/components/ChatPanel';
import SettingsModal from '@/components/SettingsModal';
import { TranscriptEntry, AppSettings, SuggestionBatch, AISuggestion, ChatMessage } from '@/lib/types';
import { exportSession } from '@/lib/sessionExport';
import { defaultSettings, mockChat } from '@/lib/defaults';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const [appStatus, setAppStatus] = useState<AppStatus>('Ready');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);

  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChat);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | undefined>(undefined);

  const [stoppedBanner, setStoppedBanner] = useState(false);
  const [noTranscriptToast, setNoTranscriptToast] = useState(false);
  const noTranscriptToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const settingsRef = useRef<AppSettings>(defaultSettings);
  const chatMessagesRef = useRef<ChatMessage[]>(mockChat);

  // true  → actively recording regular chunks
  const isRecordingRef = useRef(false);
  // true  → stop has been triggered; we're waiting for the final ondataavailable
  const isStoppingRef = useRef(false);
  // one-time token: true → process the next chunk as the final one and consume
  const shouldProcessFinalChunkRef = useRef(false);

  // Timeout refs for error recovery and banners
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { transcriptRef.current = transcriptEntries; }, [transcriptEntries]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);

  useEffect(() => {
    const saved = localStorage.getItem('twinmind_settings');
    if (saved) {
      try {
        const parsed = { ...defaultSettings, ...JSON.parse(saved) };
        setTimeout(() => {
          setSettings(parsed);
          settingsRef.current = parsed;
        }, 0);
      } catch {
        // Silently fail if settings were corrupt
      }
    }
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      isStoppingRef.current = false;
      shouldProcessFinalChunkRef.current = false;
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      if (noTranscriptToastTimerRef.current) clearTimeout(noTranscriptToastTimerRef.current);
    };
  }, []);

  // ─── Suggestions ────────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (
    chunks: TranscriptEntry[],
    automatic = false
  ) => {
    const s = settingsRef.current;
    // Must have API key and at least one chunk with real text
    const realChunks = chunks.filter((c) => c.text?.trim().length > 0);
    if (!s.groqApiKey || realChunks.length === 0) return;
    // Auto-triggered only while recording
    if (automatic && !isRecordingRef.current) return;

    setIsSuggestionsLoading(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: s.groqApiKey, transcriptChunks: chunks, settings: s }),
      });
      const data = await res.json();
      if (!res.ok || !data.batch) {
        return;
      }
      setSuggestionBatches((prev) => [...prev, data.batch as SuggestionBatch]);
    } catch (err) {
      console.error('fetchSuggestions error:', err);
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, []);

  const handleRefreshSuggestions = () => {
    const realChunks = transcriptRef.current.filter((c) => c.text?.trim().length > 0);
    if (realChunks.length === 0) {
      // Show a brief friendly message instead of calling the API
      setNoTranscriptToast(true);
      if (noTranscriptToastTimerRef.current) clearTimeout(noTranscriptToastTimerRef.current);
      noTranscriptToastTimerRef.current = setTimeout(() => setNoTranscriptToast(false), 3500);
      return;
    }
    fetchSuggestions(transcriptRef.current, false);
  };

  // ─── Export session ──────────────────────────────────────────────────────────

  const handleExport = () => {
    exportSession(
      transcriptRef.current,
      suggestionBatches,
      chatMessages,
      settingsRef.current
    );
  };

  // ─── Suggestion click → /api/chat ───────────────────────────────────────────

  const handleSuggestionClick = async (suggestion: AISuggestion) => {
    if (isChatLoading) return;
    const s = settingsRef.current;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: `${suggestion.title}: ${suggestion.preview}`,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);
    setActiveSuggestionId(suggestion.id);

    try {
      const payload = {
        apiKey: s.groqApiKey,
        mode: 'suggestion',
        clickedSuggestion: {
          id: suggestion.id,
          type: suggestion.type,
          title: suggestion.title,
          preview: suggestion.preview,
          whyNow: suggestion.whyNow || '',
        },
        transcriptChunks: transcriptRef.current,
        chatHistory: chatMessagesRef.current,
        settings: s,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.message) {
        console.error('Chat API error:', data.error || data);
        setChatMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: 'Sorry, I could not generate a detailed answer right now.',
          timestamp: new Date().toISOString(),
        }]);
        return;
      }
      setChatMessages((prev) => [...prev, data.message as ChatMessage]);
    } catch (err) {
      console.error('handleSuggestionClick chat error:', err);
      setChatMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        sender: 'assistant',
        text: 'An error occurred while generating the answer.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ─── Audio processing ────────────────────────────────────────────────────────

  const processAudioChunk = async (
    audioBlob: Blob,
    { isFinalChunk = false }: { isFinalChunk?: boolean } = {}
  ) => {
    // Regular chunks abort if recording has stopped; final chunks always proceed
    if (!isFinalChunk && !isRecordingRef.current) return;

    const s = settingsRef.current;
    if (!s.groqApiKey) {
      if (isFinalChunk) cleanupAfterStop();
      return;
    }

    // Final chunks that are too small can't be transcribed — skip silently
    if (isFinalChunk && audioBlob.size < 25000) {
      return; // cleanupAfterStop handled in finally
    }

    try {
      setAppStatus('Transcribing');

      const audioFile = new File([audioBlob], `chunk-${crypto.randomUUID()}.webm`, {
        type: audioBlob.type || 'audio/webm',
      });
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('apiKey', s.groqApiKey);

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });

      // For regular chunks, abort if stopped while in-flight
      if (!isFinalChunk && !isRecordingRef.current) return;

      const responseText = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { error: responseText || 'Unknown transcription error' };
      }

      // skipped:true means the chunk was too short/invalid — not a real error, continue silently
      if (data.skipped) {
        if (!isFinalChunk && isRecordingRef.current) setAppStatus('Recording');
        return; // cleanupAfterStop handled in finally for final chunks
      }

      if (!res.ok) {
        if (!isFinalChunk && isRecordingRef.current) {
          setAppStatus('Error');
          errorTimeoutRef.current = setTimeout(() => {
            if (isRecordingRef.current) setAppStatus('Recording');
          }, 3000);
        }
        return; // cleanupAfterStop called in finally for final chunks
      }

      // One last guard for regular chunks before mutating state
      if (!isFinalChunk && !isRecordingRef.current) return;

      const text = typeof data.text === 'string' ? data.text.trim() : '';
      const timestamp = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();

      if (text) {
        const newChunk: TranscriptEntry = {
          id: crypto.randomUUID(),
          speaker: 'Speaker',
          text,
          timestamp,
        };

        setTranscriptEntries((prev) => {
          if (!isFinalChunk && !isRecordingRef.current) return prev;
          const updated = [...prev, newChunk];
          transcriptRef.current = updated;
          if (isFinalChunk) {
            fetchSuggestions(updated, false); // always run for final chunk
          } else {
            fetchSuggestions(updated, true);  // auto (recording guard inside)
          }
          return updated;
        });
      }

      if (!isFinalChunk && isRecordingRef.current) setAppStatus('Recording');

    } catch {
      if (!isFinalChunk && isRecordingRef.current) {
        setAppStatus('Error');
        errorTimeoutRef.current = setTimeout(() => {
          if (isRecordingRef.current) setAppStatus('Recording');
        }, 3000);
      }
    } finally {
      // Always clean up if this was the final chunk
      if (isFinalChunk) cleanupAfterStop();
    }
  };

  // ─── Direct chat input ──────────────────────────────────────────────────────

  const handleDirectChat = async (text: string) => {
    const s = settingsRef.current;

    if (!s.groqApiKey) {
      setChatMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        sender: 'assistant',
        text: 'Please add your Groq API key in Settings to use the chat.',
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    // Append user message immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: s.groqApiKey,
          mode: 'direct',
          message: text.trim(),
          transcriptChunks: transcriptRef.current,
          chatHistory: chatMessagesRef.current,
          settings: s,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.message) {
        console.error('Direct chat API error:', data.error || data);
        setChatMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: data.error || 'Sorry, something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
        }]);
        return;
      }
      setChatMessages((prev) => [...prev, data.message as ChatMessage]);
    } catch (err) {
      console.error('handleDirectChat error:', err);
      setChatMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        sender: 'assistant',
        text: 'An error occurred. Please check your connection and try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ─── Recording ──────────────────────────────────────────────────────────────

  /**
   * Called after the final chunk is processed (or skipped) to tear everything down.
   */
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const cleanupAfterStop = useCallback(() => {
    isStoppingRef.current = false;
    shouldProcessFinalChunkRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;

    setAppStatus('Ready');
    setStoppedBanner(true);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setStoppedBanner(false), 3000);
  }, []);

  /**
   * Initiates stop: prevents new regular chunks, marks that we want the
   * final chunk, then calls recorder.stop() which emits the last ondataavailable.
   */
  const stopRecording = useCallback(() => {
    // Stop regular-chunk processing immediately
    isRecordingRef.current = false;
    isStoppingRef.current = true;
    shouldProcessFinalChunkRef.current = true; // allow exactly one final chunk

    // Cancel any in-flight error recovery timer
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }

    setAppStatus('Stopping');

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // → triggers final ondataavailable, then onstop
    } else {
      // Nothing to flush — clean up right away
      cleanupAfterStop();
    }
  }, [cleanupAfterStop]);

  const startRecording = useCallback(async () => {
    if (!settings.groqApiKey) {
      alert('Please set your Groq API Key in Settings first.');
      setIsSettingsOpen(true);
      return;
    }

    setTranscriptEntries([]);
    transcriptRef.current = [];
    setSuggestionBatches([]);
    setStoppedBanner(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      const timesliceMs = settingsRef.current.audioChunkDurationSeconds * 1000;

      recorder.ondataavailable = (event) => {
        const size = event.data?.size ?? 0;

        if (!event.data || size < 1000) {
          console.warn('Skipping empty chunk, size:', size);
          // If this was the final chunk but it's too small, still clean up
          if (shouldProcessFinalChunkRef.current) {
            shouldProcessFinalChunkRef.current = false;
            cleanupAfterStop();
          }
          return;
        }

        if (isRecordingRef.current) {
          // Regular periodic chunk — must meet size threshold
          if (size < 25000) {
            console.warn('Skipping small regular chunk, size:', size);
            return;
          }
          processAudioChunk(event.data, { isFinalChunk: false });
        } else if (shouldProcessFinalChunkRef.current) {
          // Final chunk from recorder.stop() — consume the token and process
          shouldProcessFinalChunkRef.current = false;
          // Final chunk can be smaller (may only cover a partial interval)
          if (size < 5000) {
            console.warn('Final chunk too small to transcribe, skipping:', size);
            cleanupAfterStop();
            return;
          }
          processAudioChunk(event.data, { isFinalChunk: true });
        }
        // else: neither recording nor stopping — fully discard
      };

      // Reset lifecycle flags before starting
      isRecordingRef.current = true;
      isStoppingRef.current = false;
      shouldProcessFinalChunkRef.current = false;
      recorder.start(timesliceMs);
      setAppStatus('Recording');

    } catch (err) {
      console.error('Microphone access error:', err);
      isRecordingRef.current = false;
      setAppStatus('Error');
      alert('Failed to access microphone. Please check browser permissions.');
    }
  }, [settings.groqApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRecording = () => {
    if (isRecordingRef.current || isStoppingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };



  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <TopBar
        onSettingsClick={() => setIsSettingsOpen(true)}
        isRecording={appStatus === 'Recording' || appStatus === 'Transcribing'}
        onToggleRecording={toggleRecording}
        onExport={handleExport}
        appStatus={appStatus}
      />

      {/* Stopped banner */}
      {stoppedBanner && (
        <div className="shrink-0 bg-slate-700 text-white text-xs text-center py-1.5 px-4">
          Recording stopped. No further audio will be processed.
        </div>
      )}

      {/* No transcript toast — shown when user clicks Refresh with no transcript */}
      {noTranscriptToast && (
        <div className="shrink-0 bg-amber-500 text-white text-xs text-center py-1.5 px-4">
          Start recording first to generate suggestions.
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          <section className="md:col-span-3 h-full min-h-0 flex flex-col overflow-hidden">
            <TranscriptPanel entries={transcriptEntries} status={appStatus} />
          </section>

          <section className="md:col-span-6 h-full min-h-0 flex flex-col overflow-hidden">
            <SuggestionsPanel
              batches={suggestionBatches}
              isLoading={isSuggestionsLoading}
              isChatLoading={isChatLoading}
              activeSuggestionId={activeSuggestionId}
              onRefresh={handleRefreshSuggestions}
              onSuggestionClick={handleSuggestionClick}
            />
          </section>

          <section className="md:col-span-3 h-full min-h-0 flex flex-col overflow-hidden">
            <ChatPanel
              messages={chatMessages}
              isLoading={isChatLoading}
              onSendMessage={handleDirectChat}
            />
          </section>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          const saved = localStorage.getItem('twinmind_settings');
          if (saved) {
            const parsed = { ...defaultSettings, ...JSON.parse(saved) };
            setSettings(parsed);
            settingsRef.current = parsed;
          }
        }}
      />
    </div>
  );
}
