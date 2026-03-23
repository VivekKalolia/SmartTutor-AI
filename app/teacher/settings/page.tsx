"use client";

import TeacherLayout from "@/components/teacher-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { useState } from "react";

export default function TeacherSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
      console.error("[TeacherSettings] Change password error:", e);
      setPasswordError("Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <TeacherLayout>
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
        </div>
      </div>
    </TeacherLayout>
  );
}

