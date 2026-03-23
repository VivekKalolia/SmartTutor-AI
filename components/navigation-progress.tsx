"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname } from "next/navigation";

function NavigationProgressBar() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // When route changes, complete the progress and reset
    if (isNavigating) {
      setProgress(100);
      const timeout = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [pathname]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    if (isNavigating && progress < 90) {
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            return prev;
          }
          return prev + 10;
        });
      }, 100);
    }

    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [isNavigating, progress]);

  // Listen for navigation start (clicks on buttons that trigger navigation)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest("button");

      // Check if it's a navigation button (in sidebar)
      if (button && button.closest("nav")) {
        setIsNavigating(true);
        setProgress(10);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/20">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
