import { parseXml, serializeXml } from './xml.js';
import type { RuleContext } from './types.js';

const MAIN_PART = 'word/document.xml';

/**
 * Holds the OPC parts as raw strings and lazily parses the ones a rule touches.
 * Only parts that were parsed *and* mutated are re-serialized on the way out,
 * which keeps untouched parts byte-stable.
 *
 * Constructed from a plain name->xml map, so the engine has no hard dependency
 * on JSZip and stays fully testable in Node. The OPC layer (src/opc) is what
 * turns a JSZip package into this map and back.
 */
export class DocumentModel {
  private readonly parsed = new Map<string, Document>();

  constructor(private readonly raw: Map<string, string>) {}

  has(name: string): boolean {
    return this.raw.has(name);
  }

  /** Parse a part on demand; returns undefined if the package lacks it. */
  part(name: string): Document | undefined {
    if (this.parsed.has(name)) return this.parsed.get(name);
    const xml = this.raw.get(name);
    if (xml === undefined) return undefined;
    const dom = parseXml(xml);
    this.parsed.set(name, dom);
    return dom;
  }

  /** The main story part, word/document.xml — always present in a real .docx. */
  document(): Document {
    const dom = this.part(MAIN_PART);
    if (!dom) throw new Error(`Package is missing ${MAIN_PART}`);
    return dom;
  }

  /** A RuleContext view over this model for a given options bag. */
  context(options: Readonly<Record<string, unknown>> = {}): RuleContext {
    return {
      document: () => this.document(),
      part: (name) => this.part(name),
      options,
    };
  }

  /**
   * Produce the final name->xml map: parsed-and-touched parts re-serialized,
   * everything else passed through verbatim.
   */
  serialize(): Map<string, string> {
    const out = new Map(this.raw);
    for (const [name, dom] of this.parsed) {
      out.set(name, serializeXml(dom));
    }
    return out;
  }
}
