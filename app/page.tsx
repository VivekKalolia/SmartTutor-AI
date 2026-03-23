"use client";

import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Brain,
  MessageSquare,
  CheckCircle2,
  Target,
  BarChart3,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import Link from "next/link";
import { Progress as MantineProgress } from "@mantine/core";
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
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
} from "recharts";

const MATH_COLOR = "#1E3A8A";
const SCIENCE_COLOR = "#059669";
const mathShades = ["#1E3A8A", "#3B5BA8", "#5A7CC6", "#789DE4", "#9BB5E8"];
const scienceShades = ["#059669", "#10B981", "#34D399", "#6EE7B7", "#A7F3D0"];

type QuizSession = {
  id: number;
  subject: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
};

type StudentStats = {
  role: string;
  sessions: QuizSession[];
  mathAverageScore: number | null;
  scienceAverageScore: number | null;
  totalQuizzes: number;
  topicAggregates: {
    math: Record<
      string,
      {
        correct: number;
        total: number;
        quizSessions: number;
        avgAcrossQuizzesPct: number;
      }
    >;
    science: Record<
      string,
      {
        correct: number;
        total: number;
        quizSessions: number;
        avgAcrossQuizzesPct: number;
      }
    >;
  };
  latestSession: {
    math: {
      pct: number;
      correctCount: number;
      total: number;
      at: string;
    } | null;
    science: {
      pct: number;
      correctCount: number;
      total: number;
      at: string;
    } | null;
  };
  learningBySubject: {
    math: { strongestTopic: string | null; weakestTopic: string | null };
    science: { strongestTopic: string | null; weakestTopic: string | null };
  };
  latestTestTopics?: {
    math: { label: string; correct: number; total: number; pct: number }[];
    science: { label: string; correct: number; total: number; pct: number }[];
  };
  aiFeedback?: {
    math: { narrative: string; computedAt: string } | null;
    science: { narrative: string; computedAt: string } | null;
  };
};

function RadialTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload?: { name?: string; mastery?: number; fill?: string } }>;
}) {
  if (active && payload && payload.length) {
    const p = payload[0];
    const name = p?.payload?.name;
    const value = p?.payload?.mastery;
    const color = p?.payload?.fill;
    return (
      <div className="rounded-md border bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium">{name}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Latest test:{" "}
          <span className="font-semibold" style={{ color }}>
            {value}%
          </span>
        </div>
      </div>
    );
  }
  return null;
}

function formatShortDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function aggregatesToBarData(
  agg: Record<
    string,
    {
      correct: number;
      total: number;
      quizSessions: number;
      avgAcrossQuizzesPct: number;
    }
  >,
  shades: string[]
) {
  return Object.entries(agg)
    .filter(([, { total }]) => total > 0)
    .map(([topic, row], i) => ({
      topic,
      mastery: Math.round(row.avgAcrossQuizzesPct),
      correct: row.correct,
      total: row.total,
      quizSessions: row.quizSessions,
      color: shades[i % shades.length],
    }))
    .sort((a, b) => b.mastery - a.mastery);
}

function latestBreakdownToRadialRows(
  rows: { label: string; pct: number }[],
  shades: string[]
) {
  return rows.map((r, i) => ({
    name: r.label,
    mastery: r.pct,
    fill: shades[i % shades.length],
  }));
}

function getMasteryBarColor(mastery: number) {
  if (mastery >= 80) return "green";
  if (mastery >= 60) return "blue";
  if (mastery >= 40) return "yellow";
  return "red";
}

