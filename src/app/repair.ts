import { OpcPackage } from '../opc/package.js';
import { inventory, runPipeline } from '../engine/pipeline.js';
import { readDocumentPackage } from '../acquire/office-file.js';
import { openAsNewDocument, replaceInPlace } from '../acquire/office-output.js';
import { PIPELINE } from '../rules/registry.js';
import type { Finding, ChangeLogEntry, Rule } from '../engine/types.js';

export type OutputMode = 'copy' | 'inplace';

export interface RuleView {
  id: string;
  title: string;
  category: Rule['category'];
  tier: Rule['tier'];
  finding: Finding;
}

export interface ScanResult {
  /** Rules with something to do, in pipeline order, with UI metadata. */
  rules: RuleView[];
  /** The saved package bytes, held so applyRepairs can re-open cleanly. */
  bytes: Uint8Array;
  sizeBytes: number;
}

/** Warn above this package size (base64 + DOM parsing get heavy). */
export const SIZE_WARN_BYTES = 25 * 1024 * 1024;

/**
 * Read the current document, run the read-only inventory, and return the rules
 * that have work to do. Does not mutate anything.
 */
export async function scanCurrentDocument(): Promise<ScanResult> {
  const bytes = await readDocumentPackage();
  const pkg = await OpcPackage.open(bytes);
  const findings = inventory(pkg.model);

  const byId = new Map(findings.map((f) => [f.ruleId, f]));
  const rules: RuleView[] = PIPELINE.filter(
    (r) => (byId.get(r.id)?.count ?? 0) > 0,
  ).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    tier: r.tier,
    finding: byId.get(r.id)!,
  }));

  return { rules, bytes, sizeBytes: bytes.length };
}

/**
 * Re-open the scanned bytes, apply the selected rules, and emit the result.
 * Re-opening from bytes (rather than reusing the scan's DOM) keeps the inventory
 * pass strictly read-only and the apply deterministic. Copy mode is the safe
 * default: the original document is never touched.
 */
export async function applyRepairs(
  bytes: Uint8Array,
  enabledRuleIds: ReadonlySet<string>,
  mode: OutputMode = 'copy',
): Promise<{ changeLog: ChangeLogEntry[]; appliedRuleIds: string[] }> {
  const pkg = await OpcPackage.open(bytes);
  const { changeLog, appliedRuleIds } = runPipeline(pkg.model, {
    isEnabled: (rule) => enabledRuleIds.has(rule.id),
  });
  const out = await pkg.toUint8Array();

  if (mode === 'inplace') {
    await replaceInPlace(out);
  } else {
    await openAsNewDocument(out);
  }
  return { changeLog, appliedRuleIds };
}

/** Rule ids that are checked by default under the conservative profile. */
export function defaultEnabled(rules: RuleView[]): Set<string> {
  return new Set(rules.filter((r) => r.tier === 'auto').map((r) => r.id));
}
