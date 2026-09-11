/**
 * Extraction-based control-flow reproducer, NOT the React hook or the app.
 * Source: lero003/hazakura-editor@c11721d79ae1f3265d4b485fe43388b44f052a17
 * useDocumentExport.ts: beginExport, consumeExport, cancel{Format}Export,
 * export{Pdf,EpubBeta}, confirm{Pdf,EpubBeta}Export's entry guards.
 * Only request ownership / cancellation / async preflight are modeled.
 * React rendering, file I/O and Markdown processing are not executed.
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function makeHarness() {
  const exportAttemptRef = { current: null };
  const requests = { html: null, pdf: null, epub: null };
  const events = [];
  // Direct transcription, with TypeScript annotations and useCallback removed.
  const beginExport = (format, options) => {
    const current = exportAttemptRef.current;
    if (current?.phase === 'modal' && !options?.replaceOpen) return null;
    const attempt = { format, phase: 'preflight' };
    exportAttemptRef.current = attempt;
    return attempt;
  };
  const consumeExport = (format) => {
    const attempt = exportAttemptRef.current;
    if (attempt?.format !== format || attempt.phase !== 'modal') return false;
    exportAttemptRef.current = null;
    return true;
  };
  // Each source cancel function ignores the return value and clears its own state.
  const cancel = (format) => {
    consumeExport(format);
    requests[format] = null;
  };
  // Models the identical PDF/EPUB await + identity + catch + commit sequence.
  const prepare = async (format, preflight, options) => {
    const attempt = beginExport(format, { replaceOpen: Boolean(options?.cancelPrevious) });
    if (!attempt) return;
    try { await preflight; }
    catch (error) {
      if (exportAttemptRef.current !== attempt) return;
      exportAttemptRef.current = null;
      events.push(`${format}: preflight failed: ${error.message}`);
      return;
    }
    if (exportAttemptRef.current !== attempt) return;
    // Document/session/workspace stay unchanged throughout these scenarios.
    attempt.phase = 'modal';
    options?.cancelPrevious?.();
    requests[format] = { documentName: 'a.md' };
  };
  const openHtml = (options) => {
    const attempt = beginExport('html', { replaceOpen: Boolean(options?.cancelPrevious) });
    if (!attempt) return;
    attempt.phase = 'modal';
    options?.cancelPrevious?.();
    requests.html = { documentName: 'a.md' };
  };
  // PDF/EPUB confirm prefix only. The HTML confirm path is deliberately NOT modeled
  // as equivalent: it checks htmlExportRequestRef then calls cancelHtmlExport.
  const confirmPdfOrEpub = (format) => {
    const request = requests[format];
    if (!request || !consumeExport(format)) return false;
    requests[format] = null;
    events.push(`${format}: writer reached`);
    return true;
  };
  const snapshot = () => ({
    visible: Object.keys(requests).filter(key => requests[key]),
    owner: exportAttemptRef.current ? { ...exportAttemptRef.current } : null,
    events: [...events],
  });
  return { cancel, prepare, openHtml, confirmPdfOrEpub, snapshot };
}

const results = [];
// Positive control: the implemented success path really keeps the previous request.
{
  const h = makeHarness(), d = deferred();
  h.openHtml();
  const pending = h.prepare('epub', d.promise, { cancelPrevious: () => h.cancel('html') });
  const during = h.snapshot();
  d.resolve(); await pending;
  const after = h.snapshot();
  assert.deepEqual(during.visible, ['html']);
  assert.deepEqual(after.visible, ['epub']);
  results.push({ case: 'normal replacement', during, after, expectedMet: true });
}
// F1: user cancellation does not invalidate the replacement attempt.
for (const next of ['pdf', 'epub']) {
  const h = makeHarness(), d = deferred();
  h.openHtml();
  const pending = h.prepare(next, d.promise, { cancelPrevious: () => h.cancel('html') });
  h.cancel('html'); // Controller session wrapper also clears drafts; not ownership.
  const afterCancel = h.snapshot();
  d.resolve(); await pending;
  const afterResolve = h.snapshot();
  assert.deepEqual(afterCancel.visible, []);
  assert.deepEqual(afterResolve.visible, [next]);
  results.push({ case: `cancel HTML during ${next} preparation`, afterCancel, afterResolve,
    expectedVisibleAfterResolve: [], observedBug: true });
}
// F2: a failed replacement keeps a PDF/EPUB request but drops its executable owner.
for (const [old, next] of [['pdf', 'epub'], ['epub', 'pdf']]) {
  const h = makeHarness(), d = deferred();
  await h.prepare(old, Promise.resolve());
  const pending = h.prepare(next, d.promise, { cancelPrevious: () => h.cancel(old) });
  d.reject(new Error('injected preflight exception')); await pending;
  const afterFailure = h.snapshot();
  const confirmReachedWriter = h.confirmPdfOrEpub(old);
  assert.deepEqual(afterFailure.visible, [old]);
  assert.equal(afterFailure.owner, null);
  assert.equal(confirmReachedWriter, false);
  results.push({ case: `${old} retained after ${next} preflight exception`, afterFailure,
    confirmReachedWriter, expectedConfirmReachedWriter: true, observedBug: true });
}
// Positive control: a genuinely newer export still supersedes the pending attempt.
{
  const h = makeHarness(), d = deferred();
  h.openHtml();
  const pending = h.prepare('epub', d.promise, { cancelPrevious: () => h.cancel('html') });
  h.openHtml();
  d.resolve(); await pending;
  assert.deepEqual(h.snapshot().visible, ['html']);
  results.push({ case: 'newer intent supersedes earlier preflight', after: h.snapshot(), expectedMet: true });
}
const report = {
  kind: 'extraction-based state/control-flow reproducer; not React/Tauri integration',
  commit: 'c11721d79ae1f3265d4b485fe43388b44f052a17',
  runtime: process.version,
  cases: results,
};
console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL('./export-lifecycle-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
