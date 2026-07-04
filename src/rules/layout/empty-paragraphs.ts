import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { childTags } from '../../engine/dom.js';

/**
 * A paragraph is "blank" only if it carries no text characters at all AND
 * anchors no drawing, picture, embedded object, or text box. The zero-character
 * check keeps this rule text-neutral (a paragraph holding even a single space
 * is left alone, so visible text never changes). The drawing check honors the
 * v1 safety rule: never delete a paragraph an image is anchored to.
 */
function isBlank(p: Element): boolean {
  for (const tag of ['w:drawing', 'w:pict', 'w:object', 'w:txbxContent']) {
    if (p.getElementsByTagName(tag).length > 0) return false;
  }
  const runs = p.getElementsByTagName('w:t');
  for (let i = 0; i < runs.length; i++) {
    if ((runs[i]?.textContent ?? '').length > 0) return false;
  }
  return true;
}

/** Maximal runs of consecutive blank paragraphs among the body's paragraphs. */
function blankRuns(doc: Document): Element[][] {
  const body = doc.getElementsByTagName('w:body')[0];
  if (!body) return [];
  const runs: Element[][] = [];
  let current: Element[] = [];
  for (const p of childTags(body, 'w:p')) {
    if (isBlank(p)) {
      current.push(p);
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

/**
 * 6.7 Empty paragraph collapse (layout, auto for 3+).
 *
 * Converters stack blank paragraphs to fake vertical spacing. A run of three or
 * more collapses to a single blank paragraph. Collapsing exactly-two runs is
 * off by default (single blank separators are often intentional); the aggressive
 * profile can enable it via the `collapseDoubles` option.
 */
export const emptyParagraphsRule: Rule = {
  id: 'layout.empty-paragraphs',
  title: 'Collapse stacked blank paragraphs',
  category: 'layout',
  tier: 'auto',

  detect(ctx: RuleContext): Finding {
    const min = ctx.options['collapseDoubles'] ? 2 : 3;
    let removable = 0;
    let runs = 0;
    for (const run of blankRuns(ctx.document())) {
      if (run.length >= min) {
        runs++;
        removable += run.length - 1;
      }
    }
    return {
      ruleId: this.id,
      count: removable,
      message:
        removable === 0
          ? 'No stacked blank paragraphs found'
          : `Found ${runs} run${runs === 1 ? '' : 's'} of blank paragraphs ` +
            `(${removable} removable)`,
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    const min = ctx.options['collapseDoubles'] ? 2 : 3;
    const log: ChangeLogEntry[] = [];
    for (const run of blankRuns(ctx.document())) {
      if (run.length < min) continue;
      // Keep the first blank paragraph, remove the rest.
      for (let i = 1; i < run.length; i++) {
        const p = run[i]!;
        p.parentNode?.removeChild(p);
      }
      log.push({
        ruleId: this.id,
        category: 'layout',
        kind: 'collapse-blank-paragraphs',
        altersText: false,
        before: `${run.length} blank paragraphs`,
        after: '1 blank paragraph',
      });
    }
    return log;
  },
};
