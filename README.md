# TwinMind Live Suggestions Assignment

A browser-based live meeting copilot that transcribes microphone audio in real time, generates contextual suggestions powered by Groq AI, and provides a conversational chat interface grounded in the live transcript.

---

## Overview

| Feature | Description |
|---|---|
| 🎙️ Live Transcription | Records microphone audio and transcribes it every 30 seconds using Groq Whisper Large V3 |
| 💡 Live Suggestions | Generates exactly 3 contextual suggestions after each transcript chunk |
| 💬 Detailed Answers | Clicking any suggestion produces a structured, grounded answer in the chat panel |
| 🤖 Direct Chat | Ask free-form questions; the copilot answers using transcript context + chat history |
| 📤 Session Export | Downloads the full session as a timestamped JSON file (no API key included) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Audio capture | Browser `MediaRecorder` API |
| Transcription | Groq — `whisper-large-v3` |
| Suggestions & Chat | Groq — `openai/gpt-oss-120b` |
| State | React `useState` / `useRef` + `localStorage` |
| Deployment | Vercel (recommended) |

---

## Setup

### Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier available)

### Install and run

```bash
# 1. Clone the repo
git clone (https://github.com/mansii-28/twinmind-live-suggestions.git)
cd twinmind-live-suggestions

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Configure your API key

1. Click **Settings** in the top-right corner
2. Paste your Groq API key into the **Groq API Key** field
3. Click **Save** — the key is stored in `localStorage` and never sent anywhere except directly to the Groq API

---

## How It Works

### Recording pipeline

```
Microphone → MediaRecorder (timeslice mode)
         → WebM blob every 30s
         → POST /api/transcribe (Groq Whisper Large V3)
         → Transcript chunk appended to panel
         → POST /api/suggestions (Groq GPT-OSS 120B)
         → 3 suggestions rendered in Live Suggestions panel
```

When you click **Stop Recording**, the final partial audio chunk is also transcribed before the session fully stops.

### Suggestion pipeline

- Uses the last **N** transcript chunks (configurable via `liveSuggestionContextWindow`)
- Model is instructed to return exactly 3 suggestions as strict JSON
- Each suggestion includes:
  - **Type** — Question, Answer, Clarifier, Talking Point, Fact-check, Risk, Follow-up, Summary, or Action
  - **Title** — A short, scannable headline
  - **Preview** — 2–4 sentences grounded in the transcript
  - **Why now** — A short reason this suggestion is relevant at this moment

### Detailed answers (suggestion click)

- Clicking a suggestion card adds a user turn to the chat and calls `POST /api/chat` with `mode: "suggestion"`
- Uses `settings.detailedAnswerPrompt` as the system prompt
- Includes the last `detailedAnswerContextWindow` transcript chunks for context
- Returns a structured answer: explanation, suggested wording, risks/caveats, next steps

### Direct chat

- Typing in the chat input and pressing **Enter** calls `POST /api/chat` with `mode: "direct"`
- Uses `settings.directChatPrompt` as the system prompt
- Includes the last `chatContextWindow` transcript chunks + recent chat history
- If no transcript exists yet, the assistant answers generally and explains it has no meeting context

---

## Settings Reference

All settings are persisted in `localStorage` under the key `twinmind_settings`.

| Setting | Default | Description |
|---|---|---|
| `groqApiKey` | `""` | Your Groq API key — never exported or hard-coded |
| `audioChunkDurationSeconds` | `30` | Duration of each MediaRecorder timeslice |
| `liveSuggestionPrompt` | Built-in | System prompt for the suggestions API |
| `liveSuggestionContextWindow` | `8` | Number of recent transcript chunks fed to suggestions |
| `suggestionTemperature` | `0.45` | Groq temperature for suggestion generation |
| `detailedAnswerPrompt` | Built-in | System prompt for detailed suggestion answers |
| `detailedAnswerContextWindow` | `20` | Number of transcript chunks for detailed answers |
| `directChatPrompt` | Built-in | System prompt for direct chat questions |
| `chatContextWindow` | `20` | Number of transcript chunks for direct chat |
| `chatTemperature` | `0.35` | Groq temperature for chat responses |

> **Tip:** Reduce `audioChunkDurationSeconds` to `5`–`10` for faster feedback during testing. The minimum viable chunk size is ~25 KB (~5 seconds of speech).

---

## Session Export

Click **Export** in the top bar at any time to download:

```
twinmind-session-YYYY-MM-DD-HH-mm.json
```

The exported file contains:

```json
{
  "app": "TwinMind Live Suggestions Assignment",
  "exportedAt": "<ISO timestamp>",
  "session": {
    "startedAt": "<earliest event timestamp>",
    "endedAt": "<current timestamp>"
  },
  "transcriptChunks": [ { "id", "speaker", "text", "timestamp" } ],
  "suggestionBatches": [
    {
      "id", "createdAt",
      "suggestions": [ { "id", "type", "title", "preview", "whyNow" } ]
    }
  ],
  "chatHistory": [ { "id", "sender", "text", "timestamp" } ],
  "settings": { "... all settings except groqApiKey ..." }
}
```

> The Groq API key is **never** included in the export.

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/transcribe` | POST | Receives a WebM audio blob + API key, returns transcript text |
| `/api/suggestions` | POST | Receives transcript chunks + settings, returns 3 suggestions |
| `/api/chat` | POST | Receives message or clicked suggestion + context, returns assistant reply |

