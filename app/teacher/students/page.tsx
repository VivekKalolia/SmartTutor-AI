"use client";

import TeacherLayout from "@/components/teacher-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";

const students = [
  {
    id: "1",
    name: "John Smith",
    mathScore: 88,
    scienceScore: 86,
    weakAreas: ["Statistics"],
    helpSummary: "Needs additional support with statistical analysis and probability concepts.",
  },
  {
    id: "2",
    name: "Emily Chen",
    mathScore: 92,
    scienceScore: 89,
    weakAreas: [],
    helpSummary: "Performing well across all topics. Minor improvement needed in advanced calculus.",
  },
  {
    id: "3",
    name: "Michael Brown",
    mathScore: 75,
    scienceScore: 78,
    weakAreas: ["Algebra", "Physics"],
    helpSummary: "Requires focused assistance with algebraic equations and fundamental physics principles.",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    mathScore: 95,
    scienceScore: 93,
    weakAreas: [],
    helpSummary: "Excellent performance. Consider advanced topics for further enrichment.",
  },
];

export default function StudentManagement() {
  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Students
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage your students
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Students</CardTitle>
            <CardDescription>
              {students.length} student{students.length !== 1 ? "s" : ""} enrolled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-start justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{student.name}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-muted-foreground">
                          Math: {student.mathScore}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Science: {student.scienceScore}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 max-w-md">
                    <Card className="bg-muted/30 border-muted">
                      <CardContent className="p-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          {student.helpSummary}
                        </p>
                        {student.weakAreas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {student.weakAreas.map((area) => (
                              <Badge key={area} variant="destructive" className="text-xs">
                                {area}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
}

