"use client";

import { useEffect, useState } from "react";
import TeacherLayout from "@/components/teacher-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  BarChart3,
  Target,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

type TeacherStats = {
  role: string;
  totalStudents: number;
  averageMathScore: number | null;
  averageScienceScore: number | null;
  totalQuizzesTaken: number;
  chartStudents: {
    name: string;
    math: number;
    science: number;
    avgScore: number;
  }[];
  subjectDistribution: { subject: string; students: number; avgScore: number }[];
  classLearningBySubject: {
    math: { strongestTopic: string | null; weakestTopic: string | null };
    science: { strongestTopic: string | null; weakestTopic: string | null };
  };
};

export default function TeacherDashboard() {
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.role === "teacher") setStats(data);
      } catch (e) {
        console.error("[Teacher Dashboard] Stats error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = stats?.chartStudents ?? [];
  const subjectDistribution = stats?.subjectDistribution ?? [];
  const cl = stats?.classLearningBySubject;

  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview from real quiz data across all enrolled students
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading statistics…</p>
          </div>
        ) : !stats ? (
          <p className="text-sm text-muted-foreground">
            Could not load dashboard data.
          </p>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Students
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalStudents}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    In the database
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Average Math Score
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.averageMathScore != null
                      ? `${stats.averageMathScore}%`
                      : "-"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across students with math quizzes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Average Science Score
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.averageScienceScore != null
                      ? `${stats.averageScienceScore}%`
                      : "-"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across students with science quizzes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Quiz Sessions
                  </CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalQuizzesTaken}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Completed sessions (all students)
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Student Performance Overview</CardTitle>
                <CardDescription>
                  Per-student averages (0 if no quizzes in that subject yet)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No students yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="math" fill="#1E3A8A" name="Math" />
                      <Bar dataKey="science" fill="#059669" name="Science" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top performing students</CardTitle>
                  <CardDescription>
                    By combined math & science average (where available)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...chartData]
                      .filter((s) => s.avgScore > 0)
                      .sort((a, b) => b.avgScore - a.avgScore)
                      .slice(0, 5)
                      .map((student, idx) => (
                        <div
                          key={student.name}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">#{idx + 1}</Badge>
                            <span className="font-medium">{student.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Math: {student.math}%</span>
                            <span>Science: {student.science}%</span>
                            <span className="font-semibold text-primary">
                              {student.avgScore}%
                            </span>
                          </div>
                        </div>
                      ))}
                    {chartData.filter((s) => s.avgScore > 0).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No quiz averages yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Class averages by subject</CardTitle>
                  <CardDescription>
                    Mean score across students who took each subject
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={subjectDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avgScore" name="Average score %">
                        {subjectDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.subject === "Math" ? "#1E3A8A" : "#059669"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Learning statistics (class)</CardTitle>
                <CardDescription>
                  Strongest and weakest topics by aggregate performance on quiz
                  questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Math: strongest topic
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-semibold">
                        {cl?.math.strongestTopic ?? "-"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Math: weakest topic
                    </p>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="font-semibold text-red-600">
                        {cl?.math.weakestTopic ?? "-"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Science: strongest topic
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-semibold">
                        {cl?.science.strongestTopic ?? "-"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Science: weakest topic
                    </p>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="font-semibold text-red-600">
                        {cl?.science.weakestTopic ?? "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TeacherLayout>
  );
}
