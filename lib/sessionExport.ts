import { TranscriptEntry, SuggestionBatch, ChatMessage, AppSettings } from './types';

export function exportSession(
  transcript: TranscriptEntry[],
  suggestionBatches: SuggestionBatch[],
  chatHistory: ChatMessage[],
  settings: AppSettings
) {
  const now = new Date();

  // Find the earliest timestamp across all session data to mark the session start
  const allTimestamps = [
    ...transcript.map((c) => c.timestamp),
    ...suggestionBatches.map((b) => b.createdAt),
    ...chatHistory.map((m) => m.timestamp),
  ].filter(Boolean).sort();
  
  const startedAt = allTimestamps[0] ?? now.toISOString();

  // Omit the API key from the export for security
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { groqApiKey: _omit, ...safeSettings } = settings;

  const exportData = {
    app: 'TwinMind Live Suggestions Assignment',
    exportedAt: now.toISOString(),
    session: {
      startedAt,
      endedAt: now.toISOString(),
    },
    transcriptChunks: transcript.map((c) => ({
      id: c.id,
      speaker: c.speaker,
      text: c.text,
      timestamp: c.timestamp,
    })),
    suggestionBatches: suggestionBatches.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      suggestions: b.suggestions.map((sg) => ({
        id: sg.id,
        type: sg.type,
        title: sg.title,
        preview: sg.preview,
        whyNow: sg.whyNow ?? '',
      })),
    })),
    chatHistory: chatHistory.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp,
    })),
    settings: safeSettings,
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const pad = (n: number) => String(n).padStart(2, '0');
  const filename =
    `twinmind-session-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}-${pad(now.getMinutes())}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
