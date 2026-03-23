"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/** Mantine 8 reads `data-mantine-color-scheme` on the root for Progress etc. */
export function MantineColorSchemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.setAttribute("data-mantine-color-scheme", "dark");
    } else if (resolvedTheme === "light") {
      root.setAttribute("data-mantine-color-scheme", "light");
    }
  }, [resolvedTheme]);

  return null;
}
