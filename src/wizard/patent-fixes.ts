/**
 * High-confidence, patent-specific OCR corrections applied to reconstructed
 * text. These target errors that generic confusable rules deliberately avoid
 * (an isolated `O` or `I` is ambiguous in prose) but which are unambiguous in
 * patent boilerplate. Each pattern is tightly scoped to avoid false positives.
 *
 * Kept conservative on purpose: for legal use, always proofread against the
 * source. This just removes the obvious, repeatable OCR slips.
 */

type Rep = string | ((...args: string[]) => string);

const FIXES: Array<[RegExp, Rep]> = [
  // Kind code after a patent number: "US 6,421,675 BI" / "Bl" -> "B1".
  // Only fires right after a patent-number-shaped token, so ordinary words
  // starting with A/B are untouched.
  [/(US\s?[\d,]{7,}\s?)([AB])[Il](\b)/g, (_m, p, k, b) => `${p}${k}1${b}`],

  // Patent-term-adjustment boilerplate: "by O days" -> "by 0 days".
  [/\bby [Oo] (days?)\b/g, 'by 0 $1'],
];

export function applyPatentFixes(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const [re, rep] of FIXES) {
    const matches = out.match(re);
    if (matches) count += matches.length;
    // String reps go through replace() directly so `$1` backreferences work.
    out =
      typeof rep === 'function'
        ? out.replace(re, rep as (sub: string, ...a: string[]) => string)
        : out.replace(re, rep);
  }
  return { text: out, count };
}
