import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  createDocument,
  updateDocumentStatus,
  insertChunks,
  getUploadsDir,
  getPageImagesDir,
  insertPageImage,
} from "@/lib/rag/db";
import { chunkText } from "@/lib/rag/chunker";
import { generateEmbeddings, EMBEDDING_MODEL } from "@/lib/rag/embeddings";
import { invalidateEmbeddingCache } from "@/lib/rag/retriever";
import { extractTextAndPageImagesFromPDF } from "@/lib/rag/pdf-mupdf";
import { captionPageImage } from "@/lib/rag/caption-page-image";

export const runtime = "nodejs";
export const maxDuration = 300; // allow up to 5 min for large PDFs

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (
        stage: string,
        progress: number,
        message: string,
        extra?: Record<string, unknown>
      ) => {
        controller.enqueue(sseEvent({ stage, progress, message, ...extra }));
      };

      let docId = "";

      try {
        // --- Parse the multipart upload ---
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
          send("error", 0, "No file provided.");
          controller.close();
          return;
        }

        const fileName = file.name;
        if (!fileName.toLowerCase().endsWith(".pdf")) {
          send("error", 0, "Only PDF files are supported.");
          controller.close();
          return;
        }

        docId = crypto.randomUUID();

        // --- Step 1: Save file to disk ---
        send("uploading", 5, "Saving file...");
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = path.join(getUploadsDir(), `${docId}_${safeName}`);
        fs.writeFileSync(filePath, buffer);

        createDocument({
          id: docId,
          name: fileName,
          filePath,
          sizeBytes: file.size,
        });

        // --- Step 2: Extract text and embedded images from PDF with MuPDF.js ---
        send("extracting", 10, "Extracting text and embedded images from PDF (MuPDF)...");

        let numPages = 0;
        let pageTexts: string[] = [];
        let pageLabels: (string | null)[] = [];
        let embeddedImages: {
          pageIndex: number;
          imageIndex: number;
          mime: "image/jpeg" | "image/png";
          ext: "jpg" | "png";
          bytes: Buffer;
          fallback: boolean;
        }[] = [];

        try {
          const extracted = await extractTextAndPageImagesFromPDF(buffer);
          numPages = extracted.numPages;
          pageTexts = extracted.pageTexts;
          pageLabels = extracted.pageLabels;
          embeddedImages = extracted.embeddedImages;
        } catch (pdfError) {
          const msg =
            pdfError instanceof Error ? (pdfError as Error).message : String(pdfError);
          send("error", 0, `Failed to parse PDF: ${msg}`);
          updateDocumentStatus(docId, "error");
          controller.close();
          return;
        }

        if (numPages === 0 || pageTexts.length === 0) {
          send(
            "error",
            0,
            "Could not extract meaningful text from this PDF. It may be a scanned or empty document."
          );
          updateDocumentStatus(docId, "error");
          controller.close();
          return;
        }

        const pageChunks: { content: string; pageNumber: number }[] = [];
        for (let i = 0; i < pageTexts.length; i++) {
          // Prefer the printed page label from the PDF (e.g. "141") over the
          // physical position (i + 1 = 156). Fall back to physical if the label
          // is absent or not a valid integer.
          const rawLabel = pageLabels[i];
          const labelNum = rawLabel != null ? parseInt(rawLabel, 10) : NaN;
          const pageNumber = !isNaN(labelNum) && labelNum > 0 ? labelNum : i + 1;

          const pageText = pageTexts[i];
          if (!pageText || pageText.length < 30) continue;
          const chunksOnPage = chunkText(pageText);
          for (const ch of chunksOnPage) {
            if (ch.trim().length < 50) continue;
            pageChunks.push({ content: ch, pageNumber });
          }
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6612c82e-ab14-4977-8f67-cb59114501b0',{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'X-Debug-Session-Id':'81efef'
          },
          body:JSON.stringify({
            sessionId:'81efef',
            runId:'pdf-upload',
            hypothesisId:'H1',
            location:'app/api/rag/upload/route.ts:pageChunks',
            message:'Per-page pdf-parse extraction results',
            data:{numPages,pageTextsLength:pageTexts.length,pageChunks:pageChunks.length},
            timestamp:Date.now()
          })
        }).catch(()=>{});
        // #endregion

        if (pageChunks.length === 0) {
          send(
            "error",
            0,
            "No usable text chunks were created from this PDF after per-page extraction."
          );
          updateDocumentStatus(docId, "error");
          controller.close();
          return;
        }

        send(
          "extracting",
          20,
          `Extracted text from ${numPages} pages and created ${pageChunks.length} pre-chunks.`
        );

        // --- Step 2b: Extract embedded images via PyMuPDF (more reliable) ---
        // This is optional; if the Python backend isn't running, we fall back to MuPDF.js images.
        type PythonExtractImage = {
          page_index: number;
          image_index: number;
          ext: string;
          mime: string;
          base64: string;
          fallback: boolean;
        };
        let extractedImagesForCaption: {
          pageIndex: number;
          imageIndex: number;
          ext: "jpg" | "png";
          mime: string;
          bytes: Buffer;
          fallback: boolean;
        }[] = [];

        try {
          send("extracting", 22, "Extracting embedded images (PyMuPDF)...");
          const fd = new FormData();
          fd.set("file", new Blob([buffer], { type: "application/pdf" }), fileName);
          // Only extract real embedded raster images, no full-page thumbnails.
          // Thumbnails bloat the DB with low-signal images and waste Vision model calls.
          fd.set("thumbnail_if_none", "false");
          fd.set("thumbnail_scale", "0.5");
          const pyRes = await fetch(`${PYTHON_BACKEND_URL}/pdf/extract-images`, {
            method: "POST",
            body: fd,
          });
          if (pyRes.ok) {
            const pyJson = (await pyRes.json()) as {
              success: boolean;
              num_pages: number;
              images: PythonExtractImage[];
            };
            const images = Array.isArray(pyJson.images) ? pyJson.images : [];
            extractedImagesForCaption = images
              .map((img) => {
                const extLower = (img.ext || "").toLowerCase();
                const ext: "jpg" | "png" =
                  extLower === "jpeg" || extLower === "jpg" ? "jpg" : "png";
                return {
                  pageIndex: img.page_index,
                  imageIndex: img.image_index ?? 0,
                  ext,
                  mime: img.mime || (ext === "jpg" ? "image/jpeg" : "image/png"),
                  bytes: Buffer.from(img.base64, "base64"),
                  fallback: !!img.fallback,
                };
              })
              .filter((x) => x.bytes.length > 0);
          } else {
            const errText = await pyRes.text();
            console.error(`[RAG Upload] Python backend error: ${pyRes.status} ${errText}`);
            throw new Error(errText);
          }
        } catch {
          send("extracting", 23, "Python backend unavailable, using MuPDF.js (JPEG images only).");
          // Fallback to MuPDF.js embeddedImages (JPEG XObjects only; vector diagrams won't appear)
          extractedImagesForCaption = embeddedImages.map((img) => ({
            pageIndex: img.pageIndex,
            imageIndex: img.imageIndex,
            ext: img.ext,
            mime: img.mime,
            bytes: img.bytes,
            fallback: img.fallback,
          }));
        }

        // --- Step 3: Prepare chunks for embedding ---
        send("chunking", 25, "Preparing text chunks...");
        const chunks = pageChunks.map((c) => c.content);
        send("chunking", 30, `Created ${chunks.length} text chunks.`);

        // --- Step 4: Generate embeddings in batches ---
        const BATCH_SIZE = 20;
        const allChunkData: {
          content: string;
          chunkIndex: number;
          pageNumber: number;
          embedding: number[];
        }[] = [];

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const progress = 30 + Math.floor((i / chunks.length) * 60);
          send(
            "embedding",
            progress,
            `Generating embeddings (${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length})...`
          );

          let embeddings: number[][];
          try {
            embeddings = await generateEmbeddings(batch);
          } catch (embError) {
            const msg =
              embError instanceof Error ? embError.message : String(embError);
            send(
              "error",
              0,
              `Embedding failed: ${msg}\n\nMake sure Ollama is running and the model is available:\n  ollama pull ${EMBEDDING_MODEL}`
            );
            updateDocumentStatus(docId, "error");
            controller.close();
            return;
          }

          for (let j = 0; j < batch.length; j++) {
            const globalIndex = i + j;
            allChunkData.push({
              content: batch[j],
              chunkIndex: globalIndex,
              pageNumber: pageChunks[globalIndex].pageNumber,
              embedding: embeddings[j],
            });
          }
        }

        // --- Step 5: Save chunks + embeddings to DB ---
        send("saving", 88, "Saving to database...");
        insertChunks(docId, allChunkData);
        invalidateEmbeddingCache();

        // --- Step 6: Caption page images with Llama 3.2 Vision and store ---
        const pageImagesDir = getPageImagesDir();
        let captionedCount = 0;
        if (extractedImagesForCaption.length > 0) {
          send(
            "images",
            90,
            `Captioning ${extractedImagesForCaption.length} extracted images with Llama 3.2 Vision...`
          );
          for (let i = 0; i < extractedImagesForCaption.length; i++) {
            const img = extractedImagesForCaption[i];
            const rawLabel = pageLabels[img.pageIndex] ?? null;
            const labelNum =
              rawLabel != null ? parseInt(String(rawLabel), 10) : NaN;
            const pageNumber =
              !isNaN(labelNum) && labelNum > 0 ? labelNum : img.pageIndex + 1;

            const progressPct = 90 + Math.floor((i / extractedImagesForCaption.length) * 8);
            send(
              "images",
              progressPct,
              `Captioning image ${i + 1}/${extractedImagesForCaption.length} (page ${pageNumber})...`
            );

            try {
              const imageBase64 = img.bytes.toString("base64");
              const caption = await captionPageImage(imageBase64);
              const [captionEmbedding] = await generateEmbeddings([caption]);
              const imageFileName = `${docId}_page_${pageNumber}_img_${img.imageIndex}.${img.ext}`;
              const imagePath = path.join(pageImagesDir, imageFileName);
              fs.writeFileSync(imagePath, img.bytes);
              insertPageImage({
                document_id: docId,
                page_number: pageNumber,
                image_index: img.imageIndex,
                file_path: imagePath,
                caption,
                caption_embedding: captionEmbedding,
              });
              captionedCount++;
            } catch {
              /* skip failed image; others still process */
            }
          }
        }

        updateDocumentStatus(docId, "ready", numPages, chunks.length);

        send(
          "complete",
          100,
          `Done! ${numPages} pages, ${chunks.length} chunks indexed${
            captionedCount > 0
              ? `, ${captionedCount} extracted images captioned`
              : ""
          }.`,
          {
            documentId: docId,
          }
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[RAG Upload] Unexpected error:", error);
        try {
          send("error", 0, `Unexpected error: ${msg}`);
          if (docId) updateDocumentStatus(docId, "error");
        } catch {
          /* controller may already be closed */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
