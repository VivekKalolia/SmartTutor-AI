"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (e) {
        console.error("[Logout] Error:", e);
      } finally {
        setDone(true);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Logout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <>
              <p className="text-sm">
                You have been logged out of SmartTutor.
              </p>
              <Button
                onClick={() => router.push("/login")}
                style={{ cursor: "pointer" }}
                className="w-full"
              >
                Go to Login
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Logging you out...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

