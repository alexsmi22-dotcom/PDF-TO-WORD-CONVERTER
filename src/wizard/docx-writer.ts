import JSZip from 'jszip';
import type { Block } from './ocr-types.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function esc(t: string): string {
  return t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

function paragraph(block: Block): string {
  if (block.kind === 'pagebreak') {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
  const style =
    block.kind === 'heading' ? `Heading${Math.min(block.level ?? 1, 3)}` : null;
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${esc(block.text ?? '')}</w:t></w:r></w:p>`;
}

function styleDef(id: string, name: string, outline: number | null, sz: number): string {
  const ol = outline !== null ? `<w:outlineLvl w:val="${outline}"/>` : '';
  return (
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
    `<w:basedOn w:val="Normal"/><w:qFormat/><w:pPr>${ol}<w:spacing w:before="120" w:after="120"/></w:pPr>` +
    `<w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`
  );
}

/** Build an editable .docx package from reconstructed blocks. */
export async function buildDocx(blocks: Block[], title: string): Promise<Uint8Array> {
  const body = blocks.map(paragraph).join('');
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="${W}"><w:body>${body}` +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" ' +
    'w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';

  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:styles xmlns:w="${W}">` +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>' +
    '<w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:style>' +
    styleDef('Heading1', 'heading 1', 0, 32) +
    styleDef('Heading2', 'heading 2', 1, 28) +
    styleDef('Heading3', 'heading 3', 2, 24) +
    '</w:styles>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  void title; // reserved for docProps in a later pass
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('word/document.xml', document);
  zip.file('word/styles.xml', styles);
  zip.file('word/_rels/document.xml.rels', docRels);
  return zip.generateAsync({ type: 'uint8array' });
}
