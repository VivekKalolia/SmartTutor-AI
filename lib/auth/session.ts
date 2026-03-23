export const AUTH_COOKIE_NAME = "smarttutor_session";

export type UserRole = "student" | "teacher";

export interface SessionPayload {
  userId: string;
  username: string;
  role: UserRole;
}

function getSecret(): string {
  // Simple secret for signing session cookies. In production you should
  // configure AUTH_SECRET in the environment.
  return process.env.AUTH_SECRET || "dev-smarttutor-secret";
}

// Simple base64-encoded JSON session. For this offline project we do not
// sign/encrypt the payload; we only encode/decode it. This keeps the code
// compatible with both Node.js and the Edge runtime (middleware) without
// relying on the Node "crypto" module.

function encodePayload(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa !== "undefined") {
    return btoa(json);
  }
  // Node.js fallback
  const Buf = (globalThis as any).Buffer as
    | { from: (input: string, encoding: BufferEncoding) => { toString: (enc: string) => string } }
    | undefined;
  if (!Buf) throw new Error("Buffer not available in this runtime");
  return Buf.from(json, "utf8").toString("base64");
}

function decodePayload(token: string): SessionPayload | null {
  try {
    let json: string;
    if (typeof atob !== "undefined") {
      json = atob(token);
    } else {
      // Node.js fallback
      const Buf = (globalThis as any).Buffer as
        | { from: (input: string, encoding: BufferEncoding) => { toString: (enc: string) => string } }
        | undefined;
      if (!Buf) throw new Error("Buffer not available in this runtime");
      json = Buf.from(token, "base64").toString("utf8");
    }
    const payload = JSON.parse(json) as SessionPayload;
    if (
      !payload ||
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      (payload.role !== "student" && payload.role !== "teacher")
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function signSession(payload: SessionPayload): string {
  return encodePayload(payload);
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  return decodePayload(token);
}

