"use client";

import { Provider } from "react-redux";
import { store } from "@/lib/store";
import { SonnerToaster } from "@/components/sonner-toaster";
import { MantineProvider } from "@mantine/core";
import { NavigationProgress } from "@/components/navigation-progress";
import { ThemeProvider } from "@/components/theme-provider";
import { MantineColorSchemeSync } from "@/components/mantine-color-scheme-sync";
import "@mantine/core/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Provider store={store}>
        <MantineProvider>
          <MantineColorSchemeSync />
          <NavigationProgress />
          {children}
          <SonnerToaster />
        </MantineProvider>
      </Provider>
    </ThemeProvider>
  );
}
