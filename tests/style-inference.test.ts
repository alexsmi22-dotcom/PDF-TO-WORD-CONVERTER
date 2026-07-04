import { readFileSync } from 'node:fs';
import { DocumentModel } from '../src/engine/model.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';
import { childTag } from '../src/engine/dom.js';
import { styleInferenceRule } from '../src/rules/style/style-inference.js';

const load = (name: string): string =>
  readFileSync(new URL(`../fixtures/style.inference/${name}`, import.meta.url), 'utf8');

const modelFrom = (docXml: string, stylesXml?: string): DocumentModel => {
  const parts = new Map([['word/document.xml', docXml]]);
  if (stylesXml) parts.set('word/styles.xml', stylesXml);
  return new DocumentModel(parts);
};

const paraStyle = (m: DocumentModel, i: number): string | null => {
  const p = m.document().getElementsByTagName('w:p')[i]!;
  const pPr = childTag(p, 'w:pPr');
  return (pPr && childTag(pPr, 'w:pStyle')?.getAttribute('w:val')) ?? null;
};

const styleIds = (m: DocumentModel): string[] => {
  const defs = m.part('word/styles.xml')!.getElementsByTagName('w:style');
  return Array.from({ length: defs.length }, (_, i) => defs[i]!.getAttribute('w:styleId') ?? '');
};

describe('style.inference', () => {
  it('detects two headings ranked by size', () => {
    const finding = styleInferenceRule.detect(modelFrom(load('before.xml')).context());
    expect(finding.count).toBe(2);
    expect(finding.samples?.[0]).toContain('H1: Chapter One');
    expect(finding.samples?.[1]).toContain('H2: Introduction');
  });

  it('is suggest-tier: not applied under the conservative default', () => {
    const result = runPipeline(modelFrom(load('before.xml')));
    expect(result.appliedRuleIds).not.toContain('style.inference');
  });

  it('applies Heading styles to headings only, conserving text', () => {
    const m = modelFrom(load('before.xml'));
    const textBefore = visibleText(m.document());
    runPipeline(m, { isEnabled: (r) => r.id === 'style.inference' });

    expect(paraStyle(m, 0)).toBe('Heading1');
    expect(paraStyle(m, 1)).toBe('Heading2');
    expect(paraStyle(m, 2)).toBeNull(); // body untouched
    expect(paraStyle(m, 3)).toBeNull();
    expect(visibleText(m.document())).toBe(textBefore);
  });

  it('injects Heading definitions into styles.xml when missing', () => {
    const styles =
      '<?xml version="1.0"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '</w:styles>';
    const m = modelFrom(load('before.xml'), styles);
    styleInferenceRule.transform(m.context());

    const ids = styleIds(m);
    expect(ids).toContain('Heading1');
    expect(ids).toContain('Heading2');
    expect(ids).toContain('Normal'); // existing definitions preserved
  });

  it('does not re-style a paragraph that already has a pStyle', () => {
    const xml =
      '<?xml version="1.0"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:sz w:val="40"/></w:rPr><w:t>Kept</w:t></w:r></w:p>' +
      '<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>Body text here, long enough to be body.</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const m = modelFrom(xml);
    expect(styleInferenceRule.detect(m.context()).count).toBe(0);
  });
});
