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

function checkboxes(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('#findings input[type=checkbox]'),
  );
}

Office.onReady((info) => {
  const status = $('status');
  if (info.host !== Office.HostType.Word) {
    status.textContent = 'This add-in runs in Microsoft Word.';
    return;
  }
  status.textContent = 'Ready. Save your document, then click Scan.';
  const scanBtn = $('scan') as HTMLButtonElement;
  scanBtn.disabled = false;
  scanBtn.addEventListener('click', runScan);
  $('rescan').addEventListener('click', runScan);
  $('again').addEventListener('click', runScan);
  $('apply').addEventListener('click', runApply);
  ($('selectall') as HTMLInputElement).addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    for (const cb of checkboxes()) if (!cb.disabled) cb.checked = on;
    refreshApply();
  });
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
    // The most common cause on Mac is an unsaved document (Word has no file to
    // hand over), which surfaces as a generic "internal error".
    status.textContent =
      `Couldn't read the document (${message(err)}). ` +
      `Make sure it is saved to disk (press ⌘S), then click Scan again.`;
  }
}

function renderReport(result: ScanResult): void {
  const status = $('status');
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
  $('summary').textContent = `Found ${result.rules.length} issue type${
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
    cb.addEventListener('change', refreshApply);

    const body = document.createElement('div');
    body.className = 'finding-body';
    body.innerHTML =
      `<span class="finding-title">${esc(rule.title)}</span>` +
      `<span class="tier ${rule.tier}">${rule.tier}</span>` +
      `<div class="finding-msg">${esc(rule.finding.message)}</div>`;

    const samples = rule.finding.samples ?? [];
    if (samples.length > 0) {
      const preview = document.createElement('div');
      preview.className = 'finding-preview';
      preview.innerHTML = samples
        .slice(0, 3)
        .map((s) => `<span>${esc(s)}</span>`)
        .join('');
      body.appendChild(preview);
    }

    li.append(cb, body);
    list.appendChild(li);
  }

  syncSelectAll();
  refreshApply();
  show('report', true);
}

function selectedIds(): Set<string> {
  const ids = new Set<string>();
  for (const cb of checkboxes()) if (cb.checked && cb.dataset.ruleId) ids.add(cb.dataset.ruleId);
  return ids;
}

function syncSelectAll(): void {
  const boxes = checkboxes().filter((c) => !c.disabled);
  const all = boxes.length > 0 && boxes.every((c) => c.checked);
  ($('selectall') as HTMLInputElement).checked = all;
}

/** Keep the Apply button and hint in step with the current selection. */
function refreshApply(): void {
  syncSelectAll();
  const n = selectedIds().size;
  const apply = $('apply') as HTMLButtonElement;
  apply.disabled = n === 0;
  apply.textContent = n === 0 ? 'Repair selected' : `Repair ${n} selected`;
  $('apply-hint').textContent =
    n === 0
      ? 'Tick at least one fix above to enable repair.'
      : 'Repairs open as a new document. Your original is untouched.';
}

async function runApply(): Promise<void> {
  if (!scan) return;
  const checked = selectedIds();
  if (checked.size === 0) return;

  const apply = $('apply') as HTMLButtonElement;
  apply.disabled = true;
  apply.textContent = 'Repairing…';
  try {
    const { changeLog, appliedRuleIds } = await applyRepairs(scan.bytes, checked, 'copy');
    renderDone(appliedRuleIds.length, changeLog.length);
  } catch (err) {
    $('status').textContent = `Repair failed: ${message(err)}`;
  } finally {
    refreshApply();
  }
}

function renderDone(rulesApplied: number, changes: number): void {
  show('report', false);
  $('done-summary').textContent =
    rulesApplied === 0
      ? 'Nothing was changed. A copy opened unchanged.'
      : `Done. Applied ${rulesApplied} fix${rulesApplied === 1 ? '' : 'es'} ` +
        `(${changes} change${changes === 1 ? '' : 's'}). A clean copy opened in a new window.`;
  show('done', true);
}

function message(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}
