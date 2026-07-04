import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { elementsByTag, childTags } from '../../engine/dom.js';

function ancestor(el: Element, match: (e: Element) => boolean): Element | null {
  let n: Node | null = el.parentNode;
  while (n) {
    if (n.nodeType === 1 && match(n as Element)) return n as Element;
    n = n.parentNode;
  }
  return null;
}

function boxText(txbx: Element): string {
  const t = txbx.getElementsByTagName('w:t');
  let s = '';
  for (let i = 0; i < t.length; i++) s += t[i]?.textContent ?? '';
  return s;
}

/**
 * A removal unit: the outer shape container that gets deleted once its text is
 * lifted. When a box lives in an mc:AlternateContent, the unit is that element
 * (so both the DrawingML Choice and the mirrored VML Fallback go together); a
 * standalone box's unit is its w:drawing / w:pict. A single unit may hold MANY
 * text boxes (a grouped diagram), so we lift every one of them, not just the
 * first — collapsing a group to its first box was a text-loss bug.
 */
interface Box {
  unit: Element; // the element to remove after all its boxes are lifted
  txbxList: Element[]; // every text box to lift from this unit, in document order
  anchor: Element; // the flow paragraph (child of w:body) to lift them after
  text: string;
}

function collectBoxes(doc: Document): Box[] {
  const byUnit = new Map<Element, Box>();
  const order: Element[] = [];

  for (const txbx of elementsByTag(doc, 'w:txbxContent')) {
    // Skip the VML fallback mirror; its DrawingML twin in mc:Choice carries the
    // same text and is lifted instead.
    if (ancestor(txbx, (e) => e.nodeName === 'mc:Fallback')) continue;

    const unit =
      ancestor(txbx, (e) => e.nodeName === 'mc:AlternateContent') ??
      ancestor(txbx, (e) => e.nodeName === 'w:drawing' || e.nodeName === 'w:pict');
    if (!unit) continue;

    // Anchor must be a paragraph in the main flow (child of w:body). Boxes
    // nested inside other boxes are handled by the parentNode guard at apply.
    const anchor = ancestor(
      unit,
      (e) => e.nodeName === 'w:p' && e.parentNode?.nodeName === 'w:body',
    );
    if (!anchor) continue;

    let box = byUnit.get(unit);
    if (!box) {
      box = { unit, txbxList: [], anchor, text: '' };
      byUnit.set(unit, box);
      order.push(unit);
    }
    box.txbxList.push(txbx);
  }

  const boxes: Box[] = [];
  for (const unit of order) {
    const box = byUnit.get(unit)!;
    box.text = box.txbxList.map(boxText).join(' ').trim();
    if (box.text.length > 0) boxes.push(box); // skip empty/decorative units
  }
  return boxes;
}

/**
 * 6.3 Text box extraction (structural, suggest).
 *
 * Lifts text out of floating DrawingML/VML text boxes into the body flow so it
 * becomes selectable, searchable, and styleable. Paragraphs are inserted right
 * after their anchor paragraph, in document order, and the (now-empty) box
 * shape is removed. De-duplicates AlternateContent so mirrored DrawingML/VML
 * copies are lifted once, never twice.
 *
 * Suggest tier: absolutely-positioned layouts (forms, cover pages) lose meaning
 * when flattened, so the report previews each box's text for review.
 */
export const textBoxesRule: Rule = {
  id: 'struct.text-boxes',
  title: 'Lift text out of floating boxes',
  category: 'structural',
  tier: 'suggest',

  detect(ctx: RuleContext): Finding {
    const boxes = collectBoxes(ctx.document());
    const total = boxes.reduce((n, b) => n + b.txbxList.length, 0);
    return {
      ruleId: this.id,
      count: total,
      message:
        total === 0
          ? 'No text boxes with liftable content found'
          : `Found ${total} text box${total === 1 ? '' : 'es'} to lift into the flow`,
      samples: boxes.slice(0, 8).map((b) => b.text.slice(0, 60)),
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    const doc = ctx.document();
    const body = doc.getElementsByTagName('w:body')[0];
    if (!body) return [];

    const log: ChangeLogEntry[] = [];
    // Track the last node inserted per anchor so multiple boxes sharing an
    // anchor keep their document order.
    const cursor = new Map<Element, Node>();

    for (const box of collectBoxes(doc)) {
      if (!box.unit.parentNode) continue; // already removed (nested box)

      let ref: Node = cursor.get(box.anchor) ?? box.anchor;
      for (const txbx of box.txbxList) {
        for (const p of childTags(txbx, 'w:p')) {
          body.insertBefore(p, ref.nextSibling);
          ref = p;
        }
      }
      cursor.set(box.anchor, ref);

      box.unit.parentNode.removeChild(box.unit);
      log.push({
        ruleId: this.id,
        category: 'structural',
        kind: 'lift-text-box',
        // Lifting reorders text; de-duplicating AlternateContent also drops the
        // redundant fallback copy, so the run multiset can change. Declared so
        // the invariant permits it; every lifted box is logged for review.
        altersText: true,
        after: box.text.slice(0, 60),
      });
    }
    return log;
  },
};
