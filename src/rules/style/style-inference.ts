import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { childTag, childTags } from '../../engine/dom.js';
import { parseXml } from '../../engine/xml.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const SHORT_LINE = 100;
const TERMINAL = /[.!?:;,]\s*$/;

interface Heading {
  p: Element;
  level: number;
  text: string;
}

function el(doc: Document, name: string): Element {
  return doc.createElementNS(W_NS, name) as Element;
}

function paraText(p: Element): string {
  let s = '';
  const runs = p.getElementsByTagName('w:t');
  for (let i = 0; i < runs.length; i++) s += runs[i]?.textContent ?? '';
  return s;
}

/** Representative font size (half-points) for a paragraph, or undefined. */
function paraSize(p: Element): number | undefined {
  const sz = p.getElementsByTagName('w:sz')[0];
  const v = sz?.getAttribute('w:val');
  return v ? Number(v) : undefined;
}

function boolProp(rPr: Element | null, tag: string): boolean {
  const e = rPr && childTag(rPr, tag);
  if (!e) return false;
  const v = e.getAttribute('w:val');
  return v === null || !['0', 'false', 'off'].includes(v);
}

/** True when every text-bearing run in the paragraph is bold. */
function paraBold(p: Element): boolean {
  const pPr = childTag(p, 'w:pPr');
  if (boolProp(pPr && childTag(pPr, 'w:rPr'), 'w:b')) return true;
  const runs = childTags(p, 'w:r').filter((r) => r.getElementsByTagName('w:t').length > 0);
  if (runs.length === 0) return false;
  return runs.every((r) => boolProp(childTag(r, 'w:rPr'), 'w:b'));
}

function hasStyle(p: Element): boolean {
  const pPr = childTag(p, 'w:pPr');
  return !!(pPr && childTag(pPr, 'w:pStyle'));
}

function modalSize(sizes: number[]): number | undefined {
  if (sizes.length === 0) return undefined;
  const freq = new Map<number, number>();
  for (const s of sizes) freq.set(s, (freq.get(s) ?? 0) + 1);
  let best: number | undefined;
  let bestN = -1;
  for (const [size, n] of freq) {
    if (n > bestN || (n === bestN && best !== undefined && size < best)) {
      best = size;
      bestN = n;
    }
  }
  return best;
}

/** Detect heading paragraphs and assign each a level 1–3. */
function findHeadings(doc: Document): Heading[] {
  const body = doc.getElementsByTagName('w:body')[0];
  if (!body) return [];

  const paras = childTags(body, 'w:p')
    .map((p) => ({ p, text: paraText(p), size: paraSize(p), bold: paraBold(p) }))
    .filter((info) => info.text.trim().length > 0 && !hasStyle(info.p));

  if (paras.length === 0) return [];

  const bodySize = modalSize(
    paras.map((i) => i.size).filter((s): s is number => s !== undefined),
  );
  const boldRatio = paras.filter((i) => i.bold).length / paras.length;
  const useBold = boldRatio <= 0.5; // if most of the doc is bold, bold isn't a heading signal

  // Size-based candidates and their level ranking (largest size = Heading 1).
  const sizeCandidates = paras.filter(
    (i) => i.size !== undefined && bodySize !== undefined && i.size > bodySize,
  );
  const distinctSizes = [...new Set(sizeCandidates.map((i) => i.size!))].sort((a, b) => b - a);
  const levelForSize = new Map<number, number>();
  distinctSizes.forEach((s, idx) => levelForSize.set(s, Math.min(idx + 1, 3)));

  const headings: Heading[] = [];
  for (const info of paras) {
    const bySize =
      info.size !== undefined && bodySize !== undefined && info.size > bodySize;
    const byBold =
      useBold &&
      info.bold &&
      info.text.length <= SHORT_LINE &&
      !TERMINAL.test(info.text) &&
      (info.size === undefined || bodySize === undefined || info.size >= bodySize);

    if (!bySize && !byBold) continue;
    const level = bySize ? levelForSize.get(info.size!)! : 3;
    headings.push({ p: info.p, level, text: info.text });
  }
  return headings;
}

