"use client";

import { useState } from "react";
import Layout from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Target,
  Award,
  BarChart3,
  AlertCircle,
  BookOpen,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Cell,
  LineChart,
  Line,
} from "recharts";

// Math color: #1E3A8A, Science color: #059669
const MATH_COLOR = "#1E3A8A";
const SCIENCE_COLOR = "#059669";

// Shades for bar graphs
const mathShades = ["#1E3A8A", "#3B5BA8", "#5A7CC6", "#789DE4"];
const scienceShades = ["#059669", "#10B981", "#34D399", "#6EE7B7"];

// Cumulative mastery pathway data - shows learning growth through assessment milestones
const masteryPathway = [
  { milestone: "Quiz 1", cumulative: 68, date: "Oct 8" },
  { milestone: "Test 1", cumulative: 72, date: "Oct 15" },
  { milestone: "Quiz 2", cumulative: 75, date: "Oct 22" },
  { milestone: "Test 2", cumulative: 78, date: "Oct 29" },
  { milestone: "Quiz 3", cumulative: 82, date: "Nov 5" },
  { milestone: "Test 3", cumulative: 85, date: "Nov 12" },
  { milestone: "Quiz 4", cumulative: 87, date: "Nov 19" },
  { milestone: "Final", cumulative: 88, date: "Nov 26" },
];

// Separate math and science topic breakdowns
const mathTopics = [
  { topic: "Algebra", mastery: 88, color: mathShades[0] },
  { topic: "Calculus", mastery: 82, color: mathShades[1] },
  { topic: "Geometry", mastery: 75, color: mathShades[2] },
  { topic: "Statistics", mastery: 70, color: mathShades[3] },
];

const scienceTopics = [
  { topic: "Physics", mastery: 85, color: scienceShades[0] },
  { topic: "Chemistry", mastery: 78, color: scienceShades[1] },
  { topic: "Biology", mastery: 72, color: scienceShades[2] },
  { topic: "Earth Science", mastery: 68, color: scienceShades[3] },
];

