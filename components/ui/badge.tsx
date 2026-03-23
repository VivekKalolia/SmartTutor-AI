import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        diffEasy:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/20 dark:text-emerald-100",
        diffMedium:
          "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/20 dark:text-amber-100",
        diffHard:
          "border-orange-500/35 bg-orange-500/15 text-orange-900 dark:border-orange-300/30 dark:bg-orange-300/20 dark:text-orange-100",
        diffVeryHard:
          "border-red-500/35 bg-red-500/15 text-red-900 dark:border-red-300/30 dark:bg-red-300/20 dark:text-red-100",
        math: "border-transparent bg-[#1E3A8A]/15 text-[#1E3A8A] dark:text-[#93C5FD]",
        science:
          "border-transparent bg-[#059669]/15 text-[#059669] dark:text-[#6EE7B7]",
        insight:
          "border-transparent bg-violet-500/15 text-violet-900 dark:text-violet-200",
        success:
          "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90",
        topic:
          "border-indigo-500/30 bg-indigo-500/10 text-indigo-900 dark:border-indigo-300/30 dark:bg-indigo-300/15 dark:text-indigo-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
