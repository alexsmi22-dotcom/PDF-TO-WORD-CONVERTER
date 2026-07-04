import { readFileSync } from 'node:fs';
import { DocumentModel } from '../src/engine/model.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';
import { emptyParagraphsRule } from '../src/rules/layout/empty-paragraphs.js';

const load = (name: string): string =>
  readFileSync(
    new URL(`../fixtures/layout.empty-paragraphs/${name}`, import.meta.url),
    'utf8',
  );

const modelFrom = (xml: string): DocumentModel =>
  new DocumentModel(new Map([['word/document.xml', xml]]));

const countP = (m: DocumentModel): number =>
  m.document().getElementsByTagName('w:p').length;

describe('layout.empty-paragraphs', () => {
  it('counts removable blanks (run of 4 -> 3 removable), ignores the single', () => {
    const model = modelFrom(load('before.xml'));
    expect(emptyParagraphsRule.detect(model.context()).count).toBe(3);
  });

  it('collapses runs of 3+ to one, leaves the single blank, conserves text', () => {
    const model = modelFrom(load('before.xml'));
    const textBefore = visibleText(model.document());

    const result = runPipeline(model); // auto tier
    expect(result.appliedRuleIds).toContain('layout.empty-paragraphs');

    // 8 paragraphs -> 5 (three blanks removed)
    expect(countP(model)).toBe(5);
    expect(visibleText(model.document())).toBe(textBefore);
  });

  it('refuses to delete a blank paragraph that anchors a drawing', () => {
    const model = modelFrom(
      '<?xml version="1.0"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:body>' +
        '<w:p/><w:p/><w:p><w:r><w:drawing/></w:r></w:p><w:p/>' +
        '</w:body></w:document>',
    );
    // The drawing paragraph breaks the run, so no run reaches length 3.
    expect(emptyParagraphsRule.detect(model.context()).count).toBe(0);
  });

  it('collapses runs of two only when collapseDoubles is set', () => {
    const xml =
      '<?xml version="1.0"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:t>a</w:t></w:r></w:p><w:p/><w:p/>' +
      '<w:p><w:r><w:t>b</w:t></w:r></w:p></w:body></w:document>';

    expect(emptyParagraphsRule.detect(modelFrom(xml).context()).count).toBe(0);
    expect(
      emptyParagraphsRule.detect(modelFrom(xml).context({ collapseDoubles: true }))
        .count,
    ).toBe(1);
  });
});
