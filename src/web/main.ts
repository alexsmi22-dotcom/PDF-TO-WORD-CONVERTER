import { OpcPackage } from '../opc/package.js';
import { runPipeline, inventory } from '../engine/pipeline.js';
import type { Finding } from '../engine/types.js';

let fileBytes: Uint8Array | null = null;
let fileName = 'document.docx';

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
};
const show = (id: string, visible: boolean) => (($(id) as HTMLElement).hidden = !visible);

function setStatus(msg: string): void {
  const s = $('status');
  s.textContent = msg;
  show('status', !!msg);
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

async function handleFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    setStatus('That is not a .docx file. Please choose a Word document.');
    return;
  }
  fileName = file.name;
  show('report', false);
  show('done', false);
  setStatus('Reading…');
  try {
    fileBytes = new Uint8Array(await file.arrayBuffer());
    const pkg = await OpcPackage.open(fileBytes);
    const findings = inventory(pkg.model).filter((f) => f.count > 0);
    renderReport(findings);
    setStatus('');
  } catch (err) {
    fileBytes = null;
    setStatus(
      `Couldn't open this file: ${message(err)}. ` +
        'Make sure it opens in Word and has selectable text (not a scanned image).',
    );
  }
}

function renderReport(findings: Finding[]): void {
  const list = $('findings');
  list.innerHTML = '';
  if (findings.length === 0) {
    $('report-title').textContent = `“${fileName}” looks clean — nothing to repair.`;
    show('report', true);
    ($('repair') as HTMLButtonElement).hidden = true;
    return;
  }
  ($('repair') as HTMLButtonElement).hidden = false;
  $('report-title').textContent = `Found ${findings.length} thing${
    findings.length === 1 ? '' : 's'
  } to fix in “${fileName}”:`;
  for (const f of findings) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot"></span>${esc(f.message)}`;
    if (f.samples && f.samples.length) {
      const pv = document.createElement('div');
      pv.className = 'preview';
      pv.innerHTML = f.samples
        .slice(0, 3)
        .map((s) => `<span>${esc(s)}</span>`)
        .join('');
      li.appendChild(pv);
    }
    list.appendChild(li);
  }
  show('report', true);
}

async function repairAndDownload(): Promise<void> {
  if (!fileBytes) return;
  const btn = $('repair') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Repairing…';
  try {
    const pkg = await OpcPackage.open(fileBytes);
    const result = runPipeline(pkg.model, { isEnabled: () => true }); // apply every fix
    const out = await pkg.toUint8Array();
    const outName = fileName.replace(/\.docx$/i, '') + ' (repaired).docx';
    download(out, outName);
    show('report', false);
    $('done-msg').textContent =
      `Done — applied ${result.appliedRuleIds.length} fix${
        result.appliedRuleIds.length === 1 ? '' : 'es'
      } (${result.changeLog.length} changes). ` + `“${outName}” has been downloaded.`;
    show('done', true);
  } catch (err) {
    setStatus(`Repair failed: ${message(err)}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Repair & download';
  }
}

function download(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// --- wire up UI ---
const drop = $('drop');
const input = $('file') as HTMLInputElement;

drop.addEventListener('click', () => input.click());
drop.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') input.click();
});
input.addEventListener('change', () => {
  if (input.files && input.files[0]) handleFile(input.files[0]);
});

['dragenter', 'dragover'].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  }),
);
['dragleave', 'drop'].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove('over');
  }),
);
drop.addEventListener('drop', (e) => {
  const dt = (e as DragEvent).dataTransfer;
  if (dt && dt.files && dt.files[0]) handleFile(dt.files[0]);
});

$('repair').addEventListener('click', repairAndDownload);
const resetToStart = () => {
  fileBytes = null;
  input.value = '';
  show('report', false);
  show('done', false);
  setStatus('');
};
$('reset').addEventListener('click', resetToStart);
$('again').addEventListener('click', resetToStart);
