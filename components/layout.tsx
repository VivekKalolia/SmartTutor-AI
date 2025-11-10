"use client";

import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto px-6">
          <div className="py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
