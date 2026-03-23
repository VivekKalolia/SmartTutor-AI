"use client";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DIFFICULTY_DISPLAY,
  type Difficulty,
} from "@/lib/adaptive-learning/adaptive-engine";
import { CheckCircle2, XCircle } from "lucide-react";
import type { VariantProps } from "class-variance-authority";

const DIFFICULTY_VARIANT: Record<
  Difficulty,
  NonNullable<VariantProps<typeof badgeVariants>["variant"]>
> = {
  easy: "diffEasy",
  medium: "diffMedium",
  hard: "diffHard",
  very_hard: "diffVeryHard",
};

export function SubjectBadge({
  subject,
  className,
}: {
  subject: "math" | "science";
  className?: string;
}) {
  return (
    <Badge
      variant={subject === "math" ? "math" : "science"}
      className={cn("px-3 py-1 text-sm font-semibold", className)}
    >
      {subject === "math" ? "Math" : "Science"}
    </Badge>
  );
}

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: string;
  className?: string;
}) {
  const key = difficulty.toLowerCase().replace(/\s+/g, "_") as Difficulty;
  const variant =
    key in DIFFICULTY_VARIANT
      ? DIFFICULTY_VARIANT[key as Difficulty]
      : "diffMedium";
  const label =
    key in DIFFICULTY_DISPLAY
      ? DIFFICULTY_DISPLAY[key as Difficulty]
      : difficulty;
  return (
    <Badge
      variant={variant}
      className={cn("font-semibold text-xs px-2.5 py-0.5", className)}
    >
      {label}
    </Badge>
  );
}

export function QuizFeedbackSourceBadge({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const isAi = source === "ollama";
  return (
    <Badge variant="insight" className={cn("shrink-0", className)}>
      {isAi ? "AI wording" : "Smart summary"}
    </Badge>
  );
}

export function AnswerResultBadge({
  correct,
  className,
}: {
  correct: boolean;
  className?: string;
}) {
  if (correct) {
    return (
      <Badge variant="success" className={cn("gap-1", className)}>
        <CheckCircle2 className="h-3 w-3" />
        Correct
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className={cn("gap-1", className)}>
      <XCircle className="h-3 w-3" />
      Incorrect
    </Badge>
  );
}

export function TopicBadge({
  topic,
  className,
}: {
  topic: string;
  className?: string;
}) {
  return (
    <Badge variant="topic" className={cn("text-xs px-2.5 py-0.5", className)}>
      {topic}
    </Badge>
  );
}