/** Add or update the paragraph's w:pStyle (must be first child of w:pPr). */
function applyStyle(doc: Document, p: Element, styleId: string): void {
  let pPr = childTag(p, 'w:pPr');
  if (!pPr) {
    pPr = el(doc, 'w:pPr');
    p.insertBefore(pPr, p.firstChild);
  }
  let pStyle = childTag(pPr, 'w:pStyle');
  if (!pStyle) {
    pStyle = el(doc, 'w:pStyle');
    pPr.insertBefore(pStyle, pPr.firstChild);
  }
  pStyle.setAttribute('w:val', styleId);
}

/** Inject minimal Heading style definitions into styles.xml when absent. */
function ensureHeadingStyles(styles: Document, levels: Set<number>): void {
  const root = styles.documentElement;
  if (!root) return;
  const existing = new Set<string>();
  const defs = styles.getElementsByTagName('w:style');
  for (let i = 0; i < defs.length; i++) {
    const id = defs[i]?.getAttribute('w:styleId');
    if (id) existing.add(id);
  }
  for (const level of [...levels].sort()) {
    const id = `Heading${level}`;
    if (existing.has(id)) continue;
    const frag = parseXml(
      `<w:style xmlns:w="${W_NS}" w:type="paragraph" w:styleId="${id}">` +
        `<w:name w:val="heading ${level}"/>` +
        `<w:basedOn w:val="Normal"/>` +
        `<w:next w:val="Normal"/>` +
        `<w:qFormat/>` +
        `<w:pPr><w:outlineLvl w:val="${level - 1}"/></w:pPr>` +
        `<w:rPr><w:b/><w:sz w:val="${36 - level * 4}"/></w:rPr>` +
        `</w:style>`,
    );
    root.appendChild(styles.importNode(frag.documentElement, true));
  }
}

/**
 * 6.5 Style inference and mapping (style, suggest).
 *
 * Converted documents carry direct formatting only — every paragraph is Normal
 * with manual size/weight. We infer up to three heading levels from the size
 * distribution (largest sizes = Heading 1) plus a bold-short-line heuristic,
 * apply Heading 1–3 style references, and inject the style definitions into
 * styles.xml when missing. Direct formatting is left in place, so appearance is
 * preserved while the document gains real structure. Text-neutral.
 *
 * Suggest tier: emphasized lead-in lines can look like headings, so the report
 * lists every proposed heading for review.
 */
export const styleInferenceRule: Rule = {
  id: 'style.inference',
  title: 'Restore heading styles',
  category: 'style',
  tier: 'suggest',

  detect(ctx: RuleContext): Finding {
    const headings = findHeadings(ctx.document());
    return {
      ruleId: this.id,
      count: headings.length,
      message:
        headings.length === 0
          ? 'No inferable headings found'
          : `Found ${headings.length} probable heading${headings.length === 1 ? '' : 's'}`,
      samples: headings.slice(0, 8).map((h) => `H${h.level}: ${h.text.slice(0, 60)}`),
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    const doc = ctx.document();
    const headings = findHeadings(doc);
    if (headings.length === 0) return [];

    const levels = new Set<number>();
    const log: ChangeLogEntry[] = [];
    for (const h of headings) {
      applyStyle(doc, h.p, `Heading${h.level}`);
      levels.add(h.level);
      log.push({
        ruleId: this.id,
        category: 'style',
        kind: 'apply-heading-style',
        altersText: false,
        after: `Heading${h.level}: ${h.text.slice(0, 60)}`,
      });
    }

    const styles = ctx.part('word/styles.xml');
    if (styles) ensureHeadingStyles(styles, levels);

    return log;
  },
};
