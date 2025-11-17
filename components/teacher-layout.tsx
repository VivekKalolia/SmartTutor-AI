"use client";

import { useState } from "react";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { Settings, LogOut, Pencil, Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

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
  const [teacherName, setTeacherName] = useState("Dr. Sarah Johnson");
  const [isEditingName, setIsEditingName] = useState(false);
  const teacherGrade = "Grade 8";
  const initials = teacherName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleNameClick = () => {
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    setIsEditingName(false);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsEditingName(false);
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <TeacherSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b bg-background px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto p-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
                  style={{ cursor: "pointer" }}
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0">
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex flex-col gap-1">
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={teacherName}
                            onChange={(e) => setTeacherName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={handleNameKeyDown}
                            className="h-7 text-sm font-medium flex-1"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleNameSave}
                            style={{ cursor: "pointer" }}
                          >
                            <Check className="h-4 w-4 text-primary" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          onClick={handleNameClick}
                          className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:bg-accent rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                        >
                          <span>{teacherName}</span>
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {teacherGrade}
                      </p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="p-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    style={{ cursor: "pointer" }}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                  <Separator className="my-1" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    style={{ cursor: "pointer" }}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto px-6">
          <div className="py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
