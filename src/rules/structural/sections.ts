/** Shared helpers for reasoning about WordprocessingML sections (w:sectPr). */
import { childTag } from '../../engine/dom.js';

/** A paragraph-level section lives in w:pPr; the final one is a child of w:body. */
export function isParagraphSection(sectPr: Element): boolean {
  return sectPr.parentNode?.nodeName === 'w:pPr';
}

/** Section break type; defaults to nextPage when w:type is absent. */
export function sectionType(sectPr: Element): string {
  return childTag(sectPr, 'w:type')?.getAttribute('w:val') ?? 'nextPage';
}

const PGMAR_ATTRS = [
  'w:top',
  'w:right',
  'w:bottom',
  'w:left',
  'w:header',
  'w:footer',
  'w:gutter',
];

/**
 * A canonical key for a section's page geometry: page size + orientation,
 * margins, and column count. Two sections with the same key are visually
 * interchangeable, so a continuous break between them carries no meaning.
 * Column count is included so a genuine multi-column section is never merged
 * away here (that is rule 6.2's job).
 */
export function geometryKey(sectPr: Element): string {
  const pgSz = childTag(sectPr, 'w:pgSz');
  const size = pgSz
    ? `${pgSz.getAttribute('w:w')}x${pgSz.getAttribute('w:h')}:` +
      `${pgSz.getAttribute('w:orient') ?? 'portrait'}`
    : '';

  const pgMar = childTag(sectPr, 'w:pgMar');
  const margins = pgMar
    ? PGMAR_ATTRS.map((a) => pgMar.getAttribute(a) ?? '').join(',')
    : '';

  const cols = childTag(sectPr, 'w:cols');
  const num = cols?.getAttribute('w:num') ?? '1';

  return `${size}|${margins}|cols=${num}`;
}
