"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { badgeVariants } from "@/components/ui/badge";

export interface RendererSource {
  index: number;
  documentName: string;
  content: string;
  score?: number;
  pageNumber?: number;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  sources?: RendererSource[];
}

const POPOVER_GAP = 8;
const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 240;

// ---------------------------------------------------------------------------
// CitationBadge – numbered circle; hover opens a floating, non-overlapping popover
// ---------------------------------------------------------------------------
function CitationBadge({ source }: { source: RendererSource }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    const badge = badgeRef.current;
    if (!badge) return;
    const rect = badge.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;
    const preferAbove = spaceAbove >= spaceBelow;
    const gap = POPOVER_GAP;
    const badgeCenterX = rect.left + rect.width / 2;
    let left = badgeCenterX - POPOVER_WIDTH / 2;
    left = Math.max(16, Math.min(left, vw - POPOVER_WIDTH - 16));
    const top = preferAbove ? rect.top - gap : rect.bottom + gap;
    setPosition({
      top,
      left,
      placement: preferAbove ? "above" : "below",
    });
  }, []);

  const handleOpen = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setOpen(true);
    updatePosition();
  }, [updatePosition]);

  const handleClose = useCallback(() => {
    leaveTimeoutRef.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const handleCloseNow = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  const popoverContent = open && position && typeof document !== "undefined" && (
    <div
      ref={popoverRef}
      className="fixed z-[100] rounded-xl border-2 border-border bg-background text-foreground shadow-2xl"
      style={{
        width: POPOVER_WIDTH,
        maxWidth: "calc(100vw - 2rem)",
        left: position.left,
        top: position.top,
        transform: position.placement === "above" ? "translateY(-100%)" : undefined,
      }}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex-shrink-0">
              {source.index}
            </span>
            <div className="min-w-0 flex flex-col">
              <span className="text-[11px] font-semibold text-primary truncate" title={source.documentName}>
                {source.documentName}
              </span>
              {source.pageNumber != null && (
                <span className="text-[10px] text-muted-foreground">p. {source.pageNumber}</span>
              )}
            </div>
          </div>
          <button
            onClick={handleCloseNow}
            className="text-muted-foreground hover:text-foreground transition-colors text-xs flex-shrink-0 p-0.5 rounded"
            type="button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div
          className="overflow-y-auto rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed text-foreground border border-border whitespace-pre-wrap"
          style={{ maxHeight: POPOVER_MAX_HEIGHT }}
        >
          {source.content.length > 800
            ? `${source.content.slice(0, 800).trimEnd()}…`
            : source.content}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span
        className="relative inline-flex items-center align-middle mx-0.5"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
      >
        <button
          ref={badgeRef}
          type="button"
          title={`Source ${source.index}: ${source.documentName}`}
          className={cn(
            badgeVariants({ variant: "default" }),
            "h-5 w-5 min-w-5 shrink-0 rounded-full p-0 text-[10px] font-bold leading-none hover:opacity-90 cursor-pointer select-none"
          )}
        >
          {source.index}
        </button>
      </span>
      {typeof document !== "undefined" && popoverContent && createPortal(popoverContent, document.body)}
    </>
  );
}

// ---------------------------------------------------------------------------
// remark plugin factory – turns [N] into span nodes with data-citation-index
// ---------------------------------------------------------------------------
function createRemarkCitations(sources?: RendererSource[]) {
  return function remarkCitations() {
    return (tree: unknown) => {
      if (!sources || sources.length === 0) return;

      // Recursively walk the mdast tree and rewrite text nodes
      const transformChildren = (node: any) => {
        if (!node || !Array.isArray(node.children)) return;

        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];

          if (child && child.type === "text" && typeof child.value === "string") {
            const parts = child.value.split(/(\[\d+\])/g);
            if (parts.length === 1) continue;

            const newChildren: any[] = [];
            for (const part of parts) {
              if (!part) continue;
              const match = part.match(/^\[(\d+)\]$/);
              if (match) {
                const idx = parseInt(match[1], 10);
                const src = sources.find((s) => s.index === idx);
                if (src) {
                  newChildren.push({
                    type: "citeReference",
                    data: {
                      hName: "span",
                      hProperties: { "data-citation-index": idx },
                    },
                    children: [],
                  });
                  continue;
                }
              }
              newChildren.push({
                type: "text",
                value: part,
              });
            }

            if (newChildren.length > 0) {
              node.children.splice(i, 1, ...newChildren);
              i += newChildren.length - 1;
            }
          } else {
            transformChildren(child);
          }
        }
      };

      transformChildren(tree);
    };
  };
}

