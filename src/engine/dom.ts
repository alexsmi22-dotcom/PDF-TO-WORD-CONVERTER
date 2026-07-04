/**
 * Small DOM helpers shared by rules. Keeping these here means a rule module is
 * mostly its detect/transform logic, not boilerplate — which matters for the
 * one-rule-per-PR contribution model.
 */

/** Snapshot a live element collection into a stable array before mutating. */
export function elementsByTag(doc: Document, tag: string): Element[] {
  const live = doc.getElementsByTagName(tag);
  const out: Element[] = [];
  for (let i = 0; i < live.length; i++) {
    const el = live[i];
    if (el) out.push(el);
  }
  return out;
}

/**
 * Visit every w:t text run. `visit` receives the current text and returns the
 * replacement (or the same string / undefined to leave it). Returns the list of
 * (before, after) pairs for runs that actually changed — ready to become change
 * log entries.
 */
export function mapTextRuns(
  doc: Document,
  visit: (text: string) => string,
): Array<{ before: string; after: string }> {
  const changes: Array<{ before: string; after: string }> = [];
  for (const t of elementsByTag(doc, 'w:t')) {
    const before = t.textContent ?? '';
    const after = visit(before);
    if (after !== before) {
      t.textContent = after;
      changes.push({ before, after });
    }
  }
  return changes;
}
