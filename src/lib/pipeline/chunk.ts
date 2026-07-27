import "server-only";

export type TextChunk = {
  chunkIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
};

const TARGET_CHARS = 2_800;
const OVERLAP_CHARS = 420;

export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const targetEnd = Math.min(start + TARGET_CHARS, text.length);
    let end = targetEnd;

    if (targetEnd < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", targetEnd);
      const sentenceBreak = text.lastIndexOf(". ", targetEnd);
      const bestBreak = Math.max(paragraphBreak + 2, sentenceBreak + 2);
      if (bestBreak > start + TARGET_CHARS * 0.55) {
        end = bestBreak;
      }
    }

    const chunk = text.slice(start, end).trim();
    const leadingWhitespace = text.slice(start, end).length - text.slice(start, end).trimStart().length;
    const actualStart = start + leadingWhitespace;

    if (chunk) {
      chunks.push({
        chunkIndex: chunks.length,
        text: chunk,
        startOffset: actualStart,
        endOffset: actualStart + chunk.length,
      });
    }

    if (end >= text.length) break;
    const nextStart = Math.max(end - OVERLAP_CHARS, start + 1);
    const paragraphAfterOverlap = text.indexOf("\n\n", nextStart);
    start =
      paragraphAfterOverlap !== -1 && paragraphAfterOverlap < end
        ? paragraphAfterOverlap + 2
        : nextStart;
  }

  return chunks;
}
