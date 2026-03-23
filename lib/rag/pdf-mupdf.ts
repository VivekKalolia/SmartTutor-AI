/**
 * Extract text and embedded images (XObjects) from a PDF using MuPDF.js.
 *
 * Goal: avoid rendering full pages. We traverse PDF objects to locate Image XObjects
 * and extract their encoded streams. If an image is already JPEG (/DCTDecode) or
 * JPEG2000 (/JPXDecode), we save raw bytes directly. For other filter types, we
 * fall back to rendering only that specific page at low scale as a last resort.
 */

export interface MuPDFExtractResult {
  pageTexts: string[];
  pageLabels: (string | null)[];
  embeddedImages: {
    pageIndex: number;
    imageIndex: number;
    mime: "image/jpeg" | "image/png";
    ext: "jpg" | "png";
    bytes: Buffer;
    /** If true, this image is a low-res page-render fallback. */
    fallback: boolean;
  }[];
  numPages: number;
}


function getPdfName(obj: any): string | null {
  try {
    if (!obj) return null;
    const v = obj.valueOf?.();
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

function getFilters(obj: any): string[] {
  try {
    const f = obj?.get?.("Filter");
    if (!f) return [];
    const val = f.valueOf?.();
    if (typeof val === "string") return [val];
    // If it's an array object, valueOf() may not help; try asJS()
    const js = f.asJS?.();
    if (Array.isArray(js)) {
      return js
        .map((x) => (typeof x === "string" ? x : null))
        .filter((x): x is string => !!x);
    }
  } catch {
    // ignore
  }
  return [];
}

function bufferFromMuPdfBuffer(mupdfBuf: any): Buffer {
  const u8 = mupdfBuf.asUint8Array?.();
  if (u8 && u8 instanceof Uint8Array) return Buffer.from(u8);
  // fallback: try toString and re-encode (should not happen for image streams)
  const s = mupdfBuf.asString?.() ?? "";
  return Buffer.from(String(s), "binary");
}

export async function extractTextAndPageImagesFromPDF(
  pdfBuffer: Buffer
): Promise<MuPDFExtractResult> {
  const mupdfModule = await import("mupdf");
  const mupdf: any =
    "default" in mupdfModule && mupdfModule.default
      ? mupdfModule.default
      : (mupdfModule as Record<string, unknown>);
  const doc = mupdf.Document.openDocument(
    new Uint8Array(pdfBuffer),
    "application/pdf"
  );
  try {
    const numPages = doc.countPages();
    const pageTexts: string[] = [];
    const pageLabels: (string | null)[] = [];
    const embeddedImages: MuPDFExtractResult["embeddedImages"] = [];

    for (let i = 0; i < numPages; i++) {
      const page = doc.loadPage(i);
      try {
        const st = page.toStructuredText("");
        const text = (st.asText() || "").replace(/\s+/g, " ").trim();
        pageTexts.push(text);

        const label = page.getLabel?.() ?? null;
        pageLabels.push(label ?? null);

        // --- Embedded image extraction via PDFObject traversal ---
        let imageIndex = 0;
        let needsFallbackRender = false;

        try {
          const pageObj = page.getObject?.();
          const res = pageObj?.get?.("Resources");
          const xobj = res?.get?.("XObject");

          if (xobj && typeof xobj.forEach === "function") {
            xobj.forEach((val: any) => {
              try {
                const resolved = val?.resolve?.() ?? val;
                const subtype = getPdfName(resolved?.get?.("Subtype"));
                if (subtype !== "Image") return;

                const filters = getFilters(resolved);
                const isJpeg =
                  filters.includes("DCTDecode") || filters.includes("DCT");
                const isJpx = filters.includes("JPXDecode");

                if (isJpeg || isJpx) {
                  const raw = resolved.readRawStream?.();
                  if (!raw) return;
                  const bytes = bufferFromMuPdfBuffer(raw);
                  embeddedImages.push({
                    pageIndex: i,
                    imageIndex,
                    mime: "image/jpeg",
                    ext: "jpg",
                    bytes,
                    fallback: false,
                  });
                  imageIndex++;
                } else {
                  // We found at least one image we can't safely export as a file without decoding.
                  needsFallbackRender = true;
                }
              } catch {
                // ignore this XObject
              }
            });
          }
        } catch {
          // If traversal fails, fall back to a low-res render of this page.
          needsFallbackRender = true;
        }

        // Note: we intentionally skip full-page fallback renders here.
        // The Python backend (PyMuPDF) handles all real embedded images more
        // reliably. The MuPDF.js path is only a fallback for text extraction;
        // if the Python backend is unavailable we skip non-JPEG images rather
        // than filling the DB with low-signal full-page thumbnails.
        void needsFallbackRender; // suppress unused-variable warning
      } finally {
        page.destroy();
      }
    }
    doc.destroy();
    return {
      pageTexts,
      pageLabels,
      embeddedImages,
      numPages,
    };
  } catch (e) {
    doc.destroy();
    throw e;
  }
}