export default function Dashboard() {
  const overallMathMastery = 88;
  const overallScienceMastery = 86;

  const pieData = [
    { name: "Math", value: overallMathMastery, color: MATH_COLOR },
    { name: "Science", value: overallScienceMastery, color: SCIENCE_COLOR },
  ];
  const latestMilestone = masteryPathway[masteryPathway.length - 1];

  // Hover state for radial charts
  const [hoveredMathIndex, setHoveredMathIndex] = useState<number | null>(null);
  const [hoveredScienceIndex, setHoveredScienceIndex] = useState<number | null>(
    null
  );

  // Custom tooltip for radial charts
  const RadialTooltip = ({ active, payload }: any) => {
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
            Mastery:{" "}
            <span className="font-semibold" style={{ color }}>
              {value}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Learning statistics
  const assessmentsCompleted = 24;
  const averageScore = 87;
  const topicsMastered = 12;
  const recentImprovementRate = "+5.2%"; // Improvement over last 3 assessments
  const weakestTopic = "Statistics";
  const strongestTopic = "Algebra";
  const quizAccuracy = "84%"; // Correct/Incorrect ratio
  const recommendedNextTopic = "Statistics";
  const assessmentRetakeCount = 3;

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Track your learning progress and assessment results
            </p>
          </div>
        </div>

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
                  Test your knowledge with adaptive quizzes in Math and Science
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
                  Get personalized help and explanations for your coursework
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Math Mastery Pathway</CardTitle>
              <CardDescription>
                Cumulative progress through assessment milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Mastery</span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: MATH_COLOR }}
                  >
                    {overallMathMastery}%
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${overallMathMastery}%`,
                      backgroundColor: MATH_COLOR,
                    }}
                  />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={masteryPathway}>
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
                    name="Cumulative Mastery %"
                    dot={{ fill: MATH_COLOR, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Science Mastery Pathway</CardTitle>
              <CardDescription>
                Cumulative progress through assessment milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Mastery</span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: SCIENCE_COLOR }}
                  >
                    {overallScienceMastery}%
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${overallScienceMastery}%`,
                      backgroundColor: SCIENCE_COLOR,
                    }}
                  />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={masteryPathway}>
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
                    name="Cumulative Mastery %"
                    dot={{ fill: SCIENCE_COLOR, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Math Topics Mastery</CardTitle>
              <CardDescription>
                Performance across math syllabus topics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={mathTopics}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="topic" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mastery" name="Mastery %">
                    {mathTopics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Science Topics Mastery</CardTitle>
              <CardDescription>
                Performance across science syllabus topics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={scienceTopics}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="topic" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mastery" name="Mastery %">
                    {scienceTopics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subject Distribution</CardTitle>
              <CardDescription>
                Topic mastery by subject (each can achieve 100% mastery
                independently)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="math" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="math">Math</TabsTrigger>
                  <TabsTrigger value="science">Science</TabsTrigger>
                </TabsList>
                <TabsContent value="math" className="mt-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="20%"
                      outerRadius="80%"
                      data={mathTopics.map((topic) => ({
                        name: topic.topic,
                        mastery: topic.mastery,
                        fill: topic.color,
                      }))}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar
                        dataKey="mastery"
                        name="Mastery"
                        cornerRadius={4}
                        fill="#8884d8"
                        stroke="none"
                      >
                        {mathTopics.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            fillOpacity={
                              hoveredMathIndex === null
                                ? 0.9
                                : hoveredMathIndex === index
                                  ? 1
                                  : 0.35
                            }
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHoveredMathIndex(index)}
                            onMouseLeave={() => setHoveredMathIndex(null)}
                          />
                        ))}
                      </RadialBar>
                      <Tooltip content={<RadialTooltip />} />
                      <Legend />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="border-t mt-6 pt-6">
                    <h4 className="font-semibold mb-3 text-sm">
                      Math Topics Mastery
                    </h4>
                    <div className="space-y-2">
                      {mathTopics.map((topic) => (
                        <div
                          key={topic.topic}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-muted-foreground">
                            {topic.topic}
                          </span>
                          <span
                            className="text-sm font-semibold"
                            style={{ color: topic.color }}
                          >
                            {topic.mastery}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="science" className="mt-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="20%"
                      outerRadius="80%"
                      data={scienceTopics.map((topic) => ({
                        name: topic.topic,
                        mastery: topic.mastery,
                        fill: topic.color,
                      }))}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar
                        dataKey="mastery"
                        name="Mastery"
                        cornerRadius={4}
                        fill="#8884d8"
                        stroke="none"
                      >
                        {scienceTopics.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            fillOpacity={
                              hoveredScienceIndex === null
                                ? 0.9
                                : hoveredScienceIndex === index
                                  ? 1
                                  : 0.35
                            }
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHoveredScienceIndex(index)}
                            onMouseLeave={() => setHoveredScienceIndex(null)}
                          />
                        ))}
                      </RadialBar>
                      <Tooltip content={<RadialTooltip />} />
                      <Legend />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="border-t mt-6 pt-6">
                    <h4 className="font-semibold mb-3 text-sm">
                      Science Topics Mastery
                    </h4>
                    <div className="space-y-2">
                      {scienceTopics.map((topic) => (
                        <div
                          key={topic.topic}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-muted-foreground">
                            {topic.topic}
                          </span>
                          <span
                            className="text-sm font-semibold"
                            style={{ color: topic.color }}
                          >
                            {topic.mastery}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Learning Statistics</CardTitle>
              <CardDescription>
                Your academic performance overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Assessments Completed
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{assessmentsCompleted}</p>
                </div>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Average Score
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{averageScore}%</p>
                </div>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Topics Mastered
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{topicsMastered}</p>
                </div>
                <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      Improvement Rate
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {recentImprovementRate}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Weakest Topic</span>
                  </div>
                  <span className="text-base font-semibold text-red-600">
                    {weakestTopic}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Strongest Topic</span>
                  </div>
                  <span className="text-base font-semibold text-green-600">
                    {strongestTopic}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Quiz Accuracy</span>
                  </div>
                  <span className="text-lg font-bold">{quizAccuracy}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      Recommended Next Topic
                    </span>
                  </div>
                  <span className="text-base font-semibold text-primary">
                    {recommendedNextTopic}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Assessment Retakes
                    </span>
                  </div>
                  <span className="text-lg font-bold">
                    {assessmentRetakeCount}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
