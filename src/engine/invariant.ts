import type { ChangeLogEntry } from './types.js';

export class InvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolation';
  }
}

/**
 * Text-conservation invariant (paper section 5.5).
 *
 * Structural, layout, and style rules must be text-neutral. Character rules may
 * change visible text, but only in ways they log. So:
 *   - If visible text is unchanged, always fine.
 *   - If visible text changed, at least one text-altering change must be logged.
 *     Otherwise a rule that promised to be text-neutral silently mutated text —
 *     abort the apply.
 *
 * This catches the dangerous class (a "safe" rule corrupting content). A
 * stronger version that reconciles the exact character delta against the log
 * is planned; see tests/property for where that will live.
 */
export function checkTextConservation(
  beforeText: string,
  afterText: string,
  log: readonly ChangeLogEntry[],
): void {
  if (beforeText === afterText) return;

  const textChanges = log.filter((e) => e.altersText);
  if (textChanges.length === 0) {
    throw new InvariantViolation(
      'Visible text changed but no character rule logged a text edit. ' +
        'A structural/layout/style rule mutated content — apply aborted.',
    );
  }
  // Text changed and character rules account for it. Accepted.
}
