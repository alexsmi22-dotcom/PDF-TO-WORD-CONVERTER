// Cross-platform "PDF -> editable Word" wizard.
//   npx vite-node src/wizard/wizard.ts <input.pdf> <output.docx> [maxPages]
// The only platform-specific step is the OCR helper; everything else is shared.

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
// The repair engine uses the DOM globals; provide them in the Node runtime.
(globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;
(globalThis as unknown as { XMLSerializer: unknown }).XMLSerializer = XMLSerializer;

import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import type { OcrDoc } from './ocr-types.js';
import { docToBlocks } from './layout.js';
import { buildDocx } from './docx-writer.js';
import { applyPatentFixes } from './patent-fixes.js';
import { OpcPackage } from '../opc/package.js';
import { runPipeline } from '../engine/pipeline.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function runOcr(pdf: string, maxPages?: number): OcrDoc {
  const plat = process.platform;
  let cmd: string;
  let args: string[];
  if (plat === 'darwin') {
    const bin = join(projectRoot, 'ocr', 'mac', 'vision_ocr');
    if (existsSync(bin)) {
      cmd = bin;
      args = [pdf];
    } else {
      cmd = 'swift';
      args = [join(projectRoot, 'ocr', 'mac', 'vision_ocr.swift'), pdf];
    }
  } else if (plat === 'win32') {
    cmd = join(projectRoot, 'ocr', 'win', 'WinOcr.exe'); // built on the PC; see ocr/win/README.md
    args = [pdf];
  } else {
    throw new Error(`Unsupported platform: ${plat}`);
  }
  if (maxPages) args.push(String(maxPages));

  const res = spawnSync(cmd, args, { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`OCR helper failed (${cmd}): ${res.stderr || res.error?.message || res.status}`);
  }
  return JSON.parse(res.stdout) as OcrDoc;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const input = args.find((a) => a.toLowerCase().endsWith('.pdf'));
  const output = args.find((a) => a.toLowerCase().endsWith('.docx'));
  const maxPages = args.map(Number).find((n) => Number.isInteger(n) && n > 0);
  if (!input || !output) {
    console.error('usage: wizard <input.pdf> <output.docx> [maxPages]');
    process.exit(2);
  }

  console.error(`OCR (${process.platform})…`);
  const ocr = runOcr(input, maxPages);
  console.error(`OCR done: ${ocr.pages.length} pages via ${ocr.engine}.`);

  const blocks = docToBlocks(ocr.pages);
  // Load image bytes for figure pages we're embedding.
  let figures = 0;
  for (const b of blocks) {
    if (b.kind === 'image' && b.imagePath && existsSync(b.imagePath)) {
      b.imageBytes = new Uint8Array(readFileSync(b.imagePath));
      figures += 1;
    }
  }
  // High-confidence patent OCR fixes (kind codes, term-adjustment boilerplate).
  let patentFixes = 0;
  for (const b of blocks) {
    if ((b.kind === 'body' || b.kind === 'heading') && b.text) {
      const r = applyPatentFixes(b.text);
      b.text = r.text;
      patentFixes += r.count;
    }
  }

  const textBlocks = blocks.filter((b) => b.kind !== 'pagebreak' && b.kind !== 'image').length;
  console.error(
    `Reconstructed ${textBlocks} text blocks, ${figures} figure pages kept as images, ` +
      `${patentFixes} patent fixes.`,
  );

  let bytes = await buildDocx(blocks, basename(input).replace(/\.pdf$/i, ''));

  // Repair-engine cleanup: fix OCR ligatures/soft-hyphens/confusables in the text.
  const pkg = await OpcPackage.open(bytes);
  const res = runPipeline(pkg.model, { isEnabled: (r) => r.category === 'character' });
  bytes = await pkg.toUint8Array();
  console.error(`Cleanup: ${res.changeLog.length} character fixes.`);

  writeFileSync(output, bytes);
  console.error(`Wrote ${output} (${bytes.length} bytes).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
