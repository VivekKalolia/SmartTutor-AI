"use client";

import TeacherLayout from "@/components/teacher-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Mail, Phone } from "lucide-react";

const students = [
  {
    id: "1",
    name: "John Smith",
    email: "john.smith@university.edu",
    mathScore: 88,
    scienceScore: 86,
    status: "active",
  },
  {
    id: "2",
    name: "Emily Chen",
    email: "emily.chen@university.edu",
    mathScore: 92,
    scienceScore: 89,
    status: "active",
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "michael.brown@university.edu",
    mathScore: 75,
    scienceScore: 78,
    status: "active",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    email: "sarah.wilson@university.edu",
    mathScore: 95,
    scienceScore: 93,
    status: "active",
  },
];

export default function StudentManagement() {
  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Student Management
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
                  placeholder="Search by name or email..."
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
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.email}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-muted-foreground">
                          Math: {student.mathScore}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Science: {student.scienceScore}%
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary">{student.status}</Badge>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="icon" style={{ cursor: "pointer" }}>
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" style={{ cursor: "pointer" }}>
                      <Phone className="h-4 w-4" />
                    </Button>
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

