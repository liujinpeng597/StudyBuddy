import { normalizeText } from "./contracts";

export type NoteChunk = {
  title: string;
  text: string;
  questions: string[];
};

export function parseMarkdownQuestions(markdown: string): NoteChunk[] {
  const normalized = normalizeText(markdown);
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const chunks: Array<{ title: string; lines: string[]; questions: string[] }> = [];
  let current: { title: string; lines: string[]; questions: string[] } = {
    title: "学习笔记",
    lines: [],
    questions: []
  };

  const flush = () => {
    if (current.lines.some((line) => line.trim())) chunks.push(current);
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading?.[1] && current.lines.some((entry) => entry.trim())) {
      flush();
      current = { title: heading[1].trim(), lines: [line], questions: [] };
      if (/^(问题|题目|Q\d*|问[:：])/i.test(heading[1].trim())) {
        current.questions.push(heading[1].trim());
      }
      continue;
    }
    if (heading?.[1] && current.lines.length === 0) {
      current.title = heading[1].trim();
      if (/^(问题|题目|Q\d*|问[:：])/i.test(heading[1].trim())) {
        current.questions.push(heading[1].trim());
      }
    }
    if (/^(问题|题目|Q\d*|问[:：])/i.test(line.trim())) {
      current.questions.push(line.trim());
    }
    current.lines.push(line);
  }
  flush();

  const maxLength = 3_000;
  const result: NoteChunk[] = [];
  for (const chunk of chunks) {
    const text = chunk.lines.join("\n").trim();
    if (text.length <= maxLength) {
      result.push({ title: chunk.title, text, questions: chunk.questions });
      continue;
    }
    const paragraphs = text.split(/\n{2,}/);
    let buffer = "";
    for (const paragraph of paragraphs) {
      if (buffer.length > 0 && buffer.length + paragraph.length + 2 > maxLength) {
        result.push({
          title: `${chunk.title}（续）`,
          text: buffer,
          questions: chunk.questions
        });
        buffer = buffer.slice(-400);
      }
      buffer += `${buffer ? "\n\n" : ""}${paragraph}`;
    }
    if (buffer.trim()) {
      result.push({ title: chunk.title, text: buffer, questions: chunk.questions });
    }
  }
  return result;
}

export function detectSourceKind(fileName: string, mimeType: string) {
  if (/\.md$/i.test(fileName) || /\.markdown$/i.test(fileName)) return "markdown" as const;
  if (
    ["image/png", "image/jpeg", "image/webp"].includes(mimeType) ||
    /\.(png|jpe?g|webp)$/i.test(fileName)
  ) {
    return "image" as const;
  }
  return "unsupported" as const;
}

export function safeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\.\./g, ".")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return cleaned || "source";
}
