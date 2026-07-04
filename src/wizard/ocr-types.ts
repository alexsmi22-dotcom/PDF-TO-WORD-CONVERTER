/** The common OCR JSON contract emitted by every platform's OCR helper. */

export interface OcrLine {
  text: string;
  /** Normalized [0,1], top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
  conf: number;
}

export interface OcrPage {
  index: number;
  /** Page size in points (for aspect ratio; layout uses normalized coords). */
  width: number;
  height: number;
  lines: OcrLine[];
}

export interface OcrDoc {
  engine: string;
  pages: OcrPage[];
}

/** A reconstructed content block, ready to become a Word paragraph. */
export interface Block {
  kind: 'heading' | 'body' | 'pagebreak';
  level?: number; // heading level 1..3
  text?: string;
}
