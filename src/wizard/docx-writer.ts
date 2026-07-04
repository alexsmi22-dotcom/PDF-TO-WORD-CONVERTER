import JSZip from 'jszip';
import type { Block } from './ocr-types.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

const EMU_PER_IN = 914400;
const MAX_W = Math.round(6.5 * EMU_PER_IN); // content width at 1" margins
const MAX_H = Math.round(9.0 * EMU_PER_IN); // content height

function esc(t: string): string {
  return t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

function pngSize(b: Uint8Array): { w: number; h: number } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) }; // IHDR width/height
}

function textParagraph(block: Block): string {
  if (block.kind === 'pagebreak') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const style = block.kind === 'heading' ? `Heading${Math.min(block.level ?? 1, 3)}` : null;
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${esc(block.text ?? '')}</w:t></w:r></w:p>`;
}

function imageParagraph(rid: string, id: number, bytes: Uint8Array): string {
  const { w, h } = pngSize(bytes);
  let cx = MAX_W;
  let cy = Math.round((MAX_W * h) / w);
  if (cy > MAX_H) {
    cy = MAX_H;
    cx = Math.round((MAX_H * w) / h);
  }
  return (
    '<w:p><w:r><w:drawing>' +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Page ${id}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    `<a:graphic><a:graphicData uri="${PIC}"><pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="Page ${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline>' +
    '</w:drawing></w:r></w:p>'
  );
}

function styleDef(id: string, name: string, outline: number, sz: number): string {
  return (
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
    `<w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="${outline}"/>` +
    `<w:spacing w:before="120" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`
  );
}

/** Build an editable .docx from reconstructed blocks (text + embedded figures). */
export async function buildDocx(blocks: Block[], title: string): Promise<Uint8Array> {
  const media: Array<{ name: string; bytes: Uint8Array }> = [];
  const rels: string[] = [
    `<Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/>`,
  ];
  let imgN = 0;

  const bodyParts = blocks.map((b) => {
    if (b.kind === 'image' && b.imageBytes) {
      imgN += 1;
      const name = `image${imgN}.png`;
      const rid = `rId${imgN + 1}`;
      media.push({ name, bytes: b.imageBytes });
      rels.push(`<Relationship Id="${rid}" Type="${R}/image" Target="media/${name}"/>`);
      return imageParagraph(rid, imgN, b.imageBytes);
    }
    return textParagraph(b);
  });

  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}">` +
    `<w:body>${bodyParts.join('')}` +
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
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;

  void title;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('word/document.xml', document);
  zip.file('word/styles.xml', styles);
  zip.file('word/_rels/document.xml.rels', docRels);
  for (const m of media) zip.file(`word/media/${m.name}`, m.bytes);
  return zip.generateAsync({ type: 'uint8array' });
}
