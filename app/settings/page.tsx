"use client";

import Layout from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

const KOKORO_VOICES: { id: string; label: string; description: string }[] = [
  { id: "af_heart", label: "af_heart (US Female - warm)", description: "Default, warm American female voice." },
  { id: "af_bella", label: "af_bella (US Female - bright)", description: "Bright, energetic American female voice." },
  { id: "af_sarah", label: "af_sarah (US Female - clear)", description: "Clear, neutral American female voice." },
  { id: "am_adam", label: "am_adam (US Male)", description: "Standard American male voice." },
  { id: "bf_emma", label: "bf_emma (UK Female)", description: "British female voice." },
  { id: "bm_george", label: "bm_george (UK Male)", description: "British male voice." },
];

export default function StudentSettings() {
  const [ttsVoice, setTtsVoice] = useState<string>("af_heart");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load saved preference on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("tts-voice");
    if (stored && stored.trim().length > 0) {
      setTtsVoice(stored);
    }
  }, []);

  const handleVoiceChange = (voiceId: string) => {
    setTtsVoice(voiceId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tts-voice", voiceId);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMessage(null);
    setPasswordError(null);
    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in both fields.");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password.");
      } else {
        setPasswordMessage("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch (e) {
      console.error("[Settings] Change password error:", e);
      setPasswordError("Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="flex justify-center">
        <div className="w-full max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account and portal preferences
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Change Password</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    style={{ cursor: "pointer" }}
                    onClick={handlePasswordChange}
                    disabled={changingPassword}
                  >
                    {changingPassword ? "Updating..." : "Update"}
                  </Button>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
                {passwordMessage && (
                  <p className="text-sm text-green-600">{passwordMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Text-to-Speech (Kokoro)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tts-voice">Preferred voice</Label>
              </div>
              <div className="space-y-2">
                <select
                  id="tts-voice"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={ttsVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  style={{ cursor: "pointer" }}
                >
                  {KOKORO_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

