import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const audioFile = formData.get("audio");
    const apiKey = formData.get("apiKey");



    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "Missing Groq API key" },
        { status: 400 }
      );
    }

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "Missing audio file" },
        { status: 400 }
      );
    }

    if (audioFile.size < 25000) {
      console.warn('Transcribe: audio chunk too small, skipping:', audioFile.size);
      return NextResponse.json(
        { error: 'Audio chunk too small; skipped', skipped: true },
        { status: 200 }
      );
    }

    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, audioFile.name || "audio.webm");
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("response_format", "json");

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: groqFormData,
      }
    );

    const rawText = await groqResponse.text();

    if (!groqResponse.ok) {
      const errorText = rawText.toLowerCase();
      console.error('Groq transcription error status:', groqResponse.status, '| body:', rawText);

      // Known non-fatal errors — return skipped:true so the frontend continues
      const isSkippable =
        errorText.includes('audio file is too short') ||
        errorText.includes('could not process file') ||
        errorText.includes('minimum audio length');

      if (isSkippable) {
        console.warn('Groq: skippable audio error, continuing without transcript chunk.');
        return NextResponse.json(
          { error: 'Invalid or too-short audio chunk skipped', skipped: true },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          error: `Groq API Error: ${groqResponse.status} ${groqResponse.statusText}`,
          details: rawText,
        },
        { status: groqResponse.status }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON returned by Groq", details: rawText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      text: parsed.text || "",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Transcription route error:", error);
    return NextResponse.json(
      { error: "Internal transcription error" },
      { status: 500 }
    );
  }
}
