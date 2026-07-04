import { base64ToBytes } from './base64.js';

/**
 * Read the current Word document as a compressed OPC package via the Common
 * API. getFileAsync(Compressed) returns the *last saved* state as a sliced
 * binary file (slices cap at 4 MB); we pull slices sequentially and concatenate.
 *
 * Because it reflects the saved state, callers should ensure the document is
 * saved first (see ensureSaved) or warn the user about unsaved edits.
 */
export function readDocumentPackage(): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    Office.context.document.getFileAsync(
      Office.FileType.Compressed,
      { sliceSize: 4 * 1024 * 1024 },
      (fileResult) => {
        if (fileResult.status !== Office.AsyncResultStatus.Succeeded) {
          reject(fileResult.error);
          return;
        }
        const file = fileResult.value;
        const slices: Uint8Array[] = new Array(file.sliceCount);

        const readSlice = (index: number): void => {
          file.getSliceAsync(index, (sliceResult) => {
            if (sliceResult.status !== Office.AsyncResultStatus.Succeeded) {
              file.closeAsync(() => undefined);
              reject(sliceResult.error);
              return;
            }
            slices[index] = toBytes(sliceResult.value.data);
            if (index + 1 < file.sliceCount) {
              readSlice(index + 1);
            } else {
              file.closeAsync(() => undefined);
              resolve(concat(slices));
            }
          });
        };

        readSlice(0);
      },
    );
  });
}

/** Slice data arrives as a byte array on desktop, base64 string on the web. */
function toBytes(data: unknown): Uint8Array {
  if (typeof data === 'string') return base64ToBytes(data);
  if (data instanceof Uint8Array) return data;
  if (Array.isArray(data)) return Uint8Array.from(data as number[]);
  throw new Error('Unexpected slice data type from getSliceAsync');
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
