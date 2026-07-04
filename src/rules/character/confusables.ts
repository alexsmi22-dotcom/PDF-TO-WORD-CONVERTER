import type { Rule, RuleContext, Finding, ChangeLogEntry } from '../../engine/types.js';
import { mapTextRuns, elementsByTag } from '../../engine/dom.js';
import { visibleText } from '../../engine/text.js';

/**
 * 6.11 OCR confusable correction (character, suggest).
 *
 * OCR swaps visually similar glyphs. We correct only with context, never
 * blindly:
 *   - Digit context (a token with a real digit 2-9 and no real letters):
 *     letters that look like digits become digits — O/o->0, l->1, I->1.
 *     Hits "2O24"->"2024", "l23"->"123", "2,OOO"->"2,000".
 *   - Letter context (a plain alphabetic word with a single stray 0):
 *     0->o/O, e.g. "hell0"->"hello", "B0B"->"BOB". We deliberately do NOT
 *     touch a stray "1" in words (l vs I vs i is too ambiguous to auto-fix).
 *   - rn->m only when the fused word already appears elsewhere in the document
 *     and this split spelling appears nowhere else — no dictionary needed.
 *
 * Every changed run is logged with its full before/after for review, and the
 * rule stays at suggest tier.
 */

const ORD = /^[A-Za-z]*0[A-Za-z]*$/; // letters around exactly one '0', no other digit

type WordFreq = Map<string, number>;

function wordFrequency(doc: Document): WordFreq {
  const freq: WordFreq = new Map();
  for (const w of visibleText(doc).toLowerCase().match(/[a-z]+/g) ?? []) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

/** Classify a whitespace-delimited token for digit/letter confusable fixing. */
function tokenClass(token: string): 'digit' | 'letter' | 'skip' {
  let anchorDigit = false; // a real digit 2-9
  let anchorLetter = false; // a real letter, excluding the confusable set O o l I
  for (const c of token) {
    if (c >= '2' && c <= '9') anchorDigit = true;
    else if (/[A-Za-z]/.test(c) && !'OolI'.includes(c)) anchorLetter = true;
  }
  if (anchorDigit && !anchorLetter) return 'digit';
  if (anchorLetter && !anchorDigit) return 'letter';
  return 'skip';
}

function fixDigitToken(token: string): string {
  return token.replace(/[OolI]/g, (c) => (c === 'O' || c === 'o' ? '0' : '1'));
}

function fixLetterToken(token: string): string {
  if (!ORD.test(token)) return token;
  const upper = /[A-Z]/.test(token) && !/[a-z]/.test(token);
  return token.replace('0', upper ? 'O' : 'o');
}

function fixRn(word: string, freq: WordFreq): string {
  if (!word.includes('rn')) return word;
  const fused = word.replace(/rn/g, 'm');
  if (fused === word) return word;
  const fusedExists = (freq.get(fused.toLowerCase()) ?? 0) > 0;
  const splitIsUnique = (freq.get(word.toLowerCase()) ?? 0) <= 1;
  return fusedExists && splitIsUnique ? fused : word;
}

/** Correct one run of text; returns the new text and how many corrections it made. */
function correct(text: string, freq: WordFreq): { out: string; count: number } {
  let count = 0;

  // Pass 1: rn -> m within alphabetic words.
  let out = text.replace(/[A-Za-z]+/g, (word) => {
    const fixed = fixRn(word, freq);
    if (fixed !== word) count++;
    return fixed;
  });

  // Pass 2: token-level digit/letter confusables.
  out = out
    .split(/(\s+)/)
    .map((tok) => {
      if (tok.trim() === '') return tok;
      const cls = tokenClass(tok);
      const fixed =
        cls === 'digit' ? fixDigitToken(tok) : cls === 'letter' ? fixLetterToken(tok) : tok;
      if (fixed !== tok) {
        // count per-character difference
        for (let i = 0; i < tok.length; i++) if (tok[i] !== fixed[i]) count++;
      }
      return fixed;
    })
    .join('');

  return { out, count };
}

export const confusablesRule: Rule = {
  id: 'char.confusables',
  title: 'Fix OCR character confusions',
  category: 'character',
  tier: 'suggest',

  detect(ctx: RuleContext): Finding {
    const doc = ctx.document();
    const freq = wordFrequency(doc);
    let count = 0;
    for (const t of elementsByTag(doc, 'w:t')) {
      count += correct(t.textContent ?? '', freq).count;
    }
    return {
      ruleId: this.id,
      count,
      message:
        count === 0
          ? 'No likely OCR confusions found'
          : `Found ${count} likely OCR confusion${count === 1 ? '' : 's'} to fix`,
    };
  },

  transform(ctx: RuleContext): ChangeLogEntry[] {
    const doc = ctx.document();
    const freq = wordFrequency(doc);
    return mapTextRuns(doc, (text) => correct(text, freq).out).map(({ before, after }) => ({
      ruleId: this.id,
      category: 'character' as const,
      kind: 'ocr-confusable',
      altersText: true,
      before,
      after,
    }));
  },
};
