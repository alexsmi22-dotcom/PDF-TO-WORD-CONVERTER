import {
  scanCurrentDocument,
  applyRepairs,
  defaultEnabled,
  SIZE_WARN_BYTES,
  type ScanResult,
} from '../app/repair.js';

let scan: ScanResult | null = null;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function show(id: string, visible: boolean): void {
  ($(id) as HTMLElement).hidden = !visible;
}

function fmtSize(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

Office.onReady((info) => {
  const status = $('status');
  if (info.host !== Office.HostType.Word) {
    status.textContent = 'This add-in runs in Microsoft Word.';
    return;
  }
  status.textContent = 'Ready. Open your converted document, then scan.';
  const scanBtn = $('scan') as HTMLButtonElement;
  scanBtn.disabled = false;
  scanBtn.addEventListener('click', runScan);
  $('rescan').addEventListener('click', runScan);
  $('again').addEventListener('click', runScan);
  $('apply').addEventListener('click', runApply);
});

async function runScan(): Promise<void> {
  show('report', false);
  show('done', false);
  const status = $('status');
  status.textContent = 'Scanning…';
  try {
    scan = await scanCurrentDocument();
    renderReport(scan);
  } catch (err) {
    status.textContent = `Could not read the document: ${message(err)}`;
  }
}

function renderReport(result: ScanResult): void {
  const status = $('status');
  const summary = $('summary');
  const list = $('findings');
  list.innerHTML = '';

  if (result.rules.length === 0) {
    status.textContent = 'No conversion damage found — this document looks clean.';
    return;
  }
  status.textContent = '';

  const sizeNote =
    result.sizeBytes > SIZE_WARN_BYTES
      ? ` Large file (${fmtSize(result.sizeBytes)}) — repair may take a moment.`
      : '';
  summary.textContent = `Found ${result.rules.length} issue type${
    result.rules.length === 1 ? '' : 's'
  }.${sizeNote}`;

  const enabled = defaultEnabled(result.rules);
  for (const rule of result.rules) {
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = enabled.has(rule.id);
    cb.disabled = rule.tier === 'report-only';
    cb.dataset.ruleId = rule.id;

    const body = document.createElement('div');
    body.className = 'finding-body';
    body.innerHTML =
      `<span class="finding-title">${escape(rule.title)}</span>` +
      `<span class="tier ${rule.tier}">${rule.tier}</span>` +
      `<div class="finding-msg">${escape(rule.finding.message)}</div>`;

    li.append(cb, body);
    list.appendChild(li);
  }

  show('report', true);
}

async function runApply(): Promise<void> {
  if (!scan) return;
  const apply = $('apply') as HTMLButtonElement;
  apply.disabled = true;
  apply.textContent = 'Repairing…';

  const checked = new Set<string>();
  for (const cb of document.querySelectorAll<HTMLInputElement>(
    '#findings input[type=checkbox]:checked',
  )) {
    if (cb.dataset.ruleId) checked.add(cb.dataset.ruleId);
  }

  try {
    const { changeLog, appliedRuleIds } = await applyRepairs(scan.bytes, checked, 'copy');
    renderDone(appliedRuleIds.length, changeLog.length);
  } catch (err) {
    $('status').textContent = `Repair failed: ${message(err)}`;
  } finally {
    apply.disabled = false;
    apply.textContent = 'Repair (open a clean copy)';
  }
}

function renderDone(rulesApplied: number, changes: number): void {
  show('report', false);
  $('done-summary').textContent =
    `Done. Applied ${rulesApplied} rule${rulesApplied === 1 ? '' : 's'}, ` +
    `${changes} change${changes === 1 ? '' : 's'}. A clean copy has opened in a new window.`;
  show('done', true);
}

function message(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}
