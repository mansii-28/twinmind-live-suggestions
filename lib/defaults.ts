import { ChatMessage, AppSettings, AISuggestion } from './types';

// Use a fixed compile-time ISO string to avoid SSR/client hydration mismatch
const BOOT_TIME = '2025-01-01T00:00:00.000Z';

export const mockChat: ChatMessage[] = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: 'Hello! I am TwinMind, your live meeting copilot. Start recording and I will generate live suggestions from the conversation.',
    timestamp: BOOT_TIME,
  },
];

export const fallbackSuggestions: AISuggestion[] = [
  {
    id: 'fallback-1',
    type: 'Summary',
    title: 'Awaiting transcript context',
    preview: 'Start recording to generate live, AI-powered suggestions grounded in the conversation.',
    whyNow: 'No transcript available yet.',
  },
  {
    id: 'fallback-2',
    type: 'Action',
    title: 'Check your Groq API key',
    preview: 'Make sure your Groq API key is configured in Settings so suggestions can be generated.',
    whyNow: 'Required for all AI features.',
  },
  {
    id: 'fallback-3',
    type: 'Talking Point',
    title: 'Keep speaking naturally',
    preview: 'TwinMind works best with natural conversation. Suggestions update every transcript chunk.',
    whyNow: 'Ongoing recording produces the most useful context.',
  },
];

export const defaultSettings: AppSettings = {
  groqApiKey: '',
  liveSuggestionPrompt:
    `You are a real-time meeting copilot. Your job is to surface the most useful next assistance while the conversation is happening.

Given the recent transcript, generate exactly 3 suggestions. Each suggestion must be grounded only in the transcript and useful right now.

Choose a varied mix from:
- Question: a smart question the user can ask
- Answer: a concise answer to something just raised
- Clarifier: missing context to clarify
- Talking Point: something useful to mention
- Risk: a concern or caveat
- Action: a concrete next step
- Follow-up: something to revisit
- Summary: a brief useful recap
- Fact-check: a claim that may need verification

Return strict JSON only:
{
  "suggestions": [
    {
      "type": "Question|Answer|Fact-check|Clarifier|Talking Point|Risk|Follow-up|Summary|Action",
      "title": "short, specific title",
      "preview": "2-3 sentences that are useful even if the card is not clicked",
      "why_now": "one short sentence explaining why this matters now"
    }
  ]
}

Rules:
- Exactly 3 suggestions.
- No markdown.
- No generic advice.
- Do not mention being an AI.
- Do not invent facts not supported by the transcript.
- Make the 3 suggestions meaningfully different.
- Prefer suggestions that help the user sound prepared, clear, and useful in the meeting.
- If the transcript is thin, focus on clarifying questions and setup steps.`,
  detailedAnswerPrompt:
    `You are a real-time meeting copilot. The user clicked a live suggestion and wants a detailed, practical answer they can use during the meeting.

Use the transcript context and clicked suggestion. Stay grounded in what was said. If information is missing, say what is missing and provide a good way to ask for it.

Structure the answer with clear sections:
- Why this matters
- Suggested wording
- Next step
- Risk or caveat, if relevant

Rules:
- Be concise but useful.
- Avoid raw markdown symbols like ** unless the UI will render them properly.
- Do not over-explain.
- Do not invent unsupported facts.
- Make the answer immediately usable in a live conversation.
- Include suggested wording the user can say out loud.`,
  directChatPrompt:
    `You are a meeting copilot answering questions about the current live conversation.

Use:
- recent transcript context
- chat history
- the user’s direct question

Rules:
- Be concise and practical.
- Ground your answer in the transcript when available.
- If there is no transcript context, say that clearly and answer generally if possible.
- If the user asks for wording, provide polished wording they can say.
- If the user asks for summary, provide a clean meeting summary with decisions, action items, risks, and next steps when available.
- Avoid raw markdown artifacts.`,
  liveSuggestionContextWindow: 8,
  detailedAnswerContextWindow: 20,
  chatContextWindow: 20,
  audioChunkDurationSeconds: 30,
  suggestionTemperature: 0.45,
  chatTemperature: 0.35,
};
