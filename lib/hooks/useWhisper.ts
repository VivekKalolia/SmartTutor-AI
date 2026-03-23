"use client";

import { useState, useRef, useCallback } from "react";

interface UseWhisperOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

const PYTHON_BACKEND_URL = "http://localhost:8000";

export function useWhisper(options: UseWhisperOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const optionsRef = useRef(options);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep options ref updated
  optionsRef.current = options;

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    if (audioBlob.size < 1000) {
      optionsRef.current.onError?.("Recording too short. Please try again.");
      setIsTranscribing(false);
      return;
    }

    try {
      // Send to Python backend (OpenAI Whisper offline)
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      const response = await fetch(`${PYTHON_BACKEND_URL}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 0 || response.status === 500) {
          throw new Error(
            "Python backend not running. Start it with: cd python_backend && source venv/bin/activate && python server.py"
          );
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      const text = (result.text || "").trim();

      if (text) {
        setTranscript(text);
        optionsRef.current.onTranscript?.(text);
      } else {
        optionsRef.current.onError?.(
          "Could not understand audio. Please try again."
        );
      }
    } catch (error) {
      console.error("Transcription failed:", error);

      // Check if Python backend is running
      const errorMessage =
        error instanceof Error &&
        (error.message.includes("fetch") ||
          error.message.includes("Failed to fetch"))
          ? "Python backend not running. Start it with: cd python_backend && source venv/bin/activate && python server.py"
          : error instanceof Error
            ? error.message
            : "Failed to transcribe audio. Please try again.";

      optionsRef.current.onError?.(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Try different mime types for better compatibility
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
      }
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Create audio blob
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;

      // Request data every 250ms for better capture
      mediaRecorder.start(250);
      setIsRecording(true);    } catch (error) {
      console.error("Failed to start recording:", error);
      optionsRef.current.onError?.(
        "Microphone access denied. Please allow microphone access."
      );
    }
  }, [transcribeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isTranscribing,
    transcript,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
