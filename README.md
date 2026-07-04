# Conversion Repair for Word

A free, open-source Microsoft Word add-in that **repairs the damage left by
PDF-to-Word conversion** — section-break noise, fake columns, floating text
boxes, exact line heights, one-paragraph-per-line, OCR ligatures and
confusables, stamped headers and page numbers.

Everything runs **client-side in the browser** inside the Word add-in sandbox.
No content leaves the machine. No server, no upload, no telemetry.

> ⚠️ Early development. Phase 0 (engine + first rule) is in place; the Word
> task-pane UI and the full v1 rule set are being built. See the roadmap below.

## How it works

A Word add-in can only act on a document already open in Word — there is no API
that ingests a raw PDF. So the product is **repair, not conversion**:

```
   "I have a PDF"  ──►  pdf.js convert (in browser)  ─┐
                                                       ├─►  REPAIR ENGINE  ─►  clean .docx
   "I have a PDF"  ──►  guided open in Word ───────────┘         ▲
                                                                  │
   "I already have a messy .docx open" ───────────────────────────┘
```

The **repair engine** is the core. It unzips the `.docx` (OPC package) with
JSZip, parses the OOXML with the DOM, applies an ordered set of deterministic,
logged repair rules, and rezips. Every path — including our own in-browser
pdf.js conversion — flows through it.

## Architecture

- **Pure engine.** The engine operates on XML strings, so it is fully testable
  in Node/CI without Word. Office.js is only the thin acquisition/output shell.
- **Rules are self-contained modules** with a `detect` + `transform` and their
  own before/after fixtures. Rules never import one another; the engine owns
  ordering (`src/rules/registry.ts`).
- **Confidence tiers.** `auto` applies by default, `suggest` is opt-in with
  previews, `report-only` never auto-changes anything.
- **Text-conservation invariant.** After every run the engine checks that
  structural/layout/style rules did not alter visible text; only character
  rules may, and only what they log. A violation aborts the apply.
- **Non-destructive by default.** Output is a repaired *copy*; the original is
  never touched unless you explicitly choose in-place mode.

## Repository layout

```
manifest/    Office add-in manifest + assets
src/taskpane UI and repair report
src/acquire  Office.js getFileAsync, slices, base64
src/opc      JSZip wrappers, part registry
src/engine   pipeline, tiers, text-conservation invariant, XML/model
src/rules    structural/ layout/ character/ style/  (+ registry)
src/convert  in-browser pdf.js -> docx path
src/ai       isolated, optional, bring-your-own-key
fixtures/    <rule-id>/before.xml, after.xml, notes.md
tests/       vitest suites and golden files
docs/        design paper and rule-authoring guide
```

## Develop

```bash
npm install
npm test         # vitest — pure engine, no Word needed
npm run typecheck
npm run build    # add-in bundle (once the task pane lands)
```

## Contributing

One rule per pull request. Fixtures required. No cross-rule imports. Character
tables live as data files so locale packs (including CJK) arrive as data +
fixtures rather than code. CI fails any rule submission without fixtures.

## License

Apache-2.0. The explicit patent grant matters for corporate and legal users.
