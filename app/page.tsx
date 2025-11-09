"use client";

import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, MessageSquare, TrendingUp, TrendingDown } from "lucide-react";
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
  PieChart,
  Pie,
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

const pieData = [
  { name: "Math", value: 88, color: MATH_COLOR },
  { name: "Science", value: 86, color: SCIENCE_COLOR },
];

export default function Dashboard() {
  const overallMathMastery = 88;
  const overallScienceMastery = 86;
  const latestMilestone = masteryPathway[masteryPathway.length - 1];

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
          <Link href="/quiz" className="block">
            <Card className="h-full transition-all hover:shadow-lg cursor-pointer border-2 hover:border-primary">
              <CardContent className="flex flex-col items-center justify-center p-12">
                <Brain className="h-16 w-16 text-primary mb-4" />
                <h2 className="text-2xl font-bold mb-2">Smart Quiz</h2>
                <p className="text-muted-foreground text-center">
                  Test your knowledge with adaptive quizzes in Math and Science
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/tutor" className="block">
            <Card className="h-full transition-all hover:shadow-lg cursor-pointer border-2 hover:border-primary">
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
                  <span className="text-2xl font-bold" style={{ color: MATH_COLOR }}>
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
                  <span className="text-2xl font-bold" style={{ color: SCIENCE_COLOR }}>
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
              <CardDescription>Overall subject mastery</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Learning Statistics</CardTitle>
              <CardDescription>Your academic performance overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Assessments Completed</span>
                <span className="text-2xl font-bold">{assessmentsCompleted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Score</span>
                <span className="text-2xl font-bold">{averageScore}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Topics Mastered</span>
                <span className="text-2xl font-bold">{topicsMastered}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recent Improvement Rate</span>
                <span className="text-2xl font-bold text-green-600 flex items-center gap-1">
                  <TrendingUp className="h-5 w-5" />
                  {recentImprovementRate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Weakest Topic</span>
                <span className="text-lg font-semibold text-red-600">{weakestTopic}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Strongest Topic</span>
                <span className="text-lg font-semibold text-green-600">{strongestTopic}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quiz Accuracy</span>
                <span className="text-2xl font-bold">{quizAccuracy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recommended Next Topic</span>
                <span className="text-lg font-semibold text-primary">{recommendedNextTopic}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Assessment Retake Count</span>
                <span className="text-2xl font-bold">{assessmentRetakeCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
