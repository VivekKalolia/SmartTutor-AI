/** Trim and shorten plain text at a word boundary when possible. */
export function truncatePlainText(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, Math.max(1, maxLen - 3));
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trim()}...`;
}
