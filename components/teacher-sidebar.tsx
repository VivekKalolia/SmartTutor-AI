"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload, FileText, Users, Settings, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const teacherNavigation = [
  { name: "Document Upload", href: "/teachers", icon: Upload },
  { name: "Student Management", href: "/teachers/students", icon: Users },
  { name: "Settings", href: "/teachers/settings", icon: Settings },
];

export function TeacherSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/teachers" className="flex items-center gap-2" style={{ cursor: "pointer" }}>
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-primary">Teacher Portal</h1>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {teacherNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} style={{ cursor: "pointer" }}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  isActive && "bg-primary text-primary-foreground"
                )}
                style={{ cursor: "pointer" }}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

