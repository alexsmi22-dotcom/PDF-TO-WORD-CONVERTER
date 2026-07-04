/**
 * Environment-agnostic XML parse/serialize.
 *
 * In the browser (the Word add-in runtime) we use the native DOMParser /
 * XMLSerializer: best OOXML namespace fidelity, zero bundle cost.
 * In Node (CI + tests) we fall back to @xmldom/xmldom, which is also
 * namespace-aware. The engine is written against the DOM `Document`/`Element`
 * interfaces so a single code path serves both.
 */

type DOMParserCtor = new () => { parseFromString(s: string, t: string): Document };
type XMLSerializerCtor = new () => { serializeToString(n: Node): string };

let ParserCtor: DOMParserCtor;
let SerializerCtor: XMLSerializerCtor;

if (typeof globalThis.DOMParser !== 'undefined') {
  ParserCtor = globalThis.DOMParser as unknown as DOMParserCtor;
  SerializerCtor = globalThis.XMLSerializer as unknown as XMLSerializerCtor;
} else {
  // Node/test path. Dynamic import keeps @xmldom out of the browser critical path.
  const xmldom = await import('@xmldom/xmldom');
  ParserCtor = xmldom.DOMParser as unknown as DOMParserCtor;
  SerializerCtor = xmldom.XMLSerializer as unknown as XMLSerializerCtor;
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

export function parseXml(xml: string): Document {
  const doc = new ParserCtor().parseFromString(xml, 'application/xml');
  return doc;
}

/**
 * Serialize back to an OOXML part string. Word parts open with an XML
 * declaration that XMLSerializer drops, so we re-prepend the canonical one.
 * Byte-for-byte stability of untouched parts is enforced at the OPC layer
 * (we only re-serialize parts a rule actually changed); this function is for
 * parts the engine has edited.
 */
export function serializeXml(doc: Document): string {
  const body = new SerializerCtor().serializeToString(doc);
  return body.startsWith('<?xml') ? body : XML_DECL + body;
}
