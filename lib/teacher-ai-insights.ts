import { truncatePlainText } from "@/lib/utils/text";

function stripMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

export type TeacherInsightInput = {
  studentName: string;
  mathAvgPct: number | null;
  scienceAvgPct: number | null;
  /** Exact narrative from student dashboard Math AI feedback (quiz_subject_feedback_cache). */
  mathNarrative: string | null;
  /** Exact narrative from student dashboard Science AI feedback. */
  scienceNarrative: string | null;
};

/** Short excerpt from dashboard narrative for teacher-facing fallback (no technical labels). */
function teacherFriendlyExcerpt(narrative: string, maxLen: number): string {
  const plain = stripMd(narrative).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  const m = plain.match(/^[^.!?]+[.!?]?/);
  const first = m ? m[0].trim() : plain;
  if (first.length <= maxLen + 50) {
    return truncatePlainText(first, maxLen);
  }
  return truncatePlainText(plain, maxLen);
}

/**
 * Plain-language coaching when Ollama is unavailable. Avoids internal analytics
 * phrasing (snapshots, model confidence, cumulative model, etc.).
 */
export function buildTeacherFriendlyFallback(
  input: TeacherInsightInput
): string {
  const name = input.studentName;
  const m = input.mathAvgPct;
  const s = input.scienceAvgPct;
  const mLabel = m == null ? "no math quiz data yet" : `${Math.round(m)}%`;
  const sLabel = s == null ? "no science quiz data yet" : `${Math.round(s)}%`;
  const math = (input.mathNarrative ?? "").trim();
  const sci = (input.scienceNarrative ?? "").trim();

  if (!math && !sci) {
    return truncatePlainText(
      `${name} has not completed enough Smart Quizzes in Math and Science yet. Ask them to take at least one quiz in each subject. After that, you will see coaching notes here that align with the AI feedback on their dashboard.`,
      950
    );
  }

  const parts: string[] = [];
  parts.push(
    `${name} shows ${mLabel} in Math and ${sLabel} in Science. The notes below reflect the same themes as their Math and Science feedback on the student dashboard.`
  );

  if (math) {
    const ex = teacherFriendlyExcerpt(math, 220);
    parts.push(
      `Math: ${ex} Plan a short check-in and one focused practice set on the ideas they still find difficult.`
    );
  }
  if (sci) {
    const ex = teacherFriendlyExcerpt(sci, 220);
    parts.push(
      `Science: ${ex} Follow up with a few discussion questions or a short quiz on the same concepts.`
    );
  }

  if (m != null && s != null) {
    const gap = Math.abs(m - s);
    if (gap > 12) {
      if (m < s) {
        parts.push(
          `This week, consider giving Math a little more attention than Science until their next quiz.`
        );
      } else {
        parts.push(
          `This week, consider giving Science a little more attention than Math until their next quiz.`
        );
      }
    } else {
      parts.push(
        `Math and Science look similar in strength. Alternate short practice between the two areas above.`
      );
    }
  }

  return truncatePlainText(parts.join(" "), 1700);
}

/**
 * Calls Ollama to turn the student's Math + Science dashboard narratives into
 * medium-length, actionable guidance for the teacher.
 */
export async function generateTeacherAiInsights(
  input: TeacherInsightInput
): Promise<string> {
  const fallback = buildTeacherFriendlyFallback(input);
  const math = (input.mathNarrative ?? "").trim();
  const sci = (input.scienceNarrative ?? "").trim();

  if (!math && !sci) {
    return fallback;
  }

  const mathBlock = math
    ? stripMd(math)
    : "(No Math AI feedback text yet. Student may need more math quiz sessions.)";
  const sciBlock = sci
    ? stripMd(sci)
    : "(No Science AI feedback text yet. Student may need more science quiz sessions.)";

  const prompt = `You help classroom teachers support individual students.

Below is the text the student sees on their dashboard under "Math AI Feedback" and "Science AI Feedback" (from their quiz activity). Use ONLY this content plus the averages to infer needs. Do not invent scores or topics not supported by the text.

Student: ${input.studentName}
Math average (all quiz sessions): ${input.mathAvgPct == null ? "N/A" : `${Math.round(input.mathAvgPct)}%`}
Science average (all quiz sessions): ${input.scienceAvgPct == null ? "N/A" : `${Math.round(input.scienceAvgPct)}%`}

--- MATH AI FEEDBACK (student dashboard) ---
${mathBlock}

--- SCIENCE AI FEEDBACK (student dashboard) ---
${sciBlock}

Write ONE coaching note for the teacher (not bullet labels in the output):
- Brief opening on how Math vs Science performance compares (use the averages).
- For each subject that has real feedback above, name the main learning needs implied by that text.
- Give 3–5 concrete teacher actions (assignments, one-to-one check-in, practice focus, pacing) tied to those needs.
- Tone: professional, supportive, specific. No markdown headings. Do not use phrases like "model confidence", "cumulative model", "snapshot", or "evidence block".

Target length: medium (about 170–240 words). Do not copy the student-facing paragraphs verbatim.`;

  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt,
        stream: false,
        options: { temperature: 0.42, num_predict: 520 },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) return truncatePlainText(fallback, 2000);
    const data = (await res.json()) as { response?: string };
    const text = (data.response ?? "").trim();
    if (!text) return truncatePlainText(fallback, 2000);
    return truncatePlainText(text, 2200);
  } catch {
    return truncatePlainText(fallback, 2000);
  }
}
