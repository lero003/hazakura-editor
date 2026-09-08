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
