import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { elementsByTag, mapTextRuns } from '../../engine/dom.js';

/**
 * Presentation-form ligature code points (U+FB00–U+FB06) mapped to their plain
 * letter sequences. These arrive from OCR text layers and PDF font encodings.
 * Until expanded, search, spell-check, and copy-paste all misbehave.
 */
const LIGATURES: Record<string, string> = {
  ﬀ: 'ff', // U+FB00
  ﬁ: 'fi', // U+FB01
  ﬂ: 'fl', // U+FB02
  ﬃ: 'ffi', // U+FB03
  ﬄ: 'ffl', // U+FB04
  ﬅ: 'st', // U+FB05 (long-s t)
  ﬆ: 'st', // U+FB06
};

const LIGATURE_RE = new RegExp(`[${Object.keys(LIGATURES).join('')}]`, 'g');

function expand(text: string): string {
  return text.replace(LIGATURE_RE, (ch) => LIGATURES[ch] ?? ch);
}

/**
 * 6.10 Ligature expansion (character, auto).
 */
export const ligaturesRule: Rule = {
  id: 'char.ligatures',
  title: 'Expand ligatures',
  category: 'character',
  tier: 'auto',

  detect(ctx: RuleContext): Finding {
    const doc = ctx.document();
    let count = 0;
    for (const t of elementsByTag(doc, 'w:t')) {
      const m = (t.textContent ?? '').match(LIGATURE_RE);
      if (m) count += m.length;
    }
    return {
      ruleId: this.id,
      count,
      message:
        count === 0
          ? 'No ligatures found'
          : `Found ${count} ligature${count === 1 ? '' : 's'} to expand`,
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    return mapTextRuns(ctx.document(), expand).map(({ before, after }) => ({
      ruleId: this.id,
      category: 'character',
      kind: 'expand-ligature',
      altersText: true,
      before,
      after,
    }));
  },
};
