import { bytesToBase64 } from './base64.js';

/**
 * Output modes for a repaired package (paper section 4.4).
 *
 * Copy mode is the default and the only mode shipped in v1.0: it opens the
 * repaired package as a new, unsaved document, leaving the original untouched.
 * In-place mode replaces the current document body and is gated behind an
 * explicit toggle + confirmation because undo behavior varies across hosts.
 */

/** Open the repaired package as a brand-new document. Requires WordApi 1.3. */
export async function openAsNewDocument(pkg: Uint8Array): Promise<void> {
  const base64 = bytesToBase64(pkg);
  await Word.run(async (context) => {
    const created = context.application.createDocument(base64);
    created.open();
    await context.sync();
  });
}

/**
 * Replace the current document's body with the repaired content, in place.
 * Registers with undo, but undo fidelity is host-dependent — callers must
 * confirm with the user and prompt a save first.
 */
export async function replaceInPlace(pkg: Uint8Array): Promise<void> {
  const base64 = bytesToBase64(pkg);
  await Word.run(async (context) => {
    context.document.body.insertFileFromBase64(base64, Word.InsertLocation.replace);
    await context.sync();
  });
}
