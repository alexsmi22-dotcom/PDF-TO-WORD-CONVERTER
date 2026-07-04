import { stripRunningHeadersFooters, isDrawingPage } from '../src/wizard/layout.js';
import type { OcrPage, OcrLine } from '../src/wizard/ocr-types.js';

const line = (text: string, y: number, x = 0.1, w = 0.3): OcrLine => ({
  text,
  x,
  y,
  w,
  h: 0.02,
  conf: 1,
});

const page = (index: number, lines: OcrLine[]): OcrPage => ({
  index,
  width: 612,
  height: 792,
  lines,
});

describe('stripRunningHeadersFooters', () => {
  it('removes a repeated top-band header, keeps body text', () => {
    const pages = [0, 1, 2, 3, 4].map((i) =>
      page(i, [
        line('US 6,421,675 B1', 0.03), // running header on every page (top band)
        line(`unique body line ${i}`, 0.5),
        line('US 6,421,675 B1', 0.5), // same text but in the body -> kept
      ]),
    );
    const removed = stripRunningHeadersFooters(pages);
    expect(removed).toBe(5); // one header per page

    for (const p of pages) {
      const top = p.lines.filter((l) => l.y < 0.09);
      expect(top).toHaveLength(0); // header gone
      // the body occurrence of the same text survives
      expect(p.lines.some((l) => l.text === 'US 6,421,675 B1' && l.y >= 0.09)).toBe(true);
      expect(p.lines.some((l) => l.text.startsWith('unique body'))).toBe(true);
    }
  });

  it('normalizes page-varying numbers so "Sheet 5 of 27" matches "Sheet 6 of 27"', () => {
    const pages = [0, 1, 2, 3].map((i) =>
      page(i, [line(`Sheet ${i + 1} of 27`, 0.02), line(`body ${i}`, 0.5)]),
    );
    expect(stripRunningHeadersFooters(pages)).toBe(4);
  });

  it('does not strip a one-off top line', () => {
    const pages = [page(0, [line('A unique title', 0.02), line('body', 0.5)])];
    expect(stripRunningHeadersFooters(pages)).toBe(0);
  });
});

describe('isDrawingPage', () => {
  it('flags a sparse page as a drawing', () => {
    expect(isDrawingPage(page(0, [line('Fig 1', 0.2), line('(12)', 0.4)]))).toBe(true);
  });
  it('treats a text-dense page as text', () => {
    const dense = Array.from({ length: 40 }, (_, i) =>
      line('a fairly long line of body text that carries real content ' + i, 0.05 + i * 0.02),
    );
    expect(isDrawingPage(page(0, dense))).toBe(false);
  });
});
