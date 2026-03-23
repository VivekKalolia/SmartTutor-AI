"use client";

import { useEffect, useState, useMemo } from "react";
import TeacherLayout from "@/components/teacher-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Search, Sparkles, Loader2 } from "lucide-react";

const MATH_COLOR = "#1E3A8A";
const SCIENCE_COLOR = "#059669";

type StudentRow = {
  id: string;
  username: string;
  name: string;
  grade: string | null;
  mathScore: number | null;
  scienceScore: number | null;
  subjects: string[];
  helpSummary: string | null;
  createdAt: string;
};

export default function StudentManagement() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [insightLoadingIds, setInsightLoadingIds] = useState<Set<string>>(
    new Set()
  );
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStudents() {
      try {
        const res = await fetch("/api/teacher/students");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.students)) {
            setStudents(data.students);
          }
        }
      } catch (e) {
        console.error("[Teacher Students] Fetch error:", e);
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    }

    async function loadInsightsProgressive() {
      try {
        const res = await fetch("/api/teacher/students/insights");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const cached =
          data.insights && typeof data.insights === "object"
            ? (data.insights as Record<string, string>)
            : {};
        setInsights(cached);

        const pending: string[] = Array.isArray(data.pendingGeneration)
          ? data.pendingGeneration
          : [];
        if (pending.length === 0) return;

        setInsightLoadingIds(new Set(pending));

        const genRes = await fetch("/api/teacher/students/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: pending }),
        });
        if (!genRes.ok) {
          if (!cancelled) setInsightLoadingIds(new Set());
          return;
        }
        const genData = await genRes.json();
        if (cancelled) return;
        if (genData.insights && typeof genData.insights === "object") {
          setInsights((prev) => ({
            ...prev,
            ...(genData.insights as Record<string, string>),
          }));
        }
        setInsightLoadingIds(new Set());
      } catch (e) {
        console.error("[Teacher Students] Insights error:", e);
        if (!cancelled) setInsightLoadingIds(new Set());
      }
    }

    void loadStudents();
    void loadInsightsProgressive();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        (s.grade && s.grade.toLowerCase().includes(q))
    );
  }, [students, search]);

  return (
    <TeacherLayout>
      <div className="flex justify-center">
        <div className="w-full max-w-4xl space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Students</h1>
              <p className="text-muted-foreground mt-2">
                All students in the system and their recent quiz performance
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or grade..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Students</CardTitle>
              <CardDescription>
                {studentsLoading
                  ? "Loading..."
                  : `${filtered.length} student${filtered.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Loading students…
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No students found.
                </p>
              ) : (
                <div className="space-y-4">
                  {filtered.map((student) => (
                    <div
                      key={student.id}
                      className="p-4 border rounded-lg space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{student.name}</p>
                          {student.grade ? (
                            <p className="text-xs text-muted-foreground">
                              {student.grade}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Card className="bg-[#1E3A8A]/10 border-[#1E3A8A]/20">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <span
                                className="text-sm font-medium"
                                style={{ color: MATH_COLOR }}
                              >
                                Math
                              </span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: MATH_COLOR }}
                              >
                                {student.mathScore != null
                                  ? `${student.mathScore}%`
                                  : "-"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Average across completed math quizzes
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#059669]/10 border-[#059669]/20">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <span
                                className="text-sm font-medium"
                                style={{ color: SCIENCE_COLOR }}
                              >
                                Science
                              </span>
                              <span
                                className="text-sm font-bold"
                                style={{ color: SCIENCE_COLOR }}
                              >
                                {student.scienceScore != null
                                  ? `${student.scienceScore}%`
                                  : "-"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Average across completed science quizzes
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20">
                        <CardHeader className="py-3 px-4 pb-0">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            AI Insights
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Actionable coaching steps based on student quiz
                            performance
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-2 pb-4 px-4">
                          {insightLoadingIds.has(student.id) ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              <span>Generating AI insights…</span>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {insights[student.id] ??
                                student.helpSummary ??
                                "No quiz data yet. AI insights will appear here once the student completes a quiz."}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TeacherLayout>
  );
}
