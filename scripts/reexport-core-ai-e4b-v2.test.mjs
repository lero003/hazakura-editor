import assert from "node:assert/strict";
import { test } from "node:test";
import { buildE4BV2ReexportPlan, E4B_V2 } from "./reexport-core-ai-e4b-v2.mjs";

test("E4B v2 re-export pins source and tooling revisions", () => {
  const plan = buildE4BV2ReexportPlan("/tmp/hazakura-editor");
  assert.match(E4B_V2.sourceRevision, /^[0-9a-f]{40}$/);
  assert.match(E4B_V2.modelZooRevision, /^[0-9a-f]{40}$/);
  assert.match(E4B_V2.coreAiModelsRevision, /^[0-9a-f]{40}$/);
  assert.match(E4B_V2.sourceWeight.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(E4B_V2.toolVersions, {
    "coreai-core": "1.0.0b2",
    "coreai-torch": "0.4.1",
    "coreai-opt": "0.2.1",
    torch: "2.9.0",
  });
  assert.ok(plan.payloadRoot.includes("/reexports/gemma4-e4b-v2/"));
  assert.ok(plan.tableGenerator.endsWith("/scripts/generate-core-ai-e4b-v2-tables.py"));
});

test("E4B v2 re-export uses the QAT-aligned symmetric recipe offline", () => {
  const { arguments: arguments_ } = buildE4BV2ReexportPlan("/tmp/hazakura-editor");
  assert.ok(arguments_.includes("int4lin"));
  assert.ok(arguments_.includes("--lin-sym"));
  assert.ok(!arguments_.includes("--tbl"));
  assert.ok(!arguments_.includes("--raw-dir"));
  assert.ok(arguments_.includes("--local-files-only"));
  assert.equal(E4B_V2.tableFiles["meta.json"].size, 390);
  assert.equal(arguments_[arguments_.indexOf("--revision") + 1], E4B_V2.sourceRevision);
  assert.equal(arguments_[arguments_.indexOf("--hf-id") + 1], E4B_V2.sourceModel);
});
