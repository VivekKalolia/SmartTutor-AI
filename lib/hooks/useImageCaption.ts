"use client";

import { useState, useRef, useCallback } from "react";

interface ImageProcessResult {
  type: "math" | "diagram";
  content: string;
  latex?: string;
  processor: "pix2text" | "blip" | "fallback";
}

interface ImageWithCaption {
  file: File;
  url: string;
  caption: string;
  isLoading: boolean;
  isMath?: boolean;
  latex?: string;
  processor?: string;
}

interface UseImageCaptionOptions {
  onCaption?: (caption: string, imageUrl: string, result?: ImageProcessResult) => void;
  onError?: (error: string) => void;
}

const PYTHON_BACKEND_URL = "http://localhost:8000";

export function useImageCaption(options: UseImageCaptionOptions = {}) {
  const [image, setImage] = useState<ImageWithCaption | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const optionsRef = useRef(options);

  // Keep options ref updated
  optionsRef.current = options;

  const generateFallbackCaption = (file: File): string => {
    // Generate a simple caption based on file metadata
    const name = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    return `An uploaded image: ${name}`;
  };

  const captionImage = useCallback(async (file: File): Promise<string> => {
    setIsProcessing(true);

    // Create URL for preview
    const imageUrl = URL.createObjectURL(file);

    setImage({
      file,
      url: imageUrl,
      caption: "",
      isLoading: true,
    });

    try {
      // Send to Python backend - Smart processing (Pix2Text for math, BLIP for diagrams)
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${PYTHON_BACKEND_URL}/process-image`, {
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

      const result: ImageProcessResult & { success: boolean; debug?: any } = await response.json();      
      // Log detailed debug info if available
      if (result.debug) {      }

      // Use LaTeX if available (for math), otherwise use content
      const caption = result.type === "math" && result.latex 
        ? result.latex 
        : result.content || generateFallbackCaption(file);

      setImage((prev) =>
        prev
          ? {
              ...prev,
              caption,
              isLoading: false,
              isMath: result.type === "math",
              latex: result.latex,
              processor: result.processor,
            }
          : null
      );

      optionsRef.current.onCaption?.(caption, imageUrl, result);

      return caption;
    } catch (error) {
      console.error("[SmartVision] Image processing failed:", error);

      // Check if Python backend is running
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch") ||
          error.message.includes("Failed to fetch"));

      if (isNetworkError) {
        optionsRef.current.onError?.(
          "Python backend not running. Start it with: cd python_backend && source venv/bin/activate && python server.py"
        );
      } else {
        optionsRef.current.onError?.(
          error instanceof Error
            ? error.message
            : "Failed to process image. Please try again."
        );
      }

      // Use fallback caption
      const fallbackCaption = generateFallbackCaption(file);

      setImage((prev) =>
        prev
          ? {
              ...prev,
              caption: fallbackCaption,
              isLoading: false,
            }
          : null
      );

      optionsRef.current.onCaption?.(fallbackCaption, imageUrl);
      return fallbackCaption;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const processImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        optionsRef.current.onError?.("Please upload an image file.");
        return null;
      }

      const caption = await captionImage(file);
      return { file, caption };
    },
    [captionImage]
  );

  const clearImage = useCallback(() => {
    if (image?.url) {
      URL.revokeObjectURL(image.url);
    }
    setImage(null);
  }, [image]);

  return {
    image,
    isProcessing,
    processImageFile,
    captionImage,
    clearImage,
  };
}
