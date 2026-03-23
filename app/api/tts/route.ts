import { NextRequest, NextResponse } from "next/server";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = "af_heart", speed = 1.0, lang = "en-us" } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const response = await fetch(`${PYTHON_BACKEND_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, speed, lang }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TTS API] Python backend error:", errorText);
      return NextResponse.json(
        { error: "TTS service unavailable", detail: errorText },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("[TTS API] Error:", error);
    return NextResponse.json(
      { error: "TTS service unavailable. Make sure the Python backend is running." },
      { status: 503 }
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/health`);
    if (response.ok) {
      return NextResponse.json({ status: "ok", tts: "kokoro" });
    }
    return NextResponse.json({ status: "offline" }, { status: 503 });
  } catch {
    return NextResponse.json({ status: "offline" }, { status: 503 });
  }
}
