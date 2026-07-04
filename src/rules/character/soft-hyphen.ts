import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { elementsByTag, mapTextRuns } from '../../engine/dom.js';

const SOFT_HYPHEN = '­';

/**
 * 6.9 Soft hyphen removal (character, auto).
 *
 * Converters emit optional line-break hints two ways: the U+00AD code point
 * inside w:t text, and the empty <w:softHyphen/> run element. Both are
 * invisible except during line wrap and both fragment words for search and
 * spell-check. We delete both forms. No known failure case exists, so this is
 * an auto-tier rule.
 */
export const softHyphenRule: Rule = {
  id: 'char.soft-hyphen',
  title: 'Remove soft hyphens',
  category: 'character',
  tier: 'auto',

  detect(ctx: RuleContext): Finding {
    const doc = ctx.document();
    let chars = 0;
    for (const t of elementsByTag(doc, 'w:t')) {
      for (const ch of t.textContent ?? '') if (ch === SOFT_HYPHEN) chars++;
    }
    const els = elementsByTag(doc, 'w:softHyphen').length;
    const total = chars + els;
    return {
      ruleId: this.id,
      count: total,
      message:
        total === 0
          ? 'No soft hyphens found'
          : `Found ${total} soft hyphen${total === 1 ? '' : 's'} ` +
            `(${chars} in text, ${els} as elements)`,
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    const doc = ctx.document();
    const log: ChangeLogEntry[] = [];

    for (const { before, after } of mapTextRuns(doc, (text) =>
      text.split(SOFT_HYPHEN).join(''),
    )) {
      log.push({
        ruleId: this.id,
        category: 'character',
        kind: 'delete-soft-hyphen-char',
        altersText: true,
        before,
        after,
      });
    }

    for (const el of elementsByTag(doc, 'w:softHyphen')) {
      el.parentNode?.removeChild(el);
      log.push({
        ruleId: this.id,
        category: 'character',
        kind: 'delete-soft-hyphen-element',
        altersText: true,
      });
    }

    return log;
  },
};