All routes validate inputs and return structured errors. Audio chunks below 25 KB or flagged by Groq as too short are silently skipped — the app continues recording without showing an error state.

---

## Deployment (Vercel)

```bash
# Build and verify locally first
npm run build

# Deploy via Vercel CLI
npx vercel
```

Or connect the GitHub repo to [vercel.com](https://vercel.com) for automatic deploys.

> **No environment variables are required** — the Groq API key is always provided by the user in-browser via the Settings modal.

---

## Design Tradeoffs

| Decision | Rationale |
|---|---|
| No database / login | The assignment does not require persistence; `localStorage` is sufficient for settings |
| MediaRecorder timeslice mode | Produces finalized WebM blobs automatically every N seconds, avoiding manual `requestData()` complexity |
| 30-second default chunk | Matches the assignment window; gives Whisper enough audio to transcribe accurately |
| Final chunk on stop | When the user stops recording, the last partial segment is still transcribed before cleanup |
| API key in-browser | Avoids requiring a server-side `.env`; the key goes directly from browser → Groq, never stored server-side |
| `openai/gpt-oss-120b` | Specified in the assignment; accessed via Groq's OpenAI-compatible endpoint |

---

## Known Limitations

- **Microphone only** — The `MediaRecorder` API captures the device microphone. System audio (e.g., other participants in a Zoom call) is not captured unless you use a virtual audio device or browser extension that routes system audio to a virtual mic.
- **Browser permission required** — The user must grant microphone access. If denied, a friendly alert is shown.
- **Very short recordings** — Blobs smaller than ~5 KB after stopping are silently skipped. Speak for at least 2–3 seconds before stopping to ensure the final chunk is large enough to transcribe.
- **No speaker diarization** — All transcript entries are labelled "Speaker". Multi-speaker diarization would require a separate service.
- **No streaming** — Transcription and suggestions are batch-processed per chunk, not streamed word-by-word.

---

## Project Structure

```
twinmind-live-suggestions/
├── app/
│   ├── page.tsx                  # Main page — all state, recording lifecycle, export
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── transcribe/route.ts   # Groq Whisper transcription
│       ├── suggestions/route.ts  # Groq GPT-OSS 120B suggestions
│       └── chat/route.ts         # Groq GPT-OSS 120B chat (direct + suggestion modes)
├── components/
│   ├── TopBar.tsx                # Recording controls, export, settings
│   ├── TranscriptPanel.tsx       # Live transcript scroll panel
│   ├── SuggestionsPanel.tsx      # Live suggestions with batch history
│   ├── ChatPanel.tsx             # Copilot chat with input
│   └── SettingsModal.tsx         # Settings form
└── lib/
    ├── types.ts                  # Shared TypeScript interfaces
    └── defaults.ts               # Default settings and initial state
```
