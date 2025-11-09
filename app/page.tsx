import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calendar, FileText, TrendingUp, Users, Clock } from "lucide-react";
import Link from "next/link";

const courses = [
  {
    id: 1,
    title: "Calculus I",
    progress: 75,
    assignments: 3,
    nextDeadline: "Dec 15, 2024",
    status: "in-progress",
  },
  {
    id: 2,
    title: "Physics Fundamentals",
    progress: 60,
    assignments: 2,
    nextDeadline: "Dec 18, 2024",
    status: "in-progress",
  },
  {
    id: 3,
    title: "Linear Algebra",
    progress: 45,
    assignments: 1,
    nextDeadline: "Dec 20, 2024",
    status: "in-progress",
  },
];

const assignments = [
  {
    id: 1,
    title: "Differential Equations Problem Set",
    course: "Calculus I",
    dueDate: "Dec 15, 2024",
    status: "pending",
  },
  {
    id: 2,
    title: "Mechanics Lab Report",
    course: "Physics Fundamentals",
    dueDate: "Dec 18, 2024",
    status: "pending",
  },
  {
    id: 3,
    title: "Vector Spaces Assignment",
    course: "Linear Algebra",
    dueDate: "Dec 20, 2024",
    status: "pending",
  },
];

export default function Dashboard() {
  const overallProgress = Math.round(
    courses.reduce((acc, course) => acc + course.progress, 0) / courses.length
  );

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back. Here's your learning overview.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Overall Progress
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallProgress}%</div>
              <Progress value={overallProgress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Courses
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently enrolled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Assignments
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Due this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Upcoming Deadline
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Dec 15</div>
              <p className="text-xs text-muted-foreground mt-1">
                {assignments[0]?.title}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current Courses</CardTitle>
              <CardDescription>
                Track your progress across all enrolled courses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{course.title}</h3>
                      <Badge variant="secondary">{course.assignments} assignments</Badge>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due: {course.nextDeadline}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Assignments</CardTitle>
              <CardDescription>
                Important deadlines and pending tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1 flex-1">
                    <h3 className="font-semibold">{assignment.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {assignment.course}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{assignment.status}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Due: {assignment.dueDate}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Access key features and learning tools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/quiz">
                <Button className="w-full justify-start" size="lg">
                  <Brain className="mr-2 h-5 w-5" />
                  Start Smart Quiz
                </Button>
              </Link>
              <Link href="/tutor">
                <Button className="w-full justify-start" variant="outline" size="lg">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Open AI Tutor
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Learning Statistics</CardTitle>
              <CardDescription>
                Your academic performance overview
              </CardDescription>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

