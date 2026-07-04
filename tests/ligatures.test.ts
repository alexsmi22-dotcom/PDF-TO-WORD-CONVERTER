import { readFileSync } from 'node:fs';
import { DocumentModel } from '../src/engine/model.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';
import { ligaturesRule } from '../src/rules/character/ligatures.js';

const load = (name: string): string =>
  readFileSync(
    new URL(`../fixtures/char.ligatures/${name}`, import.meta.url),
    'utf8',
  );

const modelFrom = (xml: string): DocumentModel =>
  new DocumentModel(new Map([['word/document.xml', xml]]));

describe('char.ligatures', () => {
  it('counts every ligature', () => {
    const model = modelFrom(load('before.xml'));
    expect(ligaturesRule.detect(model.context()).count).toBe(5);
  });

  it('expands ligatures to match the expected fixture', () => {
    const before = modelFrom(load('before.xml'));
    const after = modelFrom(load('after.xml'));

    const result = runPipeline(before);
    expect(result.appliedRuleIds).toContain('char.ligatures');
    expect(visibleText(before.document())).toBe(visibleText(after.document()));
    expect(ligaturesRule.detect(before.context()).count).toBe(0);
  });
});
