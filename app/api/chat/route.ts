import { NextRequest, NextResponse } from 'next/server';
import { AppSettings, AISuggestion, ChatMessage, TranscriptEntry } from '@/lib/types';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

interface ChatRequestBody {
  apiKey: string;
  mode: 'direct' | 'suggestion';
  message?: string;
  clickedSuggestion?: AISuggestion;
  transcriptChunks?: TranscriptEntry[];
  chatHistory?: ChatMessage[];
  settings?: AppSettings;
}

export async function POST(request: NextRequest) {
  try {
    const {
      apiKey,
      mode,
      message,
      clickedSuggestion,
      transcriptChunks = [],
      chatHistory = [],
      settings = {} as AppSettings,
    } = await request.json() as ChatRequestBody;



    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Groq API key' }, { status: 400 });
    }

    // ─── Build transcript context ─────────────────────────────────────────────
    const contextWindow = mode === 'suggestion'
      ? (settings?.detailedAnswerContextWindow ?? 20)
      : (settings?.chatContextWindow ?? 20);

    const transcriptContext = transcriptChunks
      .filter((c) => c.text?.trim().length > 0)
      .slice(-contextWindow)
      .map((c) => `[${c.speaker}]: ${c.text}`)
      .join('\n') || null;

    // ─── Mode: direct chat ────────────────────────────────────────────────────
    if (mode === 'direct') {
      if (!message || !message.trim()) {
        return NextResponse.json({ error: 'Empty user message' }, { status: 400 });
      }

      const systemPrompt = settings?.directChatPrompt ||
        "You are a helpful meeting copilot. Answer the user's question concisely and helpfully.";

      const systemContent = transcriptContext
        ? `${systemPrompt}\n\nRecent meeting transcript:\n${transcriptContext}`
        : `${systemPrompt}\n\n(No live transcript is available yet — answer generally if possible.)`;

      const historyMessages = chatHistory
        .filter((m) => m.id !== 'welcome')
        .slice(-(settings?.chatContextWindow ?? 20))
        .map((m) => ({
          role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text,
        }));

      const messages = [
        { role: 'system' as const, content: systemContent },
        ...historyMessages,
        { role: 'user' as const, content: message.trim() },
      ];

      const groqResponse = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, temperature: settings?.chatTemperature ?? 0.35, messages }),
      });

      const rawText = await groqResponse.text();

      if (!groqResponse.ok) {
        console.error('[chat/direct] Groq error:', rawText);
        return NextResponse.json(
          { error: `Groq API Error: ${groqResponse.status} ${groqResponse.statusText}`, details: rawText },
          { status: groqResponse.status }
        );
      }

      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(rawText); }
      catch { return NextResponse.json({ error: 'Invalid JSON from Groq', details: rawText }, { status: 500 }); }

      const content = (parsed?.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content?.trim() ?? '';
      if (!content) return NextResponse.json({ error: 'Empty response from Groq' }, { status: 500 });

      return NextResponse.json({
        message: { id: `assistant-${Date.now()}`, sender: 'assistant', text: content, timestamp: new Date().toISOString() },
      });
    }

    // ─── Mode: suggestion (detailed answer) ───────────────────────────────────
    if (mode === 'suggestion') {
      if (!clickedSuggestion) {
        return NextResponse.json({ error: 'Missing clickedSuggestion for suggestion mode' }, { status: 400 });
      }

      const systemPrompt = settings?.detailedAnswerPrompt ||
        'You are a helpful meeting copilot. Provide a detailed, structured, actionable response grounded in the transcript context.';

      const userPrompt =
        `The user clicked on this meeting suggestion:\n` +
        `Type: ${clickedSuggestion.type}\n` +
        `Title: ${clickedSuggestion.title}\n` +
        `Preview: ${clickedSuggestion.preview}\n` +
        `Why Now: ${clickedSuggestion.whyNow ?? ''}\n\n` +
        (transcriptContext ? `Recent meeting transcript:\n${transcriptContext}\n\n` : '') +
        `Provide a detailed structured answer that includes:\n` +
        `1. A clear explanation of why this is relevant\n` +
        `2. Suggested wording or talking points the speaker could use\n` +
        `3. Any risks or caveats to be aware of\n` +
        `4. Concrete next steps or action items\n\n` +
        `Use bullet points where helpful. Be concise but thorough.`;

      const groqResponse = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          temperature: settings?.chatTemperature ?? 0.35,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        }),
      });

      const rawText = await groqResponse.text();

      if (!groqResponse.ok) {
        console.error('[chat/suggestion] Groq error:', rawText);
        return NextResponse.json(
          { error: `Groq API Error: ${groqResponse.status} ${groqResponse.statusText}`, details: rawText },
          { status: groqResponse.status }
        );
      }

      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(rawText); }
      catch { return NextResponse.json({ error: 'Invalid JSON from Groq', details: rawText }, { status: 500 }); }

      const content = (parsed?.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content?.trim() ?? '';
      if (!content) return NextResponse.json({ error: 'Empty response from Groq' }, { status: 500 });

      return NextResponse.json({
        message: { id: `assistant-${Date.now()}`, sender: 'assistant', text: content, timestamp: new Date().toISOString() },
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });

  } catch (error) {
    console.error('[chat] Route error:', error);
    return NextResponse.json({ error: 'Internal chat error' }, { status: 500 });
  }
}