export default function Dashboard() {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.role === "student") {
          setStats({
            ...data,
            latestTestTopics: data.latestTestTopics ?? {
              math: [],
              science: [],
            },
          });
        }
      } catch (e) {
        console.error("[Dashboard] Load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mathPathway = useMemo(() => {
    if (!stats) return [];
    const rows = stats.sessions
      .filter((s) => s.subject === "math")
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    return rows.map((s, i) => ({
      milestone: `Quiz ${i + 1}`,
      cumulative: s.score,
      date: formatShortDate(s.createdAt),
    }));
  }, [stats]);

  const sciencePathway = useMemo(() => {
    if (!stats) return [];
    const rows = stats.sessions
      .filter((s) => s.subject === "science")
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    return rows.map((s, i) => ({
      milestone: `Quiz ${i + 1}`,
      cumulative: s.score,
      date: formatShortDate(s.createdAt),
    }));
  }, [stats]);

  const mathTopics = useMemo(
    () =>
      stats
        ? aggregatesToBarData(stats.topicAggregates.math, mathShades)
        : [],
    [stats]
  );

  const scienceTopics = useMemo(
    () =>
      stats
        ? aggregatesToBarData(stats.topicAggregates.science, scienceShades)
        : [],
    [stats]
  );

  const overallMathMastery = stats?.mathAverageScore;
  const overallScienceMastery = stats?.scienceAverageScore;

  const overallAvgScore = useMemo(() => {
    if (!stats?.sessions.length) return null;
    const sum = stats.sessions.reduce(
      (a, s) => a + (s.totalQuestions > 0 ? (s.correctCount / s.totalQuestions) * 100 : 0),
      0
    );
    return Math.round(sum / stats.sessions.length);
  }, [stats]);

  const quizAccuracyPct = useMemo(() => {
    if (!stats?.sessions.length) return null;
    let c = 0;
    let t = 0;
    for (const s of stats.sessions) {
      c += s.correctCount;
      t += s.totalQuestions;
    }
    if (t === 0) return null;
    return Math.round((c / t) * 100);
  }, [stats]);

  const lb = stats?.learningBySubject;

  const latestMathRadial = useMemo(() => {
    if (!stats?.latestTestTopics?.math?.length) return [];
    return latestBreakdownToRadialRows(
      stats.latestTestTopics.math.map((r) => ({
        label: r.label,
        pct: r.pct,
      })),
      mathShades
    );
  }, [stats]);

  const latestScienceRadial = useMemo(() => {
    if (!stats?.latestTestTopics?.science?.length) return [];
    return latestBreakdownToRadialRows(
      stats.latestTestTopics.science.map((r) => ({
        label: r.label,
        pct: r.pct,
      })),
      scienceShades
    );
  }, [stats]);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Progress from your completed adaptive quizzes
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your stats…</p>
          </div>
        ) : !stats ? (
          <p className="text-sm text-muted-foreground">
            Sign in as a student to see your dashboard.
          </p>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <Link href="/quiz" className="block" style={{ cursor: "pointer" }}>
                <Card
                  className="h-full transition-all hover:shadow-lg border-2 hover:border-primary"
                  style={{ cursor: "pointer" }}
                >
                  <CardContent className="flex flex-col items-center justify-center p-12">
                    <Brain className="h-16 w-16 text-primary mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Smart Quiz</h2>
                    <p className="text-muted-foreground text-center">
                      Adaptive math and science quizzes
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/tutor" className="block" style={{ cursor: "pointer" }}>
                <Card
                  className="h-full transition-all hover:shadow-lg border-2 hover:border-primary"
                  style={{ cursor: "pointer" }}
                >
                  <CardContent className="flex flex-col items-center justify-center p-12">
                    <MessageSquare className="h-16 w-16 text-primary mb-4" />
                    <h2 className="text-2xl font-bold mb-2">AI Tutor</h2>
                    <p className="text-muted-foreground text-center">
                      Personalized help for your coursework
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-[#1E3A8A]/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5" style={{ color: MATH_COLOR }} />
                    Math AI Feedback
                  </CardTitle>
                  <CardDescription>
                    Personalized coaching based on all your math quizzes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.aiFeedback?.math ? (
                    <div className="text-sm text-muted-foreground">
                      <MarkdownRenderer content={stats.aiFeedback.math.narrative} />
                      <p className="text-xs text-muted-foreground/60 mt-3">
                        Updated {formatShortDate(stats.aiFeedback.math.computedAt)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Brain className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No math quiz data yet. Complete a math quiz to receive AI feedback.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-[#059669]/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5" style={{ color: SCIENCE_COLOR }} />
                    Science AI Feedback
                  </CardTitle>
                  <CardDescription>
                    Personalized coaching based on all your science quizzes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.aiFeedback?.science ? (
                    <div className="text-sm text-muted-foreground">
                      <MarkdownRenderer content={stats.aiFeedback.science.narrative} />
                      <p className="text-xs text-muted-foreground/60 mt-3">
                        Updated {formatShortDate(stats.aiFeedback.science.computedAt)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Brain className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No science quiz data yet. Complete a science quiz to receive AI feedback.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Math mastery</CardTitle>
                  <CardDescription>
                    Average score across completed math quiz sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall</span>
                      <span
                        className="text-2xl font-bold"
                        style={{ color: MATH_COLOR }}
                      >
                        {overallMathMastery != null
                          ? `${overallMathMastery}%`
                          : "-"}
                      </span>
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${overallMathMastery ?? 0}%`,
                          backgroundColor: MATH_COLOR,
                        }}
                      />
                    </div>
                  </div>
                  {mathPathway.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Complete a math quiz to see your pathway.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={mathPathway}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="milestone" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="cumulative"
                          stroke={MATH_COLOR}
                          strokeWidth={3}
                          name="Score %"
                          dot={{ fill: MATH_COLOR, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Science mastery</CardTitle>
                  <CardDescription>
                    Average score across completed science quiz sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall</span>
                      <span
                        className="text-2xl font-bold"
                        style={{ color: SCIENCE_COLOR }}
                      >
                        {overallScienceMastery != null
                          ? `${overallScienceMastery}%`
                          : "-"}
                      </span>
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${overallScienceMastery ?? 0}%`,
                          backgroundColor: SCIENCE_COLOR,
                        }}
                      />
                    </div>
                  </div>
                  {sciencePathway.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Complete a science quiz to see your pathway.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={sciencePathway}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="milestone" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="cumulative"
                          stroke={SCIENCE_COLOR}
                          strokeWidth={3}
                          name="Score %"
                          dot={{ fill: SCIENCE_COLOR, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Math topics (from your quizzes)</CardTitle>
                  <CardDescription>
                    Average topic score across every math quiz you&apos;ve
                    finished (mean of each quiz&apos;s accuracy in that topic)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mathTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No math topic data yet.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={mathTopics}
                        layout="vertical"
                        margin={{ top: 5, right: 40, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} unit="%" />
                        <YAxis dataKey="topic" type="category" width={120} />
                        <Tooltip
                          formatter={(
                            value: number,
                            _name: string,
                            item: { payload?: { correct?: number; total?: number; quizSessions?: number } }
                          ) => {
                            const p = item?.payload;
                            const c = p?.correct;
                            const t = p?.total;
                            const q = p?.quizSessions;
                            const detail =
                              c != null &&
                              t != null &&
                              q != null
                                ? ` (${c}/${t} attempts, ${q} quiz${q === 1 ? "" : "zes"})`
                                : "";
                            return [`${value}% avg across quizzes${detail}`, "Topic"];
                          }}
                        />
                        <Bar dataKey="mastery" name="Avg across quizzes"
                          label={{ position: "right", formatter: (v: number) => `${v}%`, fontSize: 12 }}
                        >
                          {mathTopics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Science topics (from your quizzes)</CardTitle>
                  <CardDescription>
                    Average topic score across every science quiz you&apos;ve
                    finished (mean of each quiz&apos;s accuracy in that topic)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scienceTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No science topic data yet.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={scienceTopics}
                        layout="vertical"
                        margin={{ top: 5, right: 40, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} unit="%" />
                        <YAxis dataKey="topic" type="category" width={120} />
                        <Tooltip
                          formatter={(
                            value: number,
                            _name: string,
                            item: { payload?: { correct?: number; total?: number; quizSessions?: number } }
                          ) => {
                            const p = item?.payload;
                            const c = p?.correct;
                            const t = p?.total;
                            const q = p?.quizSessions;
                            const detail =
                              c != null &&
                              t != null &&
                              q != null
                                ? ` (${c}/${t} attempts, ${q} quiz${q === 1 ? "" : "zes"})`
                                : "";
                            return [`${value}% avg across quizzes${detail}`, "Topic"];
                          }}
                        />
                        <Bar dataKey="mastery" name="Avg across quizzes"
                          label={{ position: "right", formatter: (v: number) => `${v}%`, fontSize: 12 }}
                        >
                          {scienceTopics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Latest test averages</CardTitle>
                  <CardDescription>
                    Overall score and per-topic accuracy from your most recent
                    quiz in each subject
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="math" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="math">Math</TabsTrigger>
                      <TabsTrigger value="science">Science</TabsTrigger>
                    </TabsList>
                    <TabsContent value="math" className="mt-4">
                      {stats.latestSession.math ? (
                        <>
                          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Session score
                              </p>
                              <span
                                className="text-3xl font-bold"
                                style={{ color: MATH_COLOR }}
                              >
                                {stats.latestSession.math.pct}%
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {stats.latestSession.math.correctCount} /{" "}
                              {stats.latestSession.math.total} correct ·{" "}
                              {formatShortDate(stats.latestSession.math.at)}
                            </p>
                          </div>
                          {latestMathRadial.length > 0 ? (
                            <div className="pt-2 pb-4">
                              <ResponsiveContainer width="100%" height={460}>
                                <RadialBarChart
                                  cx="50%"
                                  cy="40%"
                                  innerRadius="22%"
                                  outerRadius="95%"
                                  data={latestMathRadial}
                                  startAngle={90}
                                  endAngle={-270}
                                >
                                  <RadialBar
                                    dataKey="mastery"
                                    name="Accuracy %"
                                    cornerRadius={4}
                                    fill="#8884d8"
                                    stroke="none"
                                  >
                                    {latestMathRadial.map((entry, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={entry.fill}
                                        fillOpacity={0.9}
                                      />
                                    ))}
                                  </RadialBar>
                                  <Tooltip content={<RadialTooltip />} />
                                  <Legend wrapperStyle={{ paddingTop: 16 }} />
                                </RadialBarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-4">
                              No per-topic breakdown for this quiz.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">
                          No math quiz completed yet.
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="science" className="mt-4">
                      {stats.latestSession.science ? (
                        <>
                          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Session score
                              </p>
                              <span
                                className="text-3xl font-bold"
                                style={{ color: SCIENCE_COLOR }}
                              >
                                {stats.latestSession.science.pct}%
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {stats.latestSession.science.correctCount} /{" "}
                              {stats.latestSession.science.total} correct ·{" "}
                              {formatShortDate(stats.latestSession.science.at)}
                            </p>
                          </div>
                          {latestScienceRadial.length > 0 ? (
                            <div className="pt-2 pb-4">
                              <ResponsiveContainer width="100%" height={460}>
                                <RadialBarChart
                                  cx="50%"
                                  cy="40%"
                                  innerRadius="22%"
                                  outerRadius="95%"
                                  data={latestScienceRadial}
                                  startAngle={90}
                                  endAngle={-270}
                                >
                                  <RadialBar
                                    dataKey="mastery"
                                    name="Accuracy %"
                                    cornerRadius={4}
                                    fill="#8884d8"
                                    stroke="none"
                                  >
                                    {latestScienceRadial.map(
                                      (entry, index) => (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={entry.fill}
                                          fillOpacity={0.9}
                                        />
                                      )
                                    )}
                                  </RadialBar>
                                  <Tooltip content={<RadialTooltip />} />
                                  <Legend wrapperStyle={{ paddingTop: 16 }} />
                                </RadialBarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-4">
                              No per-topic breakdown for this quiz.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">
                          No science quiz completed yet.
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Learning statistics</CardTitle>
                  <CardDescription>
                    Derived from your saved quiz attempts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border p-4 bg-muted/30 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Quizzes completed
                      </span>
                    </div>
                    <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Avg session score
                        </span>
                      </div>
                      <p className="text-2xl font-bold">
                        {overallAvgScore != null ? `${overallAvgScore}%` : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Overall accuracy (all questions)
                        </span>
                      </div>
                      <p className="text-2xl font-bold">
                        {quizAccuracyPct != null ? `${quizAccuracyPct}%` : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Math: strongest topic
                      </p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">
                          {lb?.math.strongestTopic ?? "-"}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-red-50/50 dark:bg-red-950/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Math: weakest topic
                      </p>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="font-semibold text-red-600">
                          {lb?.math.weakestTopic ?? "-"}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Science: strongest topic
                      </p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">
                          {lb?.science.strongestTopic ?? "-"}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-red-50/50 dark:bg-red-950/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Science: weakest topic
                      </p>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="font-semibold text-red-600">
                          {lb?.science.weakestTopic ?? "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
