/** Checks raw helper output only. Text quality and the app's sanitizer need separate review. */
export function checkEvaluationCandidate(
  envelope,
  preserve,
  fixture = {},
  expectedModelId = 'apple:foundation-models:system-default',
) {
  const candidate = envelope?.kind === 'candidate' ? envelope.value?.candidateText : null;
  const text = typeof candidate === 'string';
  return {
    completed: text && candidate.trim().length > 0,
    liveModel: envelope?.value?.modelId === expectedModelId,
    withinFollowUpLimit: text && [...candidate].length <= 4000,
    preserved: text && preserve.every((part) => candidate.includes(part)),
    proofreadProtectedSpans: text && (fixture.actionId !== 'proofread_only' || protectedSpansEqual(fixture.selectedText ?? '', candidate)),
    noInternalMarkers: text && !/HAZAKURA_(TEXT|CONTEXT|ORIGINAL)_(START|END)/.test(candidate),
  };
}

// Mechanical preservation checks, not a semantic-quality score. Authored
// fixture.preserve carries proper names and facts that must survive verbatim.
function protectedSpansEqual(original, candidate) {
  const patterns = [
    /\p{N}+(?:[.,]\p{N}+)*/gu,
    /https?:\/\/[^\s)<>]+/g,
    /^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm,
    /^~~~[^\n]*\n[\s\S]*?^~~~[ \t]*$/gm,
    /^>.*$/gm,
    /^\s*\|.*\|[ \t]*$/gm,
  ];
  return patterns.every(pattern => JSON.stringify(original.match(pattern) ?? []) === JSON.stringify(candidate.match(pattern) ?? []));
}
