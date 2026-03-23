"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  MessageSquare,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Smart Quiz", href: "/quiz", icon: Brain },
  { name: "AI Tutor", href: "/tutor", icon: MessageSquare },
  { name: "AI Flashcards", href: "/flashcards", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Initialize collapsed state from localStorage
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const savedCollapsed = localStorage.getItem("sidebar-collapsed");
      return savedCollapsed === "true";
    }
    return false;
  });

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed.toString());
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative">
        <div
          className={cn(
            "flex h-screen flex-col border-r bg-background transition-all duration-300",
            collapsed ? "w-16" : "w-64"
          )}
        >
          <div
            className={cn(
              "relative flex h-16 items-center border-b",
              collapsed ? "justify-center px-4" : "justify-start px-6"
            )}
          >
            <Link
              href="/"
              className={cn(
                "flex items-center gap-2",
                collapsed && "justify-center"
              )}
              style={{ cursor: "pointer" }}
            >
              <GraduationCap className="h-6 w-6 text-primary" />
              {!collapsed && (
                <span className="text-xl font-bold text-primary">
                  SmartTutor AI
                </span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-8 w-8 rounded-full border bg-background shadow-sm hover:bg-accent z-10"
              style={{ cursor: "pointer" }}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <nav
            className={cn("flex-1 space-y-1", collapsed ? "px-2 py-4" : "p-4")}
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              const buttonContent = (
                <>
                  <Icon className="h-5 w-5" />
                  {!collapsed && <span>{item.name}</span>}
                </>
              );

              const button = (
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full transition-all",
                    collapsed ? "justify-center px-0" : "justify-start gap-3",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(item.href)}
                  type="button"
                >
                  {buttonContent}
                </Button>
              );

              return collapsed ? (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={8}
                    align="center"
                    alignOffset={-2}
                  >
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.name}>{button}</div>
              );
            })}
          </nav>
          <div className={cn("border-t", collapsed ? "px-0 py-4" : "p-4")}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={8}
                  align="center"
                  alignOffset={-2}
                >
                  Student Portal
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                <span>Student Portal</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
