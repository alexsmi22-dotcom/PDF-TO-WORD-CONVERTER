import type { Rule } from '../engine/types.js';
import { sectionBreaksRule } from './structural/section-breaks.js';
import { columnsRule } from './structural/columns.js';
import { emptyParagraphsRule } from './layout/empty-paragraphs.js';
import { softHyphenRule } from './character/soft-hyphen.js';
import { ligaturesRule } from './character/ligatures.js';
import { confusablesRule } from './character/confusables.js';

/**
 * All rules, listed in pipeline order (see the paper, section 5.3). Order
 * matters because rules feed each other: text-box extraction runs before
 * anything that reads the paragraph stream; character rules run last. New
 * rules are inserted at their correct pipeline position, not appended.
 *
 * Phase 0 ships a single character rule as the vertical slice; the structural,
 * layout, and style rules land in Phase 1.
 */
export const PIPELINE: readonly Rule[] = [
  // 2. Text box extraction            -> structural (Phase 1.1)
  // 3. Header/footer/page dedup       -> structural (Phase 1.1)
  // 4. Section normalize, then column flatten (order matters: columns live in
  //    section properties, so section handling decides what survives):
  sectionBreaksRule,
  columnsRule,
  // 5. Style inference                -> style      (Phase 1.1)
  // 6. Paragraph reflow (Phase 1.1), then empty paragraph collapse:
  emptyParagraphsRule,
  // 7. Line spacing normalize         -> layout     (Phase 1)
  // 8. Character rules (soft hyphens, ligatures, confusables, then the rest):
  softHyphenRule,
  ligaturesRule,
  confusablesRule,
  // 9. Final validation is run by the pipeline itself.
];

export function ruleById(id: string): Rule | undefined {
  return PIPELINE.find((r) => r.id === id);
}
