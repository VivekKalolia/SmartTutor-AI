import { createHash } from "crypto";

/**
 * Stable hash of everything that feeds teacher AI insights for a student.
 * When quiz feedback cache or dashboard averages change, the hash changes
 * and insights should be regenerated.
 */
export function computeTeacherInsightSourceHash(params: {
  studentName: string | null;
  mathNarrative: string | null;
  scienceNarrative: string | null;
  mathComputedAt: string | null;
  scienceComputedAt: string | null;
  mathAvgPct: number | null;
  scienceAvgPct: number | null;
}): string {
  const ma = params.mathAvgPct;
  const sa = params.scienceAvgPct;
  const payload = JSON.stringify({
    n: (params.studentName ?? "").trim(),
    m: params.mathNarrative ?? "",
    s: params.scienceNarrative ?? "",
    mca: params.mathComputedAt ?? "",
    sca: params.scienceComputedAt ?? "",
    ma: ma == null ? null : Math.round(ma * 100) / 100,
    sa: sa == null ? null : Math.round(sa * 100) / 100,
  });
  return createHash("sha256").update(payload).digest("hex");
}
