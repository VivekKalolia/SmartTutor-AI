import { NextRequest, NextResponse } from "next/server";

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, newInteraction } = body;

    if (!studentId || !newInteraction) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, newInteraction" },
        { status: 400 }
      );
    }

    const topic =
      typeof newInteraction.concept === "string"
        ? newInteraction.concept
        : newInteraction.topic || "numbers";
    const correct = newInteraction.correct === 1 ? 1 : 0;

    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/dkt/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          topic,
          correct,
          subject: String(body.subject || "math"),
          concept:
            newInteraction.kc_id ??
            newInteraction.kcId ??
            newInteraction.concept,
          qid:
            newInteraction.q_index ??
            newInteraction.qid ??
            newInteraction.questionIndex,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return NextResponse.json(result);
      }
    } catch {    }

    // Fallback when Python backend is not running
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
      num_interactions: 1,
    };

    return NextResponse.json(fallbackState);
  } catch (error) {
    console.error("Error in update-state endpoint:", error);
    return NextResponse.json(
      { error: "Failed to update knowledge state", details: String(error) },
      { status: 500 }
    );
  }
}
