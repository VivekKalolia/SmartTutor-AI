"use client";

import { Provider } from "react-redux";
import { store } from "@/lib/store";
import { Toaster } from "sonner";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <MantineProvider>
        {children}
        <Toaster position="top-center" richColors offset={10} />
      </MantineProvider>
    </Provider>
  );
}
