import { readFileSync } from 'node:fs';
import { DocumentModel } from '../src/engine/model.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';
import { textBoxesRule } from '../src/rules/structural/text-boxes.js';

const load = (name: string): string =>
  readFileSync(new URL(`../fixtures/struct.text-boxes/${name}`, import.meta.url), 'utf8');

const modelFrom = (xml: string): DocumentModel =>
  new DocumentModel(new Map([['word/document.xml', xml]]));

const countTag = (m: DocumentModel, tag: string): number =>
  m.document().getElementsByTagName(tag).length;

describe('struct.text-boxes', () => {
  it('counts one logical box despite the DrawingML/VML duplication', () => {
    const m = modelFrom(load('before.xml'));
    const finding = textBoxesRule.detect(m.context());
    expect(finding.count).toBe(1);
    expect(finding.samples?.[0]).toContain('Text trapped in a box.');
  });

  it('is suggest-tier: not applied under the conservative default', () => {
    const result = runPipeline(modelFrom(load('before.xml')));
    expect(result.appliedRuleIds).not.toContain('struct.text-boxes');
  });

  it('lifts text once into the flow and removes the box', () => {
    const m = modelFrom(load('before.xml'));
    const result = runPipeline(m, { isEnabled: (r) => r.id === 'struct.text-boxes' });
    expect(result.appliedRuleIds).toContain('struct.text-boxes');

    // Box gone, text present exactly once, in flow order (box text before body).
    expect(countTag(m, 'w:txbxContent')).toBe(0);
    expect(countTag(m, 'mc:AlternateContent')).toBe(0);
    const text = visibleText(m.document());
    expect(text.match(/Text trapped in a box\./g)?.length).toBe(1);
    expect(text).toBe('Text trapped in a box.A normal body paragraph.');
  });

  it('keeps document order when two boxes share an anchor (pure DrawingML)', () => {
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
    const box = (t: string): string =>
      `<w:r><w:drawing><wp:anchor><w:txbxContent>` +
      `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>` +
      `</w:txbxContent></wp:anchor></w:drawing></w:r>`;
    const xml =
      `<?xml version="1.0"?><w:document xmlns:w="${W}" xmlns:wp="${WP}">` +
      `<w:body><w:p>${box('First box')}${box('Second box')}</w:p>` +
      `<w:p><w:r><w:t> tail</w:t></w:r></w:p></w:body></w:document>`;
    const m = modelFrom(xml);
    expect(textBoxesRule.detect(m.context()).count).toBe(2);
    textBoxesRule.transform(m.context());
    expect(visibleText(m.document())).toBe('First boxSecond box tail');
  });
});
