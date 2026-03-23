"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function SonnerToaster() {
  const { resolvedTheme } = useTheme();
  const theme =
    resolvedTheme === "dark"
      ? "dark"
      : resolvedTheme === "light"
        ? "light"
        : "system";

  return (
    <Toaster
      position="top-center"
      richColors
      offset={10}
      theme={theme}
      toastOptions={{
        classNames: {
          toast:
            "border-border bg-background text-foreground shadow-lg",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
