/** Checks raw helper output only. Text quality and the app's sanitizer need separate review. */
export function checkEvaluationCandidate(envelope, preserve) {
  const candidate = envelope?.kind === 'candidate' ? envelope.value?.candidateText : null;
  const text = typeof candidate === 'string';
  return {
    completed: text && candidate.trim().length > 0,
    liveModel: envelope?.value?.modelId === 'apple:foundation-models:system-default',
    withinFollowUpLimit: text && [...candidate].length <= 4000,
    preserved: text && preserve.every((part) => candidate.includes(part)),
    noInternalMarkers: text && !/HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_(START|END)/.test(candidate),
  };
}
