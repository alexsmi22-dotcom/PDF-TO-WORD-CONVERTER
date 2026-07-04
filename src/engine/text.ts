/**
 * Extract the visible text of a document part as a single string, in document
 * order. This is the basis of the text-conservation invariant: structural,
 * layout, and style rules must leave this string unchanged; character rules may
 * change it only in ways their change log accounts for.
 *
 * We concatenate the content of every w:t run. Runs are the atomic text
 * carriers in WordprocessingML; w:tab / w:br / w:cr are structural whitespace
 * and are intentionally excluded so that, e.g., collapsing blank paragraphs
 * (a layout rule) does not register as a text change.
 */
export function visibleText(doc: Document): string {
  const runs = doc.getElementsByTagName('w:t');
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    out += runs[i]?.textContent ?? '';
  }
  return out;
}
