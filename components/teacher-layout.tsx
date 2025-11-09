"use client";

import { TeacherSidebar } from "@/components/teacher-sidebar";
import { User, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Demo teacher data
  const teacherName = "Dr. Sarah Johnson";
  const teacherEmail = "sarah.johnson@university.edu";
  const teacherId = "TCH-2024-001";
  const initials = "SJ";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <TeacherSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-background">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">Teacher Portal</h2>
              <Badge variant="secondary">{teacherId}</Badge>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative" style={{ cursor: "pointer" }}>
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-3" style={{ cursor: "pointer" }}>
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-medium">{teacherName}</span>
                      <span className="text-xs text-muted-foreground">
                        {teacherEmail}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

