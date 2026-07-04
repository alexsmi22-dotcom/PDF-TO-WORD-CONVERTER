import JSZip from 'jszip';
import { DocumentModel } from '../engine/model.js';

/**
 * Parts loaded as UTF-8 text (the editable OOXML surface). Everything else —
 * images, embedded fonts, thumbnails — is carried through as raw bytes so the
 * engine never risks corrupting binary content.
 */
const TEXT_PART = /\.(xml|rels)$/i;

/**
 * An open OPC (Office Open XML) container. Wraps JSZip. Text parts are handed
 * to a DocumentModel for the rules to edit; binary parts are held verbatim and
 * re-emitted unchanged. Original entry order is preserved for stable output.
 */
export class OpcPackage {
  readonly model: DocumentModel;

  private constructor(
    private readonly text: Map<string, string>,
    private readonly binary: Map<string, Uint8Array>,
    private readonly order: readonly string[],
  ) {
    this.model = new DocumentModel(text);
  }

  static async open(data: ArrayBuffer | Uint8Array): Promise<OpcPackage> {
    const zip = await JSZip.loadAsync(data);
    const text = new Map<string, string>();
    const binary = new Map<string, Uint8Array>();
    const order: string[] = [];

    for (const name of Object.keys(zip.files)) {
      const entry = zip.files[name];
      if (!entry || entry.dir) continue;
      order.push(name);
      if (TEXT_PART.test(name)) {
        text.set(name, await entry.async('string'));
      } else {
        binary.set(name, await entry.async('uint8array'));
      }
    }

    if (!text.has('word/document.xml')) {
      throw new Error('Not a Word package: word/document.xml is missing');
    }
    return new OpcPackage(text, binary, order);
  }

  /**
   * Rezip. Text parts come from the model (edited parts re-serialized, the rest
   * verbatim); binary parts pass through byte-for-byte. Returns the new .docx.
   */
  async toUint8Array(): Promise<Uint8Array> {
    const updated = this.model.serialize();
    const zip = new JSZip();
    for (const name of this.order) {
      if (this.binary.has(name)) {
        zip.file(name, this.binary.get(name)!);
      } else {
        zip.file(name, updated.get(name) ?? this.text.get(name) ?? '');
      }
    }
    return zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
}
