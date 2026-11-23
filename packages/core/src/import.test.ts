import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  detectSourceKind,
  knowledgeCandidateSchema,
  localKnowledgeFallback,
  parseMarkdownQuestions,
  safeFileName
} from "./index";

const notesDir = path.join(import.meta.dirname, "..", "..", "test-fixtures", "notes");

describe("Markdown import", () => {
  test("splits Q&A headings and keeps source questions", async () => {
    const markdown = await fs.readFile(path.join(notesDir, "cpp-class-basics.md"), "utf8");
    const chunks = parseMarkdownQuestions(markdown);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks.some((chunk) => chunk.questions.length > 0)).toBe(true);
  });

  test("builds a candidate that passes the shared schema", () => {
    const candidate = localKnowledgeFallback(
      "C++ 虚函数允许通过基类指针按动态类型调用派生类实现。",
      "C++ 虚函数"
    );
    expect(knowledgeCandidateSchema.safeParse(candidate).success).toBe(true);
    expect(candidate.moduleHint).toBe("C++");
  });

  test("detects images by an allowed extension when MIME is generic", () => {
    expect(detectSourceKind("shot.png", "application/octet-stream")).toBe("image");
    expect(detectSourceKind("notes.md", "application/octet-stream")).toBe("markdown");
    expect(detectSourceKind("archive.zip", "application/zip")).toBe("unsupported");
  });

  test("sanitizes traversal-like file names", () => {
    expect(safeFileName("../坏:文件?.md")).toBe("-坏-文件-.md");
  });
});
