/**
 * Splits extracted text into overlapping chunks suitable for embedding.
 * Tries to break at sentence boundaries so chunks stay semantically coherent.
 */
export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (cleaned.length === 0) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    if (end >= cleaned.length) {
      const tail = cleaned.slice(start).trim();
      if (tail.length > 50) chunks.push(tail);
      break;
    }

    // Try to find a sentence boundary near the target end position
    const windowStart = Math.max(end - 150, start);
    const windowEnd = Math.min(end + 150, cleaned.length);
    const window = cleaned.slice(windowStart, windowEnd);

    let bestBreak = -1;
    // Prefer paragraph breaks, then sentence-ending punctuation
    const paragraphBreak = window.lastIndexOf("\n\n");
    if (paragraphBreak > 0) {
      bestBreak = paragraphBreak;
    } else {
      const period = window.lastIndexOf(". ");
      const question = window.lastIndexOf("? ");
      const exclamation = window.lastIndexOf("! ");
      const newline = window.lastIndexOf("\n");
      bestBreak = Math.max(period, question, exclamation, newline);
    }

    if (bestBreak > 0) {
      end = windowStart + bestBreak + 1;
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}
