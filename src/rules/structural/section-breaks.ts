import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { elementsByTag } from '../../engine/dom.js';
import {
  geometryKey,
  sectionType,
  isParagraphSection,
} from './sections.js';

/**
 * A paragraph-level section is removable noise when it is a *continuous* break
 * whose page geometry matches the section that follows it. Removing it merges
 * its content into the next section with zero visual change — but eliminates
 * the phantom section boundary that makes editing misbehave.
 *
 * We never touch nextPage breaks (a real page break may be intended) and never
 * touch the body-level section, and we never merge across a genuine geometry
 * change (orientation, margins, or column count). That guard is what lets this
 * be an auto-tier rule.
 */
function removableSections(doc: Document): Element[] {
  const all = elementsByTag(doc, 'w:sectPr'); // document order; last is body-level
  const removable: Element[] = [];
  for (let i = 0; i < all.length - 1; i++) {
    const sect = all[i]!;
    const next = all[i + 1]!;
    if (!isParagraphSection(sect)) continue;
    if (sectionType(sect) !== 'continuous') continue;
    if (geometryKey(sect) === geometryKey(next)) removable.push(sect);
  }
  return removable;
}

export const sectionBreaksRule: Rule = {
  id: 'struct.section-breaks',
  title: 'Remove redundant section breaks',
  category: 'structural',
  tier: 'auto',

  detect(ctx: RuleContext): Finding {
    const count = removableSections(ctx.document()).length;
    return {
      ruleId: this.id,
      count,
      message:
        count === 0
          ? 'No redundant section breaks found'
          : `Found ${count} redundant continuous section break${
              count === 1 ? '' : 's'
            } (no geometry change)`,
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    const log: ChangeLogEntry[] = [];
    for (const sect of removableSections(ctx.document())) {
      const pPr = sect.parentNode as Element | null;
      pPr?.removeChild(sect);
      // A w:pPr that existed only to carry the section break is now empty; drop it.
      if (pPr && pPr.nodeName === 'w:pPr' && !hasElementChild(pPr)) {
        pPr.parentNode?.removeChild(pPr);
      }
      log.push({
        ruleId: this.id,
        category: 'structural',
        kind: 'remove-redundant-section',
        altersText: false,
      });
    }
    return log;
  },
};

function hasElementChild(el: Element): boolean {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1) return true;
  }
  return false;
}
