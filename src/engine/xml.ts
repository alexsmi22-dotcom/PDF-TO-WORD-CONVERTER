/**
 * XML parse/serialize over the native DOM.
 *
 * In the add-in (browser) runtime, DOMParser / XMLSerializer are global. In
 * Node/CI they are not, so the test setup polyfills them with @xmldom/xmldom
 * (see tests/setup.ts). Either way this module just uses the globals — no
 * dynamic import, no top-level await, and nothing Node-only in the browser
 * bundle.
 */

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

export function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/**
 * Serialize an edited OOXML part. XMLSerializer drops the XML declaration Word
 * parts open with, so we re-prepend the canonical one. Byte stability of
 * untouched parts is handled at the OPC layer (only edited parts are
 * re-serialized); this is for parts the engine actually changed.
 */
export function serializeXml(doc: Document): string {
  const body = new XMLSerializer().serializeToString(doc);
  return body.startsWith('<?xml') ? body : XML_DECL + body;
}
