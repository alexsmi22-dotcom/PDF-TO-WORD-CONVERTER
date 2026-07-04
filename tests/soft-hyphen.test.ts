import { readFileSync } from 'node:fs';
import { DocumentModel } from '../src/engine/model.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';
import { softHyphenRule } from '../src/rules/character/soft-hyphen.js';

const load = (name: string): string =>
  readFileSync(
    new URL(`../fixtures/char.soft-hyphen/${name}`, import.meta.url),
    'utf8',
  );

const modelFrom = (xml: string): DocumentModel =>
  new DocumentModel(new Map([['word/document.xml', xml]]));

describe('char.soft-hyphen', () => {
  it('detects soft hyphens in both forms', () => {
    const model = modelFrom(load('before.xml'));
    const finding = softHyphenRule.detect(model.context());
    // one U+00AD character + one <w:softHyphen/> element
    expect(finding.count).toBe(2);
  });

  it('removes both forms and matches the expected fixture', () => {
    const before = modelFrom(load('before.xml'));
    const after = modelFrom(load('after.xml'));

    const result = runPipeline(before); // conservative (auto tier) includes this rule
    expect(result.appliedRuleIds).toContain('char.soft-hyphen');

    // Visible text equals the expected fixture's, and no soft hyphens remain.
    expect(visibleText(before.document())).toBe(visibleText(after.document()));
    expect(softHyphenRule.detect(before.context()).count).toBe(0);
  });

  it('is a no-op on a clean document (text conservation holds)', () => {
    const clean = modelFrom(load('after.xml'));
    const textBefore = visibleText(clean.document());
    const result = runPipeline(clean);
    expect(result.appliedRuleIds).not.toContain('char.soft-hyphen');
    expect(visibleText(clean.document())).toBe(textBefore);
  });
});
