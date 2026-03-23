"use client";

import { useEffect, useState } from "react";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { LogOut, Pencil, Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";

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
  const router = useRouter();
  const pageTitle = teacherPageTitles[pathname] || "Dashboard";

  const [teacherName, setTeacherName] = useState("Teacher");
  const [isEditingName, setIsEditingName] = useState(false);
  const initials = teacherName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleNameClick = () => {
    setIsEditingName(true);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.name) {
          setTeacherName(data.name);
        }
      } catch (e) {
        console.error("[TeacherLayout] Failed to load profile:", e);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistName = async (name: string) => {
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
    } catch (e) {
      console.error("[TeacherLayout] Failed to update name:", e);
    }
  };

  const commitName = async () => {
    const trimmed = teacherName.trim();
    if (!trimmed) {
      setIsEditingName(false);
      return;
    }
    setTeacherName(trimmed);
    setIsEditingName(false);
    await persistName(trimmed);
  };

  const handleNameBlur = () => {
    void commitName();
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("[TeacherLayout] Logout error:", e);
    } finally {
      router.push("/login");
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

          <div className="flex items-center gap-2">
            <ModeToggle />
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
                            onClick={() => {
                              // Explicitly commit and close on click
                              void commitName();
                            }}
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
                      {/* Teachers do not have a grade field */}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="p-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15"
                    style={{ cursor: "pointer" }}
                    onClick={handleLogout}
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
