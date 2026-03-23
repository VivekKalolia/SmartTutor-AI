/**
 * Wire format for reasoning in the assistant message body.
 * Ollama exposes chain-of-thought as `message.thinking`; we merge it into the
 * stream using `think` XML-style markers the UI already expects.
 */
export const REASONING_OPEN = "<" + "think" + ">";
export const REASONING_CLOSE = "<" + "/" + "think" + ">";

export type ParsedReasoning = {
  hasReasoning: boolean;
  thinkingContent: string;
  displayContent: string;
  isThinking: boolean;
};

export function parseReasoningWire(raw: string): ParsedReasoning {
  const openIdx = raw.indexOf(REASONING_OPEN);
  if (openIdx === -1) {
    return {
      hasReasoning: false,
      thinkingContent: "",
      displayContent: raw,
      isThinking: false,
    };
  }
  const afterOpen = openIdx + REASONING_OPEN.length;
  const closeIdx = raw.indexOf(REASONING_CLOSE, afterOpen);
  if (closeIdx === -1) {
    return {
      hasReasoning: true,
      thinkingContent: raw.slice(afterOpen).trim(),
      displayContent: "",
      isThinking: true,
    };
  }
  return {
    hasReasoning: true,
    thinkingContent: raw.slice(afterOpen, closeIdx).trim(),
    displayContent: raw.slice(closeIdx + REASONING_CLOSE.length).trim(),
    isThinking: false,
  };
}

/** Remove reasoning block for TTS / copy / prefetch. */
export function stripReasoningWire(text: string): string {
  const escOpen = REASONING_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escClose = REASONING_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(escOpen + "[\\s\\S]*?" + escClose), "")
    .trim();
}

export function modelUsesReasoningUI(model: string | undefined): boolean {
  const m = (model ?? "").toLowerCase();
  return m.includes("deepseek") || m.includes("qwen3") || m.includes("gpt-oss");
}

export type ReasoningWireState = { blockOpen: boolean; prevThinking: string };

export function initialReasoningWireState(): ReasoningWireState {
  return { blockOpen: false, prevThinking: "" };
}

/** Merge Ollama stream `message.thinking` + `message.content` into one text chunk for the UI. */
export function ollamaChunkToReasoningWire(
  chunk: { message?: { content?: string; thinking?: string } },
  state: ReasoningWireState
): { wire: string; state: ReasoningWireState } {
  const msg = chunk.message;
  const content = msg?.content ?? "";
  const thinkRaw = msg?.thinking ?? "";
  let wire = "";
  let { blockOpen, prevThinking } = state;

  let thinkDelta = "";
  if (thinkRaw) {
    if (thinkRaw.startsWith(prevThinking)) {
      thinkDelta = thinkRaw.slice(prevThinking.length);
      prevThinking = thinkRaw;
    } else {
      thinkDelta = thinkRaw;
      prevThinking = prevThinking + thinkRaw;
    }
  }

  if (thinkDelta) {
    if (!blockOpen) {
      wire += REASONING_OPEN;
      blockOpen = true;
    }
    wire += thinkDelta;
  }
  if (content) {
    if (blockOpen) {
      wire += REASONING_CLOSE;
      blockOpen = false;
    }
    wire += content;
  }

  return { wire, state: { blockOpen, prevThinking } };
}
