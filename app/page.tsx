"use client";

import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, MessageSquare } from "lucide-react";
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

// Assessment-based data - professors can create assessments and results update here
const assessmentResults = [
  { assessment: "Assessment 1", math: 72, science: 68, date: "Oct 15" },
  { assessment: "Assessment 2", math: 78, science: 74, date: "Oct 29" },
  { assessment: "Assessment 3", math: 85, science: 82, date: "Nov 12" },
  { assessment: "Assessment 4", math: 88, science: 86, date: "Nov 26" },
];

const topicBreakdown = [
  { name: "Algebra", score: 88, color: "#8b5cf6" },
  { name: "Calculus", score: 82, color: "#06b6d4" },
  { name: "Geometry", score: 75, color: "#10b981" },
  { name: "Physics", score: 85, color: "#f59e0b" },
  { name: "Chemistry", score: 78, color: "#ef4444" },
  { name: "Biology", score: 72, color: "#ec4899" },
];

const pieData = [
  { name: "Math", value: 88, color: "#8b5cf6" },
  { name: "Science", value: 86, color: "#06b6d4" },
];

export default function Dashboard() {
  const overallMathMastery = 88;
  const overallScienceMastery = 86;
  const latestAssessment = assessmentResults[assessmentResults.length - 1];

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
              <CardTitle>Math Mastery</CardTitle>
              <CardDescription>
                Latest Assessment: {latestAssessment.date}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Score</span>
                  <span className="text-2xl font-bold text-primary">
                    {overallMathMastery}%
                  </span>
                </div>
                <Progress value={overallMathMastery} className="h-3" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={assessmentResults}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="math"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Math Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Science Mastery</CardTitle>
              <CardDescription>
                Latest Assessment: {latestAssessment.date}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Score</span>
                  <span className="text-2xl font-bold text-[#06b6d4]">
                    {overallScienceMastery}%
                  </span>
                </div>
                <Progress value={overallScienceMastery} className="h-3" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={assessmentResults}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="science"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    name="Science Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Topic Performance Breakdown</CardTitle>
            <CardDescription>
              Your scores across different topics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topicBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" name="Score %">
                  {topicBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
                <span className="text-2xl font-bold">{assessmentResults.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Score</span>
                <span className="text-2xl font-bold">87%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Study Hours</span>
                <span className="text-2xl font-bold">142</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Topics Mastered</span>
                <span className="text-2xl font-bold">12</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
