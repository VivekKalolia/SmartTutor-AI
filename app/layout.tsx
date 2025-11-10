import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const inter = localFont({
  src: [
    {
      path: "../public/fonts/Inter/Inter-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Inter/Inter-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/Inter/Inter-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Inter/Inter-MediumItalic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/fonts/Inter/Inter-SemiBold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Inter/Inter-SemiBoldItalic.otf",
      weight: "600",
      style: "italic",
    },
    {
      path: "../public/fonts/Inter/Inter-Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/Inter/Inter-BoldItalic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartTutor AI",
  description: "Professional academic learning platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

