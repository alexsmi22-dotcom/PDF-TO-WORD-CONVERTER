// Repair an already-converted .docx from the command line (for testing the
// engine outside Word):  npx vite-node src/repair-cli.ts <in.docx> [out.docx]
// Applies every rule (aggressive) so you can see the full cleanup.

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
(globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;
(globalThis as unknown as { XMLSerializer: unknown }).XMLSerializer = XMLSerializer;

import { readFileSync, writeFileSync } from 'node:fs';
import { OpcPackage } from './opc/package.js';
import { runPipeline, inventory } from './engine/pipeline.js';

async function main(): Promise<void> {
  const [, , input, outArg] = process.argv;
  if (!input) {
    console.error('usage: repair-cli <in.docx> [out.docx]');
    process.exit(2);
  }
  const output = outArg ?? input.replace(/\.docx$/i, ' (repaired).docx');

  const pkg = await OpcPackage.open(readFileSync(input));

  console.error('Found:');
  for (const f of inventory(pkg.model)) {
    if (f.count > 0) console.error(`  ${f.ruleId}: ${f.message}`);
  }

  const res = runPipeline(pkg.model, { isEnabled: () => true }); // apply everything
  writeFileSync(output, await pkg.toUint8Array());
  console.error(
    `\nApplied ${res.appliedRuleIds.length} rules, ${res.changeLog.length} changes.`,
  );
  console.error(`Wrote ${output}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
