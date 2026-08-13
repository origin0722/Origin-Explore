/**
 * Explore — client-side document parsing (no backend).
 * pdf: unpdf (lightweight, no worker) · docx: mammoth · md/txt/html: native.
 */

import { extractText } from "unpdf";
import mammoth from "mammoth";
import type { DocKind } from "@/types/sites/ai-explore-poker-820d0558";

export const ACCEPTED_EXTENSIONS = [
  { ext: "pdf", label: "PDF", kind: "pdf" as DocKind, accept: ".pdf" },
  { ext: "docx", label: "Word", kind: "docx" as DocKind, accept: ".docx" },
  { ext: "md", label: "Markdown", kind: "md" as DocKind, accept: ".md,.markdown" },
  { ext: "txt", label: "纯文本", kind: "txt" as DocKind, accept: ".txt" },
  { ext: "html", label: "HTML", kind: "html" as DocKind, accept: ".html,.htm" },
];

export function kindFromName(name: string): DocKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "txt";
}

export function kindLabel(kind: DocKind): string {
  return ACCEPTED_EXTENSIONS.find((e) => e.kind === kind)?.label ?? kind.toUpperCase();
}

/** Extract plain text from a File, client-side only. */
export async function extractTextFromFile(file: File): Promise<{ kind: DocKind; content: string }> {
  const kind = kindFromName(file.name);

  if (kind === "pdf") {
    // unpdf accepts an ArrayBuffer / Blob at runtime; pass a buffer for its types.
    const arrayBuffer = await file.arrayBuffer();
    const { text } = await extractText(arrayBuffer, { mergePages: true });
    return { kind, content: text.trim() };
  }

  if (kind === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { kind, content: (result.value ?? "").trim() };
  }

  // md / txt / html — read as text.
  const content = await file.text();
  return { kind, content: content.trim() };
}

/** Very short docs are noise; give the reader a meaningful size floor. */
export function isParseable(content: string): boolean {
  return content.replace(/\s+/g, "").length >= 40;
}
