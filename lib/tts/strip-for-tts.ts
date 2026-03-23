/**
 * Turn markdown / LaTeX-heavy text into plain speech-friendly text for TTS.
 * Used by useTTS so prefetch and speak share the same normalization (cache hits).
 */

export function stripForTTS(raw: string): string {
  if (!raw || !raw.trim()) return "";

  let s = raw;

  // fenced code blocks
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]+`/g, " ");

  // display math
  s = s.replace(/\$\$[\s\S]*?\$\$/g, " (formula) ");
  // inline math
  s = s.replace(/\$[^$\n]+\$/g, " (formula) ");

  // \[ \] and \( \) style
  s = s.replace(/\\\[[\s\S]*?\\\]/g, " (formula) ");
  s = s.replace(/\\\([^)]*\\\)/g, " (formula) ");

  // common LaTeX commands left bare
  s = s.replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, " ");

  // markdown headers / emphasis / links
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // citations [1], [2]
  s = s.replace(/\[\d+\]/g, "");

  s = s.replace(/\s+/g, " ").trim();
  return s || raw.slice(0, 500);
}
