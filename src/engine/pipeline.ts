import type { DocumentModel } from './model.js';
import type { Rule, Finding, ChangeLogEntry } from './types.js';
import { textRuns } from './text.js';
import { checkTextConservation } from './invariant.js';
import { PIPELINE } from '../rules/registry.js';

export interface RunOptions {
  /** Which rules to apply. Defaults to auto-tier rules only (conservative). */
  isEnabled?: (rule: Rule) => boolean;
  /** Per-rule option bag resolver. */
  optionsFor?: (ruleId: string) => Readonly<Record<string, unknown>>;
  /** Rule set to run; defaults to the full ordered PIPELINE. */
  rules?: readonly Rule[];
}

export interface RunResult {
  appliedRuleIds: string[];
  changeLog: ChangeLogEntry[];
}

const conservative = (rule: Rule) => rule.tier === 'auto';

/** Read-only inventory pass: every rule's detect(), nothing mutated. */
export function inventory(
  model: DocumentModel,
  rules: readonly Rule[] = PIPELINE,
): Finding[] {
  return rules.map((rule) => rule.detect(model.context()));
}

/**
 * Apply the enabled rules in pipeline order, then enforce text conservation.
 * Mutates the model's DOM in place. Throws InvariantViolation on a text-neutral
 * rule that changed text; the caller discards the model (in copy mode the
 * original was never touched, so nothing is lost).
 */
export function runPipeline(
  model: DocumentModel,
  opts: RunOptions = {},
): RunResult {
  const rules = opts.rules ?? PIPELINE;
  const isEnabled = opts.isEnabled ?? conservative;

  const beforeRuns = textRuns(model.document());
  const changeLog: ChangeLogEntry[] = [];
  const appliedRuleIds: string[] = [];

  for (const rule of rules) {
    if (!isEnabled(rule)) continue;
    const ctx = model.context(opts.optionsFor?.(rule.id) ?? {});
    if (rule.detect(ctx).count === 0) continue;
    const entries = rule.transform(ctx);
    if (entries.length > 0) {
      changeLog.push(...entries);
      appliedRuleIds.push(rule.id);
    }
  }

  const afterRuns = textRuns(model.document());
  checkTextConservation(beforeRuns, afterRuns, changeLog);

  return { appliedRuleIds, changeLog };
}
