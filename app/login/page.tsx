"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Lock, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Login failed. Please try again.");
        setIsSubmitting(false);
        return;
      }
      const role = data?.role as "student" | "teacher" | undefined;
      if (role === "teacher") {
        router.push("/teacher");
      } else {
        // Default to student landing page
        router.push("/");
      }
    } catch (err: any) {
      console.error("[Login] Error:", err);
      setError("Unexpected error. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Login to SmartTutor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <User className="h-4 w-4" />
                Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="teacher1 or student1"
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Lock className="h-4 w-4" />
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password123"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              style={{ cursor: "pointer" }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Demo accounts: <code>teacher1 / password123</code> (teacher) or{" "}
              <code>student1 / password123</code> (student).
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

