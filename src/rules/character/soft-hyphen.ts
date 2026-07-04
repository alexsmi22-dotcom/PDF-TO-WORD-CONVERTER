import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';

const SOFT_HYPHEN = '­';

/** Snapshot a live element collection into a stable array before mutating. */
function elements(doc: Document, tag: string): Element[] {
  const live = doc.getElementsByTagName(tag);
  const out: Element[] = [];
  for (let i = 0; i < live.length; i++) {
    const el = live[i];
    if (el) out.push(el);
  }
  return out;
}

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
    for (const t of elements(doc, 'w:t')) {
      const text = t.textContent ?? '';
      for (const ch of text) if (ch === SOFT_HYPHEN) chars++;
    }
    const els = elements(doc, 'w:softHyphen').length;
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

    for (const t of elements(doc, 'w:t')) {
      const text = t.textContent ?? '';
      if (text.includes(SOFT_HYPHEN)) {
        const cleaned = text.split(SOFT_HYPHEN).join('');
        t.textContent = cleaned;
        log.push({
          ruleId: this.id,
          category: 'character',
          kind: 'delete-soft-hyphen-char',
          altersText: true,
          before: text,
          after: cleaned,
        });
      }
    }

    for (const el of elements(doc, 'w:softHyphen')) {
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