/**
 * Convert a LaTeX tabular body (between \begin{tabular} and \end{tabular})
 * into a GFM markdown table string.
 */
function tabularToMarkdown(body: string): string {
  const rows = body
    .replace(/\\hline/g, "")
    .split(/\\\\/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  if (rows.length === 0) return "";

  const cells = rows.map((r) =>
    r.split("&").map((c) => c.trim().replace(/\s+/g, " ") || " ")
  );

  const colCount = Math.max(...cells.map((r) => r.length));
  const pad = (row: string[]) =>
    Array.from({ length: colCount }, (_, i) => row[i] ?? "");

  const [header, ...body2] = cells;
  const headerRow = `| ${pad(header).join(" | ")} |`;
  const sepRow = `| ${Array(colCount).fill("---").join(" | ")} |`;
  const bodyRows = body2.map((r) => `| ${pad(r).join(" | ")} |`);

  return [headerRow, sepRow, ...bodyRows].join("\n");
}

// Preprocess content to handle various formatting issues
function preprocessContent(content: string): string {
  let processed = content;

  // Convert LaTeX tabular environments to GFM markdown tables.
  // KaTeX has no tabular support; this covers both bare \begin{tabular}
  // and the common \begin{center}\begin{tabular}…\end{tabular}\end{center} pattern.
  processed = processed.replace(
    /(?:\\begin\{center\}\s*)?\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}(?:\s*\\end\{center\})?/g,
    (_, tableBody: string) => "\n\n" + tabularToMarkdown(tableBody) + "\n\n"
  );

  // Fix \left$$ and \right$$ where model output $$ instead of ( and )
  processed = processed.replace(/\\left\$\$/g, '\\left(');
  processed = processed.replace(/\\right\$\$/g, '\\right)');
  // Spaced variant: \left $ $ or \left  $$
  processed = processed.replace(/\\left\s*\$\s*\$/g, '\\left(');
  processed = processed.replace(/\\right\s*\$\s*\$/g, '\\right)');
  processed = processed.replace(/\\left\$/g, '\\left(');
  processed = processed.replace(/\\right\$/g, '\\right)');
  // Prefer brace delimiters when model emits \left${ ... \right$}
  processed = processed.replace(/\\left\$\s*\{/g, "\\left\\{");
  processed = processed.replace(/\\right\$\s*\}/g, "\\right\\}");
  // Fix malformed \left / \right delimiters with missing braces/paren chars.
  // Examples:
  // - \leftx_{0} -> \left(x_{0}
  // - \rightx -> \right)x
  processed = processed.replace(/\\left(?=[A-Za-z0-9\\])/g, "\\left(");
  processed = processed.replace(/\\right(?=[A-Za-z0-9\\])/g, "\\right)");

  // Fix inline math accidentally used as function arguments, e.g.:
  //   f$r \sin \theta, r \cos \theta$ -> f(r \sin \theta, r \cos \theta)
  processed = processed.replace(/([A-Za-z])\$([^$\n]{1,200})\$/g, (_, fn, inner) => {
    const candidate = String(inner).trim();
    if (candidate.length === 0) return `${fn}$${inner}$`;
    if (!/[\\,()^_+\-*/=]/.test(candidate) && !candidate.includes(" ")) {
      return `${fn}$${inner}$`;
    }
    return `${fn}(${candidate})`;
  });
  // Handle function-subscript form: f_{X|Y}$x|y$ -> f_{X|Y}(x|y)
  processed = processed.replace(
    /([A-Za-z]_\{[^}]+\})\$([^$\n]{1,220})\$/g,
    (_, fn, inner) => `${fn}(${String(inner).trim()})`
  );
  // Handle explicit conditional density notation: f_{\mathrm{X|Y}}$x \mid y$=...
  processed = processed.replace(
    /(f_\{\\mathrm\{[^}]+\}\})\$([^$\n]{1,220})\$/g,
    (_, lhs, inner) => `${lhs}(${String(inner).trim()})`
  );

  // Fix malformed arrows produced by broken \rightarrow tokenization.
  // Examples: \right)arrow, \right) arrow
  processed = processed.replace(/\\right\)\s*arrow/g, "\\rightarrow");

  // Collapse line breaks inside superscript/subscript braces: y^{\n′\n′} -> y^{′′}
  processed = processed.replace(/([\^_]\{)[^}]*\}/g, (match) => {
    return match.replace(/\n/g, '');
  });

  // Collapse stray newlines inside $$...$$ display math blocks
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    const collapsed = inner.replace(/\n+/g, ' ').trim();
    return `$$${collapsed}$$`;
  });

  // Fix patterns like "$$y - y_1 = m$x - x_1$$" where $ is used instead of (
  // The model is confusing $ with parentheses
  processed = processed.replace(/\$\$([^$]*?)\$([^$]+?)\$\$/g, (match, before, after) => {
    // Check if this looks like a broken expression (has variables/operators on both sides)
    if (/[a-zA-Z_0-9]\s*$/.test(before) && /^[a-zA-Z_]/.test(after)) {
      return `$$${before}(${after})$$`;
    }
    // Otherwise just remove the stray $
    return `$$${before}${after}$$`;
  });

  // Fix triple or more $ signs that break LaTeX (e.g., $$$x$$$ -> $$x$$)
  processed = processed.replace(/\${3,}/g, '$$');

  // Fix patterns like "$$x_1, y_1=" without proper closing - these are incomplete
  // Convert to inline math with proper formatting
  processed = processed.replace(/\$\$\s*([a-z]_\d+,\s*[a-z]_\d+)\s*=\s*(?!\$)/gi, (_, vars) => {
    return `$(${vars}) = `;
  });

  // Fix orphaned display math markers at line starts/ends
  // Remove stray $$ that don't have matching pairs
  processed = processed.replace(/^\$\$\s*$/gm, '');
  
  // Fix inline $..$ that got mixed with text - look for $ followed by LaTeX commands not properly closed
  // e.g., "$\int_{1}^{3} (2x + 1$ , dx )" -> "$\int_{1}^{3} (2x + 1) \, dx$"
  processed = processed.replace(/\$([^$]+)\$\s*,\s*([a-z]+)\s*\)/gi, (match, inner, suffix) => {
    // Check if this looks like an integral pattern
    if (suffix.toLowerCase() === 'dx' || suffix.toLowerCase() === 'dy' || suffix.toLowerCase() === 'dt') {
      return `$${inner} \\, ${suffix}$`;
    }
    return match;
  });

  // Fix "Assume$g = 9.8" patterns where $ got attached to text
  processed = processed.replace(/([a-zA-Z])(\$)([a-zA-Z])/g, '$1 $2$3');

  // Fix "\text{m/s}^2$$" at end of lines - remove trailing $$
  processed = processed.replace(/\\text\{[^}]+\}\^?\d*\$\$\.?$/gm, (match) => {
    return match.replace(/\$\$$/, '');
  });

  // Convert LaTeX display math \[...\] to $$...$$ format (better compatibility)
  // This handles the block math format that DeepSeek uses
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    // Clean up the math content and wrap in $$ for display math
    return `$$${math.trim()}$$`;
  });

  // Convert LaTeX inline math \(...\) to $...$ format
  // This handles inline math expressions in parentheses
  processed = processed.replace(/\\\(([^)]+?)\\\)/g, (_, math) => {
    return `$${math.trim()}$`;
  });

  // Fix malformed LaTeX patterns like $\sin(A + B$) -> $\sin(A + B)$
  // Pattern: $...(...$) where the closing $ is after a )
  processed = processed.replace(/\$([^$]*)\$\)/g, (match, math) => {
    // Check if there's an unclosed parenthesis
    const openParens = (math.match(/\(/g) || []).length;
    const closeParens = (math.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      return `$${math})$`;
    }
    return match;
  });

  // Fix pattern like $\sin(60^\circ + 30^\circ= sin90^\circ$)
  // Where the ) is outside the $...$
  processed = processed.replace(/\$([^$]+)\$\)/g, "$$$1)$$");

  // Fix split inline operators: "A \cap B$ \cup$A \cap C" -> "A \cap B \cup A \cap C"
  processed = processed.replace(/\$\s*\\cup\s*\$/g, " \\cup ");
  // Stray $ around set/logic ops: "A \cup B$ \cap$A \cup C"
  processed = processed.replace(
    /([A-Za-z0-9)\]\}])\$\s+(?=\\(?:cap|cup|land|lor|wedge|vee)\b)/g,
    "$1 "
  );
  processed = processed.replace(
    /\\(cap|cup|land|lor|wedge|vee)\s*\$([A-Za-z])/g,
    "\\$1 $2"
  );
  processed = processed.replace(
    /\$\s*\\(cap|cup|land|lor|wedge|vee)\s*\$/g,
    (_m, op: string) => ` \\${op} `
  );
  // \right glued to a quote (missing closing paren)
  processed = processed.replace(/\\right\s*"(?!\))/g, '\\right)"');
  processed = processed.replace(/\\right\s*'(?!\))/g, "\\right)'");

  // Fix rank notation split as "$r$\boldsymbol{A}" -> "$r(\\boldsymbol{A})$"
  processed = processed.replace(
    /\$r\$\s*\\boldsymbol\{([^}]+)\}/g,
    (_, m) => `$r(\\boldsymbol{${m}})$`
  );

  // Handle LaTeX expressions in parentheses like (\sin 60^\circ \cos 30^\circ)
  // Match parentheses that contain LaTeX commands, math operators, or math symbols
  processed = processed.replace(/\(([^)]*(?:\\[a-zA-Z]+\{[^}]*\}|\\[a-zA-Z]+|[\^_°])[^)]*)\)/g, (match, mathContent) => {
    // Check if it contains LaTeX commands
    const isMath = /\\[a-zA-Z]|[\^_°]/.test(mathContent);
    if (isMath) {
      return `$${mathContent.trim()}$`;
    }
    return match;
  });

  // Convert standalone [ and ] on their own lines (partial LaTeX artifacts)
  processed = processed.replace(/^\s*\[\s*$/gm, "");
  processed = processed.replace(/^\s*\]\s*$/gm, "");

  // Handle \boxed{} - ensure it's wrapped in $ if not already
  processed = processed.replace(/(?<!\$)\\boxed\{([^}]+)\}(?!\$)/g, "$$\\boxed{$1}$$");

  // Fix missing backslash on common LaTeX commands (e.g., "frac{1}{2}" → "\frac{1}{2}")
  processed = processed.replace(/(?<![\\a-zA-Z])(frac|sqrt)\{/g, '\\$1{');

  // Wrap bare LaTeX commands that aren't inside $...$ delimiters.
  // Handles quiz options like "\frac{1}{2}" and inline commands like "\lambda" in mixed text.
  {
    const t = processed.trim();
    if (/^\\[a-zA-Z]{2,}/.test(t) && !/\$/.test(t)) {
      // Entire content is bare LaTeX with no $ at all - wrap everything
      processed = `$${t}$`;
    } else if (/\\[a-zA-Z]{2,}/.test(processed)) {
      // Mixed content: split around existing math regions, wrap bare LaTeX in non-math segments
      const mathSplitParts = processed.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);
      processed = mathSplitParts
        .map((part, idx) => {
          // Odd indices are captured math regions - leave untouched
          if (idx % 2 === 1) return part;
          // In non-math text, wrap contiguous bare \command{args} sequences
          return part.replace(
            /(\\[a-zA-Z]{2,}(?:\{[^}]*\})*(?:[\^_](?:\{[^}]*\}|[a-zA-Z0-9]))*(?:\s*(?:[-+=<>,.]|\\[a-zA-Z]{2,}(?:\{[^}]*\})*(?:[\^_](?:\{[^}]*\}|[a-zA-Z0-9]))*))*)/g,
            (match) => `$${match.trim()}$`
          );
        })
        .join("");
    }
  }

  // Convert unicode bullets to proper markdown list items
  // Handle patterns like "• item" at the start of lines
  processed = processed.replace(/^[•●○◦▪▸►]/gm, "-");

  // Handle inline bullet patterns like "text • item • item"
  // Convert to new lines with bullets
  processed = processed.replace(/\s+[•●○◦▪▸►]\s+/g, "\n- ");

  // Ensure numbered lists are properly formatted
  processed = processed.replace(/^(\d+)\.\s*/gm, "$1. ");

  // Handle inline numbered patterns
  processed = processed.replace(/\s+(\d+)\.\s+/g, "\n$1. ");

  // Ensure double newlines for paragraph breaks where there's just one
  // But don't add extra newlines if already present
  processed = processed.replace(/([^\n])\n([^\n])/g, "$1\n\n$2");

  return processed;
}

export function MarkdownRenderer({
  content,
  className = "",
  sources,
}: MarkdownRendererProps) {
  const processedContent = preprocessContent(content);

  const hasSources = sources && sources.length > 0;

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere ${className}`}>
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          remarkMath,
          remarkBreaks,
          ...(hasSources ? [createRemarkCitations(sources)] : []),
        ]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc ml-4 mb-3 space-y-1.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal ml-4 mb-3 space-y-1.5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto ${codeClassName || ""}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-muted p-3 rounded-md overflow-x-auto mb-3">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground mb-3">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold mb-2">{children}</h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary underline hover:no-underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 bg-muted font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          br: () => <br className="my-1" />,
          // Render citation span as a circular badge with popover
          span: ({ node, children, ...rest }: any) => {
            const citationIndex =
              node && node.properties && node.properties["data-citation-index"];
            if (citationIndex && hasSources) {
              const indexNumber = Number(citationIndex);
              const src = sources!.find((s) => s.index === indexNumber);
              if (src) {
                return <CitationBadge source={src} />;
              }
            }
            // Fallback to normal span
            return <span {...rest}>{children}</span>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
