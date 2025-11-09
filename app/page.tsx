"use client";

import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, MessageSquare, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
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
} from "recharts";

const mathMasteryData = [
  { week: "Week 1", mastery: 45 },
  { week: "Week 2", mastery: 52 },
  { week: "Week 3", mastery: 58 },
  { week: "Week 4", mastery: 65 },
  { week: "Week 5", mastery: 72 },
  { week: "Week 6", mastery: 78 },
  { week: "Week 7", mastery: 82 },
  { week: "Week 8", mastery: 85 },
];

const scienceMasteryData = [
  { week: "Week 1", mastery: 40 },
  { week: "Week 2", mastery: 48 },
  { week: "Week 3", mastery: 55 },
  { week: "Week 4", mastery: 62 },
  { week: "Week 5", mastery: 68 },
  { week: "Week 6", mastery: 74 },
  { week: "Week 7", mastery: 79 },
  { week: "Week 8", mastery: 83 },
];

const topicBreakdown = [
  { name: "Algebra", math: 88, science: 0 },
  { name: "Calculus", math: 82, science: 0 },
  { name: "Geometry", math: 75, science: 0 },
  { name: "Physics", math: 0, science: 85 },
  { name: "Chemistry", math: 0, science: 78 },
  { name: "Biology", math: 0, science: 72 },
];

const pieData = [
  { name: "Math Mastery", value: 85, color: "hsl(262.1, 83.3%, 57.8%)" },
  { name: "Science Mastery", value: 83, color: "hsl(262.1, 83.3%, 70%)" },
];

export default function Dashboard() {
  const overallMathMastery = 85;
  const overallScienceMastery = 83;

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Track your learning progress and mastery
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
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Math Mastery Progress
              </CardTitle>
              <CardDescription>
                Your mastery level over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Mastery</span>
                  <span className="text-2xl font-bold text-primary">
                    {overallMathMastery}%
                  </span>
                </div>
                <Progress value={overallMathMastery} className="h-3" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mathMasteryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="mastery"
                    stroke="hsl(262.1, 83.3%, 57.8%)"
                    strokeWidth={2}
                    name="Mastery %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Science Mastery Progress
              </CardTitle>
              <CardDescription>
                Your mastery level over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Mastery</span>
                  <span className="text-2xl font-bold text-primary">
                    {overallScienceMastery}%
                  </span>
                </div>
                <Progress value={overallScienceMastery} className="h-3" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scienceMasteryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="mastery"
                    stroke="hsl(262.1, 83.3%, 57.8%)"
                    strokeWidth={2}
                    name="Mastery %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Topic Mastery Breakdown</CardTitle>
            <CardDescription>
              Your performance across different topics
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
                <Bar
                  dataKey="math"
                  fill="hsl(262.1, 83.3%, 57.8%)"
                  name="Math"
                />
                <Bar
                  dataKey="science"
                  fill="hsl(262.1, 83.3%, 70%)"
                  name="Science"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mastery Distribution</CardTitle>
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
                <span className="text-sm font-medium">Quizzes Completed</span>
                <span className="text-2xl font-bold">24</span>
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
