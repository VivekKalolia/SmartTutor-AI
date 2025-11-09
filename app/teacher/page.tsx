"use client";

import TeacherLayout from "@/components/teacher-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  Award,
  BookOpen,
  BarChart3,
  Target,
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

const studentPerformance = [
  { name: "John Smith", math: 88, science: 86, avgScore: 87 },
  { name: "Emily Chen", math: 92, science: 89, avgScore: 90.5 },
  { name: "Michael Brown", math: 75, science: 78, avgScore: 76.5 },
  { name: "Sarah Wilson", math: 95, science: 93, avgScore: 94 },
  { name: "David Lee", math: 82, science: 85, avgScore: 83.5 },
];

const classStats = {
  totalStudents: 25,
  averageMathScore: 86,
  averageScienceScore: 86,
  studentsCompleted: 20,
  topicsCovered: 16,
};

const subjectDistribution = [
  { subject: "Math", students: 25, avgScore: 86 },
  { subject: "Science", students: 25, avgScore: 86 },
];

export default function TeacherDashboard() {
  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of student performance and class statistics
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Students
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classStats.totalStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Enrolled in class
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
              <div className="text-2xl font-bold">{classStats.averageMathScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Class average
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
              <div className="text-2xl font-bold">{classStats.averageScienceScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Class average
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Topics Covered
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classStats.topicsCovered}</div>
              <p className="text-xs text-muted-foreground mt-1">
                In curriculum
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Performance Overview</CardTitle>
            <CardDescription>
              Individual student scores across Math and Science
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={studentPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="math" fill="#1E3A8A" name="Math" />
                <Bar dataKey="science" fill="#059669" name="Science" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Students</CardTitle>
              <CardDescription>Students with highest average scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {studentPerformance
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
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          Math: {student.math}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Science: {student.science}%
                        </span>
                        <span className="font-semibold text-primary">
                          {student.avgScore}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subject Performance</CardTitle>
              <CardDescription>Average scores by subject</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgScore" name="Average Score %">
                    {subjectDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.subject === "Math" ? "#1E3A8A" : "#059669"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </TeacherLayout>
  );
}
