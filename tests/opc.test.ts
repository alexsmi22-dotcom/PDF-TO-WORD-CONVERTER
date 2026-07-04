import JSZip from 'jszip';
import { OpcPackage } from '../src/opc/package.js';
import { runPipeline } from '../src/engine/pipeline.js';
import { visibleText } from '../src/engine/text.js';

const DOC_WITH_SOFT_HYPHEN =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:body><w:p><w:r><w:t xml:space="preserve">con­version</w:t></w:r></w:p></w:body>' +
  '</w:document>';

// A few non-UTF8 bytes standing in for an embedded image.
const IMAGE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x01]);

async function buildDocx(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types/>');
  zip.file('word/document.xml', DOC_WITH_SOFT_HYPHEN);
  zip.file('word/media/image1.png', IMAGE_BYTES);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('OpcPackage round-trip', () => {
  it('repairs document.xml and preserves binary parts byte-for-byte', async () => {
    const original = await buildDocx();

    const pkg = await OpcPackage.open(original);
    expect(visibleText(pkg.model.document())).toBe('con­version');

    runPipeline(pkg.model); // removes the soft hyphen

    const repaired = await pkg.toUint8Array();
    const reopened = await OpcPackage.open(repaired);

    // Text repaired...
    expect(visibleText(reopened.model.document())).toBe('conversion');

    // ...and the image survived untouched.
    const media = await JSZip.loadAsync(repaired);
    const imgOut = await media.file('word/media/image1.png')!.async('uint8array');
    expect(Array.from(imgOut)).toEqual(Array.from(IMAGE_BYTES));
  });

  it('rejects a non-Word package', async () => {
    const zip = new JSZip();
    zip.file('hello.txt', 'not a docx');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await expect(OpcPackage.open(bytes)).rejects.toThrow(/word\/document\.xml/);
  });
});
