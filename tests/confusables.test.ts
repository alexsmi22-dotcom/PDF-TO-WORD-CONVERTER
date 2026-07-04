import { readFileSync } from 'node:fs';
import { DocumentModel } from '../src/engine/model.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';
import { confusablesRule } from '../src/rules/character/confusables.js';

const load = (name: string): string =>
  readFileSync(new URL(`../fixtures/char.confusables/${name}`, import.meta.url), 'utf8');

const modelFrom = (xml: string): DocumentModel =>
  new DocumentModel(new Map([['word/document.xml', xml]]));

const wrap = (t: string): DocumentModel =>
  modelFrom(
    '<?xml version="1.0"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body><w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p></w:body></w:document>`,
  );

describe('char.confusables', () => {
  it('detects three corrections in the fixture', () => {
    expect(confusablesRule.detect(modelFrom(load('before.xml')).context()).count).toBe(3);
  });

  it('is suggest-tier: not applied under the conservative default', () => {
    const result = runPipeline(modelFrom(load('before.xml')));
    expect(result.appliedRuleIds).not.toContain('char.confusables');
  });

  it('applies context-correct fixes to match the expected fixture', () => {
    const before = modelFrom(load('before.xml'));
    const after = modelFrom(load('after.xml'));
    const result = runPipeline(before, { isEnabled: (r) => r.id === 'char.confusables' });
    expect(result.appliedRuleIds).toContain('char.confusables');
    expect(visibleText(before.document())).toBe(visibleText(after.document()));
  });

  it('fixes letters->digits only in digit context', () => {
    const m = wrap('order l23 and 2,OOO units');
    confusablesRule.transform(m.context());
    expect(visibleText(m.document())).toBe('order 123 and 2,000 units');
  });

  it('leaves ordinals, mixed serials, and non-doc rn-words untouched', () => {
    const m = wrap('the 1st COVID19 turn');
    const before = visibleText(m.document());
    confusablesRule.transform(m.context());
    expect(visibleText(m.document())).toBe(before);
  });
});
