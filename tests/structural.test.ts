import { readFileSync } from 'node:fs';
import { DocumentModel } from '../src/engine/model.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';
import { sectionBreaksRule } from '../src/rules/structural/section-breaks.js';
import { columnsRule } from '../src/rules/structural/columns.js';

const load = (dir: string, name: string): string =>
  readFileSync(new URL(`../fixtures/${dir}/${name}`, import.meta.url), 'utf8');

const modelFrom = (xml: string): DocumentModel =>
  new DocumentModel(new Map([['word/document.xml', xml]]));

function sectPrCounts(model: DocumentModel): { paragraph: number; total: number } {
  const all = model.document().getElementsByTagName('w:sectPr');
  let paragraph = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i]?.parentNode?.nodeName === 'w:pPr') paragraph++;
  }
  return { paragraph, total: all.length };
}

const WRAP = (body: string): string =>
  '<?xml version="1.0"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  `<w:body>${body}</w:body></w:document>`;

describe('struct.section-breaks', () => {
  it('detects one redundant continuous break in the fixture', () => {
    const model = modelFrom(load('struct.section-breaks', 'before.xml'));
    expect(sectionBreaksRule.detect(model.context()).count).toBe(1);
  });

  it('removes the redundant break, keeps the body section, conserves text', () => {
    const model = modelFrom(load('struct.section-breaks', 'before.xml'));
    const textBefore = visibleText(model.document());

    const result = runPipeline(model); // auto tier includes section-breaks
    expect(result.appliedRuleIds).toContain('struct.section-breaks');

    const counts = sectPrCounts(model);
    expect(counts.paragraph).toBe(0); // paragraph-level break removed
    expect(counts.total).toBe(1); // body-level section kept
    expect(visibleText(model.document())).toBe(textBefore); // text-neutral
  });

  it('does NOT merge across a genuine geometry change (orientation)', () => {
    const model = modelFrom(
      WRAP(
        '<w:p><w:pPr><w:sectPr>' +
          '<w:type w:val="continuous"/>' +
          '<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>' +
          '</w:sectPr></w:pPr></w:p>' +
          '<w:p><w:r><w:t>portrait</w:t></w:r></w:p>' +
          '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>',
      ),
    );
    expect(sectionBreaksRule.detect(model.context()).count).toBe(0);
  });

  it('does NOT touch a nextPage break even with identical geometry', () => {
    const model = modelFrom(
      WRAP(
        '<w:p><w:pPr><w:sectPr>' +
          '<w:type w:val="nextPage"/><w:pgSz w:w="12240" w:h="15840"/>' +
          '</w:sectPr></w:pPr></w:p>' +
          '<w:p><w:r><w:t>next</w:t></w:r></w:p>' +
          '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>',
      ),
    );
    expect(sectionBreaksRule.detect(model.context()).count).toBe(0);
  });
});

describe('struct.columns', () => {
  it('detects the multi-column section', () => {
    const model = modelFrom(load('struct.columns', 'before.xml'));
    expect(columnsRule.detect(model.context()).count).toBe(1);
  });

  it('is suggest-tier: not applied under the conservative default', () => {
    const model = modelFrom(load('struct.columns', 'before.xml'));
    const result = runPipeline(model);
    expect(result.appliedRuleIds).not.toContain('struct.columns');
  });

  it('flattens to one column when enabled, conserving text', () => {
    const model = modelFrom(load('struct.columns', 'before.xml'));
    const textBefore = visibleText(model.document());

    const result = runPipeline(model, { isEnabled: (r) => r.id === 'struct.columns' });
    expect(result.appliedRuleIds).toContain('struct.columns');

    const cols = model.document().getElementsByTagName('w:cols')[0]!;
    expect(cols.getAttribute('w:num')).toBe('1');
    expect(cols.getElementsByTagName('w:col').length).toBe(0);
    expect(visibleText(model.document())).toBe(textBefore);
  });
});
