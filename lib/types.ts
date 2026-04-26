export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

// Legacy type kept for residual references
export interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  actionText?: string;
  type: 'action' | 'insight' | 'link';
}

export type SuggestionType =
  | 'Question'
  | 'Answer'
  | 'Fact-check'
  | 'Clarifier'
  | 'Talking Point'
  | 'Risk'
  | 'Follow-up'
  | 'Summary'
  | 'Action';

export interface AISuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  preview: string;
  whyNow: string;
}

export interface SuggestionBatch {
  id: string;
  createdAt: string;
  suggestions: AISuggestion[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface AppSettings {
  groqApiKey: string;
  liveSuggestionPrompt: string;
  detailedAnswerPrompt: string;
  directChatPrompt: string;
  liveSuggestionContextWindow: number;
  detailedAnswerContextWindow: number;
  chatContextWindow: number;
  audioChunkDurationSeconds: number;
  suggestionTemperature: number;
  chatTemperature: number;
}
