import type { OcrLine, OcrPage, Block } from './ocr-types.js';

/**
 * Reconstruct reading order and paragraph structure from positioned OCR lines.
 * This is the "looks the same / reads correctly" half of the wizard: detect
 * columns (patents are typically two), read each column top-to-bottom, group
 * lines into paragraphs by vertical gaps, join hyphenated line breaks, and flag
 * larger lines as headings.
 */

const centerX = (l: OcrLine) => l.x + l.w / 2;
const bottom = (l: OcrLine) => l.y + l.h;
const isFullWidth = (l: OcrLine) => l.w > 0.6 && l.x < 0.35 && l.x + l.w > 0.65;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Order lines into a single reading sequence, handling two-column layouts. */
function orderLines(lines: OcrLine[]): OcrLine[] {
  const body = lines.filter((l) => !isFullWidth(l));
  const left = body.filter((l) => centerX(l) < 0.5);
  const right = body.filter((l) => centerX(l) >= 0.5);
  const twoColumn = left.length > 3 && right.length > 3;

  const byReading = (arr: OcrLine[]) =>
    [...arr].sort((a, b) => (Math.abs(a.y - b.y) > 0.008 ? a.y - b.y : a.x - b.x));

  if (!twoColumn) return byReading(lines);

  const full = lines.filter(isFullWidth);
  const topBanner = byReading(full.filter((l) => l.y < 0.14));
  const rest = full.filter((l) => l.y >= 0.14);
  const leftCol = byReading([...left, ...rest.filter((l) => centerX(l) < 0.5)]);
  const rightCol = byReading([...right, ...rest.filter((l) => centerX(l) >= 0.5)]);
  return [...topBanner, ...leftCol, ...rightCol];
}

/** Join a paragraph's lines, healing end-of-line hyphenation. */
function joinLines(texts: string[]): string {
  let out = '';
  for (const t of texts) {
    const s = t.trim();
    if (!s) continue;
    if (!out) out = s;
    else if (/[-‐­]$/.test(out)) out = out.replace(/[-‐­]$/, '') + s;
    else out += ' ' + s;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function headingLevel(h: number, medianH: number): number {
  if (h > medianH * 2.1) return 1;
  if (h > medianH * 1.6) return 2;
  return 3;
}

/** Turn one OCR page into ordered content blocks. */
export function pageToBlocks(page: OcrPage): Block[] {
  const lines = page.lines.filter((l) => l.text.trim().length > 0);
  if (lines.length === 0) return [];

  const medianH = median(lines.map((l) => l.h));
  const ordered = orderLines(lines);

  const blocks: Block[] = [];
  let cur: { texts: string[]; h: number } | null = null;
  let prevBottom = -1;

  const flush = () => {
    if (!cur) return;
    const text = joinLines(cur.texts);
    if (text) {
      // A heading is a distinctly larger, short line that isn't a sentence.
      const heading =
        cur.h > medianH * 1.55 && text.length < 70 && !/[.,;:]$/.test(text);
      blocks.push(
        heading
          ? { kind: 'heading', level: headingLevel(cur.h, medianH), text }
          : { kind: 'body', text },
      );
    }
    cur = null;
  };

  for (const l of ordered) {
    const gap = prevBottom >= 0 ? l.y - prevBottom : 0;
    const newParagraph =
      !cur ||
      gap > medianH * 0.9 || // more than ~a line of vertical space
      l.h > medianH * 1.55 || // a heading-sized line stands alone
      (cur && Math.abs(l.h - cur.h) > medianH * 0.6); // font size shift

    if (newParagraph) {
      flush();
      cur = { texts: [l.text], h: l.h };
    } else {
      cur!.texts.push(l.text);
    }
    prevBottom = bottom(l);
  }
  flush();
  return blocks;
}

/**
 * A page with little text is a figure/drawing sheet — reconstructing its
 * scattered labels as prose produces garbage, so we embed the page image
 * instead. Text pages of a patent carry ~1500-3000 characters; drawing sheets
 * carry only a few hundred (figure numbers and short labels).
 */
export function isDrawingPage(page: OcrPage): boolean {
  const chars = page.lines.reduce((n, l) => n + l.text.trim().length, 0);
  return chars < 800;
}

/** Turn a whole OCR document into blocks, with page breaks between pages. */
export function docToBlocks(pages: OcrPage[]): Block[] {
  const out: Block[] = [];
  pages.forEach((page, i) => {
    if (i > 0) out.push({ kind: 'pagebreak' });
    if (isDrawingPage(page) && page.image) {
      out.push({ kind: 'image', imagePath: page.image });
    } else {
      out.push(...pageToBlocks(page));
    }
  });
  return out;
}
