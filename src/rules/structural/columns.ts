import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { elementsByTag } from '../../engine/dom.js';
import { childTag, childTags } from './sections.js';

/** Column definitions with more than one column. */
function multiColumnDefs(doc: Document): Element[] {
  const out: Element[] = [];
  for (const sectPr of elementsByTag(doc, 'w:sectPr')) {
    const cols = childTag(sectPr, 'w:cols');
    if (!cols) continue;
    const num = Number(cols.getAttribute('w:num') ?? '1');
    if (num > 1) out.push(cols);
  }
  return out;
}

/**
 * 6.2 Column flattening (structural, suggest).
 *
 * Converters use multi-column section definitions to mimic side-by-side page
 * geometry even when the source is a single column with a wide gutter. Flatten
 * to a single column: set w:num to 1 and drop the per-column width children.
 *
 * Suggest tier because genuinely multi-column documents exist; the report shows
 * a per-section preview so the user can flatten selectively.
 */
export const columnsRule: Rule = {
  id: 'struct.columns',
  title: 'Flatten multi-column layout',
  category: 'structural',
  tier: 'suggest',

  detect(ctx: RuleContext): Finding {
    const defs = multiColumnDefs(ctx.document());
    const counts = defs.map((c) => c.getAttribute('w:num')).join(', ');
    return {
      ruleId: this.id,
      count: defs.length,
      message:
        defs.length === 0
          ? 'No multi-column sections found'
          : `Found ${defs.length} multi-column section${
              defs.length === 1 ? '' : 's'
            } (columns: ${counts})`,
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    const log: ChangeLogEntry[] = [];
    for (const cols of multiColumnDefs(ctx.document())) {
      const before = cols.getAttribute('w:num') ?? '';
      cols.setAttribute('w:num', '1');
      // Remove per-column width definitions; a single column derives its width.
      for (const col of childTags(cols, 'w:col')) cols.removeChild(col);
      log.push({
        ruleId: this.id,
        category: 'structural',
        kind: 'flatten-columns',
        altersText: false,
        before: `w:num=${before}`,
        after: 'w:num=1',
      });
    }
    return log;
  },
};
