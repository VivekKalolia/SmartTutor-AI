"use client";

import { TeacherSidebar } from "@/components/teacher-sidebar";
import { User, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
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

const teacherPageTitles: Record<string, string> = {
  "/teacher": "Dashboard",
  "/teacher/upload": "Knowledge Base",
  "/teacher/students": "Students",
  "/teacher/settings": "Settings",
};

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pageTitle = teacherPageTitles[pathname] || "Dashboard";
  
  // Demo teacher data
  const teacherName = "Dr. Sarah Johnson";
  const teacherEmail = "sarah.johnson@university.edu";
  const initials = "SJ";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <TeacherSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-background">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">{pageTitle}</h2>
            </div>

            <div className="flex items-center gap-4">
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
                  <DropdownMenuItem className="cursor-pointer" style={{ cursor: "pointer" }}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" style={{ cursor: "pointer" }}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" style={{ cursor: "pointer" }}>Log out</DropdownMenuItem>
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

