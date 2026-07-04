/** Core types shared by the engine and every rule module. */

/** Which failure class a rule addresses (see the paper's failure taxonomy). */
export type Category = 'structural' | 'layout' | 'character' | 'style';

/**
 * How aggressively a rule applies under the conservative (default) profile.
 * - auto:        safe under every observed input; applied by default.
 * - suggest:     correct most of the time; shown with counts/previews, opt-in.
 * - report-only: valuable detection, risky transform; reported, never auto-applied.
 */
export type Tier = 'auto' | 'suggest' | 'report-only';

/** A rule's read-only assessment of the document, shown in the report. */
export interface Finding {
  ruleId: string;
  /** Human-readable summary, e.g. "Found 42 soft hyphens across 18 paragraphs". */
  message: string;
  /** How many discrete things this rule would change. Zero means nothing to do. */
  count: number;
  /** Optional short previews of affected content for the report UI. */
  samples?: string[];
}

/** One recorded change, for the audit log and the text-conservation invariant. */
export interface ChangeLogEntry {
  ruleId: string;
  category: Category;
  /** Machine tag for the kind of edit, e.g. 'delete-soft-hyphen'. */
  kind: string;
  /** Whether this edit alters visible text (character rules) or not. */
  altersText: boolean;
  /** Context around the change, for review. */
  before?: string;
  after?: string;
}

/**
 * A rule operates on the whole document model but conventionally reads/writes
 * word/document.xml via ctx.document(). Rules never share state and never
 * import one another; the engine owns ordering.
 */
export interface Rule {
  readonly id: string;
  readonly title: string;
  readonly category: Category;
  readonly tier: Tier;
  /** Read-only: does this document have anything for the rule to do? */
  detect(ctx: RuleContext): Finding;
  /** Apply changes; return an entry per change. Must be a no-op if detect().count === 0. */
  transform(ctx: RuleContext): ChangeLogEntry[];
}

/** What a rule receives. Kept minimal so rules stay unit-testable. */
export interface RuleContext {
  /** The parsed word/document.xml DOM. */
  document(): Document;
  /** Any other part by name, e.g. 'word/styles.xml'; parsed lazily. */
  part(name: string): Document | undefined;
  /** Options resolved from the active profile / per-rule toggles. */
  options: Readonly<Record<string, unknown>>;
}
