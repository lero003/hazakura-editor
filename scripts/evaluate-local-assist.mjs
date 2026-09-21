import { checkEvaluationCandidate } from './local-assist-evaluation-checks.mjs';
// Maintainer-only live evaluation over authored fixtures. Never reads a workspace manuscript.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const value = (key) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
const helper = value('--helper');
const output = value('--output');
const repeats = Number(value('--repeats') ?? 1);
if (!helper || !output || !Number.isInteger(repeats) || repeats < 1 || repeats > 5) {
  throw new Error('Usage: node scripts/evaluate-local-assist.mjs --helper PATH --output REPORT.json [--repeats 1..5] [--backend system_default|core_ai|core_ai_test] [--model-id ID] [--model-path PATH]');
}
// Core AI needs the backend tag, the pinned model id, and the materialized
// resource directory. The System model keeps the historical default.
const backend = value('--backend') ?? 'system_default';
const modelId = value('--model-id');
const modelPath = value('--model-path');
const backendPayload = { backend, ...(modelId ? { modelId } : {}), ...(modelPath ? { modelPath } : {}) };
const expectedModelId = modelId ?? 'apple:foundation-models:system-default';
const fixtures = JSON.parse(await readFile(new URL('./fixtures/local-assist-evaluation.json', import.meta.url), 'utf8'));
// `request` feeds `additionalRequest`. An empty request exercises the
// action-template branch, which an all-fixtures-have-requests set never reached.
const fixtureCoverage = {
  withAdditionalRequest: fixtures.filter((f) => (f.request ?? '').trim().length > 0).length,
  withoutAdditionalRequest: fixtures.filter((f) => (f.request ?? '').trim().length === 0).length,
};
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  os: execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(),
  sdk: execFileSync('xcrun', ['--show-sdk-version'], { encoding: 'utf8' }).trim(),
  backend, modelId: expectedModelId, modelPath: modelPath ?? null,
  helperSha256: createHash('sha256').update(await readFile(helper)).digest('hex'), fixtureVersion: 2, repeats, results: [], qualityReview: 'pending human review; checks inspect raw helper text, before app sanitization',
  fixtureCoverage,
  note: 'Candidate text is from authored fixtures only. Token observations do not enforce a budget. Cold means a fresh helper whose model is not loaded yet; warm means the same helper reusing the loaded model, not a cleared OS cache.' };
let child, lines, pending;
function start() {
  child = spawn(resolve(helper), [], { stdio: ['pipe', 'pipe', 'ignore'] });
  lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    if (!pending) return;
    try {
      const envelope = JSON.parse(line);
      if (envelope.kind === 'candidate_partial') { pending.firstTokenMs ??= performance.now() - pending.started; pending.onPartial?.(); return; }
      const job = pending; pending = undefined; clearTimeout(job.timer);
      job.resolve({ envelope, elapsedMs: Math.round(performance.now() - job.started), firstTokenMs: job.firstTokenMs ?? null });
    } catch (error) { const job = pending; pending = undefined; clearTimeout(job.timer); job.reject(error); }
  });
  const fail = (error) => { if (pending) { const job = pending; pending = undefined; clearTimeout(job.timer); job.reject(error); } };
  child.once('error', fail);
  child.once('exit', (code) => fail(new Error(`helper exited: ${code}`)));
}
function request(payload, onPartial) {
  if (pending) throw new Error('Evaluation requests must remain serial');
  return new Promise((resolve, reject) => {
    pending = { resolve, reject, onPartial, started: performance.now(), timer: setTimeout(() => {
      pending = undefined; child.kill('SIGKILL'); reject(new Error('Evaluation timeout (360s)'));
    }, 360_000) };
    child.stdin.write(JSON.stringify(payload) + '\n');
  });
}
function record(fixture, result, cycle, phase) {
  const { envelope, elapsedMs, firstTokenMs } = result;
  const candidate = envelope.kind === 'candidate' ? envelope.value.candidateText : null;
  const modelId = envelope.value?.modelId ?? null;
  const rawCandidate = envelope.kind === 'candidate' ? envelope.value?.usage?.rawCandidateText ?? null : null;
  const checks = checkEvaluationCandidate(envelope, fixture.preserve, fixture, expectedModelId);
  report.results.push({ id: fixture.id, cycle, phase, elapsedMs, firstTokenMs, modelId,
    selectedCodePoints: [...fixture.selectedText].length, outputCodePoints: candidate == null ? null : [...candidate].length,
    rawCandidateText: rawCandidate,
    rawCodePoints: rawCandidate == null ? null : [...rawCandidate].length,
    usage: envelope.value?.usage ?? null, checks, errorKind: envelope.kind === 'error' ? envelope.value.kind : null,
    candidate, reviewCriteria: fixture.review });
  process.stdout.write(`${fixture.id} ${cycle}/${phase}: ${Object.values(checks).every(Boolean) ? 'checks passed' : 'review required'} (${elapsedMs} ms)\n`);
  return checks.completed && checks.liveModel && checks.withinFollowUpLimit ? candidate : null;
}
try {
  start();
  const probe = await request({ action: 'probe_availability' });
  report.availability = probe.envelope;
  if (probe.envelope.kind !== 'availability' || probe.envelope.value.kind !== 'available') throw new Error('Live model unavailable');
  for (let cycle = 1; cycle <= repeats; cycle++) {
    for (const [index, fixture] of fixtures.entries()) {
      const payload = { action: 'generate_candidate_streaming', ...backendPayload, operation: fixture.operation,
        actionId: fixture.actionId, selectedText: fixture.selectedText, additionalRequest: fixture.request, measureUsage: true };
      const result = await request(payload);
      const candidate = record(fixture, result, cycle, cycle === 1 && index === 0 ? 'cold' : 'warm');
      if (fixture.followUp && candidate) {
        record({ ...fixture, selectedText: candidate }, await request({ ...payload, selectedText: candidate,
          documentContext: `固定した元文章:\n${fixture.selectedText}\n直前の依頼:\n${fixture.request}`,
          additionalRequest: fixture.followUp }), cycle, 'follow-up');
      }
      await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    }
  }
  // Exercise the current hard-cancel model: kill only after a partial was observed,
  // await process termination, then start a fresh helper and require a completed draft.
  let sawPartial = false;
  const cancelled = await request({ action: 'generate_candidate_streaming', ...backendPayload,
    operation: 'rephrase', selectedText: fixtures[2].selectedText, additionalRequest: '文章を自然にしてください。' }, () => {
      sawPartial = true; child.kill('SIGKILL');
    }).then(() => false, () => true);
  report.cancelProbe = { sawPartial, terminated: cancelled && sawPartial, scope: 'direct helper kill, not native UI cancellation' };
  if (cancelled && sawPartial) {
    lines.close(); start();
    record(fixtures[0], await request({ action: 'generate_candidate_streaming', ...backendPayload,
      operation: fixtures[0].operation, selectedText: fixtures[0].selectedText,
      additionalRequest: fixtures[0].request, measureUsage: true }), repeats, 'after-cancel');
  }
  report.protocolPassed = report.cancelProbe.terminated && report.results.every((r) => r.checks.completed && r.checks.liveModel && r.checks.withinFollowUpLimit);
  if (!report.protocolPassed) process.exitCode = 1;
} catch (error) {
  report.failure = String(error); process.exitCode = 1;
} finally {
  lines?.close(); child?.kill('SIGKILL');
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
