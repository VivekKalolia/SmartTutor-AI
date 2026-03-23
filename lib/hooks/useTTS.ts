"use client";

import { useCallback, useRef, useState } from "react";

interface UseTTSOptions {
  voice?: string;
  speed?: number;
  lang?: string;
}

interface UseTTSReturn {
  speak: (text: string, id: string) => void;
  /**
   * Pre-generate audio and cache it, without playing immediately.
   * Useful to start TTS processing as soon as an AI reply is complete.
   */
  prefetch: (text: string) => void;
  stop: () => void;
  speakingId: string | null;
  isLoading: boolean;
}

/**
 * Custom hook for Text-to-Speech using Kokoro TTS backend.
 * Falls back to browser speechSynthesis if the backend is unavailable.
 */
export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  // Resolve voice preference:
  // 1) Explicit option passed to the hook
  // 2) Saved user preference from settings (localStorage key: "tts-voice")
  // 3) Default Kokoro voice: af_heart
  const [resolvedVoice] = useState(() => {
    if (options.voice) return options.voice;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("tts-voice");
      if (stored && stored.trim().length > 0) {
        return stored;
      }
    }
    return "af_heart";
  });
  const { speed = 1.0, lang = "en-us" } = options;

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Cache of generated audio URLs keyed by text + voice + speed + lang
  const cacheRef = useRef<Map<string, string>>(new Map());

  const makeCacheKey = useCallback(
    (text: string) => `${resolvedVoice}::${speed}::${lang}::${text}`,
    [resolvedVoice, speed, lang]
  );

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    // Do NOT revoke or remove cached URLs here.
    // - The cache keeps one URL per (voice,speed,lang,text) combination.
    // - Reusing the same URL lets us replay immediately without reprocessing.
    // We only clear the current reference; the cached URL remains valid.
    objectUrlRef.current = null;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const fallbackToSpeechSynthesis = useCallback(
    (text: string, id: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingId(id);
      setIsLoading(false);
    },
    []
  );

  const stop = useCallback(() => {
    cleanup();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setIsLoading(false);
  }, [cleanup]);

  const generateAndCache = useCallback(
    async (text: string): Promise<string | null> => {
      const key = makeCacheKey(text);
      const existing = cacheRef.current.get(key);
      if (existing) return existing;

      if (!text || !text.trim()) return null;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: resolvedVoice, speed, lang }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("TTS backend unavailable");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        cacheRef.current.set(key, url);
        return url;
      } catch (err: unknown) {
        if (err && typeof err === "object" && (err as { name?: string }).name === "AbortError")
          return null;
        return null;
      }
    },
    [makeCacheKey, resolvedVoice, speed, lang]
  );

  const prefetch = useCallback(
    (text: string) => {
      // Fire and forget – we don't set speakingId here
      void generateAndCache(text);
    },
    [generateAndCache]
  );

  const speak = useCallback(
    (text: string, id: string) => {
      // Toggle off if already speaking this id
      if (speakingId === id) {
        stop();
        return;
      }

      // Stop any current speech
      stop();

      if (!text || !text.trim()) return;

      setIsLoading(true);
      setSpeakingId(id);

      const key = makeCacheKey(text);
      const cachedUrl = cacheRef.current.get(key);

      const playFromUrl = (url: string) => {
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeakingId(null);
          setIsLoading(false);
          cleanup();
        };
        audio.onerror = () => {
          setSpeakingId(null);
          setIsLoading(false);
          cleanup();
        };

        setIsLoading(false);
        audio.play().catch(() => {
          setSpeakingId(null);
          setIsLoading(false);
          cleanup();
        });
      };

      if (cachedUrl) {
        playFromUrl(cachedUrl);
        return;
      }

      generateAndCache(text)
        .then((url) => {
          if (url) {
            playFromUrl(url);
          } else {
            // If generation failed, fall back to browser TTS
            fallbackToSpeechSynthesis(text, id);
          }
        })
        .catch(() => {
          fallbackToSpeechSynthesis(text, id);
        });
    },
    [speakingId, stop, cleanup, generateAndCache, fallbackToSpeechSynthesis, makeCacheKey]
  );

  return { speak, prefetch, stop, speakingId, isLoading };
}
