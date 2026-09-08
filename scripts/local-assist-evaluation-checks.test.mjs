import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEvaluationCandidate as check } from './local-assist-evaluation-checks.mjs';
const complete = (candidateText, modelId = 'apple:foundation-models:system-default') => ({ kind: 'candidate', value: { candidateText, modelId } });
test('protocol errors and partial text cannot prove completed generation', () => {
  assert.equal(check({ kind: 'error', value: { kind: 'unavailable' } }, []).completed, false);
  assert.equal(check({ kind: 'candidate_partial', value: { candidateText: 'partial' } }, []).completed, false);
  assert.equal(check(complete('  '), []).completed, false);
});
test('fixture output is never live-model evidence', () => {
  assert.equal(check(complete('candidate', 'fixture:helper-v0.12'), []).liveModel, false);
  assert.equal(check({ kind: 'candidate', value: { candidateText: 'candidate' } }, []).liveModel, false);
});
test('counts code points and flags omitted facts and raw marker leaks separately', () => {
  assert.equal(check(complete('🌸'.repeat(4000)), ['🌸']).withinFollowUpLimit, true);
  assert.equal(check(complete('🌸'.repeat(4001)), []).withinFollowUpLimit, false);
  const result = check(complete('<<<HAZAKURA_TEXT_START\n午前10時\nHAZAKURA_TEXT_END>>>'), ['1200円']);
  assert.equal(result.completed, true);
  assert.equal(result.preserved, false);
  assert.equal(result.noInternalMarkers, false);
});
test('proofreading flags numbers, links, quotes, tables and fenced-code changes even after generation completes', () => {
  const source = '> 引用 1200円\n\n[案内](https://example.com)\n\n| 数 |\n|---|\n| 3 |\n\n```js\nconst x = 3;\n```';
  const fixture = { selectedText: source, actionId: 'proofread_only' };
  assert.equal(check(complete(source), [], fixture).proofreadProtectedSpans, true);
  for (const changed of [source.replace('1200', '1300'), source.replace('https://example.com', 'https://example.net'), source.replace('> 引用', '引用'), source.replace('| 3 |', '3'), source.replace('const x', 'let x')]) {
    assert.equal(check(complete(changed), [], fixture).completed, true);
    assert.equal(check(complete(changed), [], fixture).proofreadProtectedSpans, false);
  }
});
