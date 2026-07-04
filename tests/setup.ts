/**
 * Test setup: polyfill the DOM XML globals the engine uses. In the browser
 * these are native; in Node we back them with @xmldom/xmldom so the engine runs
 * unchanged under vitest.
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const g = globalThis as unknown as {
  DOMParser: unknown;
  XMLSerializer: unknown;
};
g.DOMParser = DOMParser;
g.XMLSerializer = XMLSerializer;
