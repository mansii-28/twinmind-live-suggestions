import { NextRequest, NextResponse } from 'next/server';
import { AppSettings, AISuggestion, TranscriptEntry } from '@/lib/types';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

interface SuggestionsRequestBody {
  apiKey: string;
  transcriptChunks: TranscriptEntry[];
  settings: AppSettings;
}

function makeFallback(index: number): AISuggestion {
  return {
    id: `fallback-${Date.now()}-${index}`,
    type: 'Summary',
    title: 'Context still loading',
    preview: 'Not enough transcript context yet to generate a meaningful suggestion.',
    whyNow: 'Generating suggestions as more audio is captured.',
  };
}

function normalizeToThree(raw: AISuggestion[]): AISuggestion[] {
  const sliced = raw.slice(0, 3);
  while (sliced.length < 3) {
    sliced.push(makeFallback(sliced.length));
  }
  return sliced;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SuggestionsRequestBody;
    const { apiKey, transcriptChunks, settings } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Groq API key' }, { status: 400 });
    }

    if (!transcriptChunks || transcriptChunks.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available for suggestions.' },
        { status: 400 }
      );
    }

    // Validate at least one chunk has non-empty text
    const realChunks = transcriptChunks.filter((c) => c.text?.trim().length > 0);
    if (realChunks.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available for suggestions.' },
        { status: 400 }
      );
    }

    const contextWindow = settings?.liveSuggestionContextWindow ?? 8;
    const contextChunks = realChunks.slice(-contextWindow);
    const transcriptText = contextChunks
      .map((c) => `[${new Date(c.timestamp).toLocaleTimeString()}] ${c.speaker}: ${c.text}`)
      .join('\n');

    const systemPrompt =
      settings?.liveSuggestionPrompt ||
      'You are a real-time meeting copilot. Generate exactly 3 suggestions based on the transcript. Return valid JSON only.';

    const userPrompt =
      `Recent transcript context:\n\n${transcriptText}\n\nReturn exactly 3 suggestions as strict JSON with this shape:\n` +
      `{"suggestions":[{"type":"Question|Answer|Fact-check|Clarifier|Talking Point|Risk|Follow-up|Summary|Action","title":"short title","preview":"2-4 sentence useful preview grounded in transcript","whyNow":"short reason this is useful now"}]}`;

    const requestBody = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: settings?.suggestionTemperature ?? 0.45,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    };

    const groqResponse = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await groqResponse.text();

    if (!groqResponse.ok) {
      console.error('[suggestions] Groq error raw response:', rawText);
      return NextResponse.json(
        {
          error: `Groq API Error: ${groqResponse.status} ${groqResponse.statusText}`,
          details: rawText,
        },
        { status: groqResponse.status }
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('[suggestions] Failed to parse Groq outer response:', rawText);
      return NextResponse.json({
        batch: {
          id: `batch-${Date.now()}`,
          createdAt: new Date().toISOString(),
          suggestions: normalizeToThree([]),
        },
      });
    }

    const content =
      (parsed?.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content ?? '';

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(content);
    } catch {
      console.error('[suggestions] Failed to parse suggestions content:', content);
      return NextResponse.json({
        batch: {
          id: `batch-${Date.now()}`,
          createdAt: new Date().toISOString(),
          suggestions: normalizeToThree([]),
        },
      });
    }

    const rawSuggestions = (result?.suggestions as Array<Record<string, string>>) ?? [];

    const suggestions: AISuggestion[] = normalizeToThree(
      rawSuggestions.map((s, i) => ({
        id: `ai-${Date.now()}-${i}`,
        type: (s.type ?? 'Summary') as AISuggestion['type'],
        title: s.title ?? 'Suggestion',
        preview: s.preview ?? '',
        whyNow: s.whyNow ?? s.why_now ?? '',
      }))
    );

    return NextResponse.json({
      batch: {
        id: `batch-${Date.now()}`,
        createdAt: new Date().toISOString(),
        suggestions,
      },
    });
  } catch (error) {
    console.error('[suggestions] Route error:', error);
    return NextResponse.json({ error: 'Internal suggestions error' }, { status: 500 });
  }
}
