/**
 * Generate a short caption for an extracted PDF figure/image using Llama 3.2 Vision 11B via Ollama.
 * Used at ingest so we can retrieve relevant images via caption embeddings at answer time.
 */

import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://localhost:11434" });
const VISION_MODEL = "llama3.2-vision:11b";

const CAPTION_PROMPT = `Describe this image from an educational document in 1-2 clear, concise sentences. Focus on what a student would need to know: diagrams, figures, equations, or key visual content. No preamble.`;

export async function captionPageImage(imageBase64: string): Promise<string> {
  const response = await ollama.chat({
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: CAPTION_PROMPT,
        images: [imageBase64],
      },
    ],
    stream: false,
    options: { temperature: 0.3, num_predict: 150 },
  });
  const caption = (response.message?.content ?? "").trim();
  return caption || "Figure from course materials.";
}
