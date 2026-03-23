import { NextRequest, NextResponse } from "next/server";

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, interactionHistory, subject: subjRaw } = body;
    const subject =
      subjRaw === "science" || subjRaw === "math" ? subjRaw : "math";

    if (!studentId || !interactionHistory) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, interactionHistory" },
        { status: 400 }
      );
    }

    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/dkt/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          subject,
          interactions: interactionHistory.map(
            (i: {
              concept?: string | number;
              correct?: number;
              q_index?: number;
              qid?: number;
            }) => ({
              concept: i.concept ?? "numbers",
              correct: i.correct ?? 0,
              qid: i.q_index ?? i.qid ?? 1,
            })
          ),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return NextResponse.json(result);
      }
    } catch {    }

    const fallbackState = {
      student_id: studentId,
      mastery_per_kc: {
        algebra: 0.65,
        calculus: 0.65,
        geometry: 0.65,
        arithmetic: 0.65,
        numbers: 0.65,
      },
      recommended_kcs: ["calculus", "geometry"],
      overall_mastery: 0.65,
      num_interactions: interactionHistory?.length || 0,
    };

    return NextResponse.json(fallbackState);
  } catch (error) {
    console.error("Error in predict endpoint:", error);
    return NextResponse.json(
      { error: "Failed to predict knowledge state", details: String(error) },
      { status: 500 }
    );
  }
}
