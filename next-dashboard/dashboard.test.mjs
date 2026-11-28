import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const core = require("./dashboard-core.cjs");

const DATA_PATH = path.join(__dirname, "dashboard-data.json");
const HTML_PATH = path.join(__dirname, "dashboard.html");
const CORE_PATH = path.join(__dirname, "dashboard-core.cjs");

const TARGET = "7e097768792192b463957a949a1aad9a5934bc20";
const OLD = "577f1b9b4e58155193264d7f3cd0f7426d3fc1e8";

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function check(name, workflowName, conclusion = "SUCCESS", status = "COMPLETED") {
  return {
    __typename: "CheckRun",
    name,
    workflowName,
    status,
    conclusion,
    detailsUrl: "https://github.com/lero003/hazakura-editor/actions/runs/1/job/2",
    startedAt: "2026-11-28T06:57:26Z",
    completedAt: status === "COMPLETED" ? "2026-11-28T06:59:20Z" : "0001-01-01T00:00:00Z",
  };
}

function run(workflowName, headSha, conclusion = "success", status = "completed", id = 1) {
  return {
    databaseId: id,
    workflowName,
    headSha,
    status,
    conclusion,
    createdAt: "2026-11-28T06:57:22Z",
    updatedAt: "2026-11-28T06:59:21Z",
    url: "https://github.com/lero003/hazakura-editor/actions/runs/1",
  };
}

function mechanicalFixture(options = {}) {
  return {
    git: {
      fetchStatus: options.gitFetchStatus || "ok",
      headSha: options.gitHead || TARGET,
      capturedAt: "2026-11-28T07:00:00Z",
    },
    github: {
      fetchStatus: options.githubFetchStatus || "ok",
      capturedAt: "2026-11-28T07:00:00Z",
      pr: {
        headRefOid: options.githubHead || TARGET,
        statusCheckRollup: options.checks || [],
      },
      recentRuns: options.runs || [],
    },
    nextCodebase: {
      available: options.sourceAvailable !== false,
      fetchStatus: "ok",
      headSha: options.sourceHead || TARGET,
      dirty: false,
      capturedAt: "2026-11-28T07:00:00Z",
      sourceFiles: 50,
      sourceLines: 100,
      testFiles: 2,
      testLines: 10,
      testAnnotations: 3,
    },
  };
}

function evaluationFixture() {
  return readData().evaluation;
}

/* ------------------------------------------------------------------ *
 * Schema / URL safety
 * ------------------------------------------------------------------ */

test("現行データはスキーマ検証を通り、スキーマ1.1.0として扱える", () => {
  const data = readData();
  const result = core.validateDashboardData(data);
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(data.meta.schemaVersion, "1.1.0");
  assert.equal(data.evaluation.evaluatedCommitSha, OLD);
  assert.equal(data.evaluation.evaluatedShortSha, "577f1b9b");
});

test("必須構造の欠落・不正なschemaVersion・危険なrepoUrlを拒否する", () => {
  const missingMeta = readData();
  delete missingMeta.meta;
  assert.equal(core.validateDashboardData(missingMeta).ok, false);

  const badSchema = readData();
  badSchema.meta.schemaVersion = "2.0.0";
  assert.equal(core.validateDashboardData(badSchema).ok, false);

  const badRepo = readData();
  badRepo.meta.repoUrl = "http://github.com/lero003/hazakura-editor";
  assert.equal(core.validateDashboardData(badRepo).ok, false);

  const jsRepo = readData();
  jsRepo.meta.repoUrl = "javascript:alert(1)";
  assert.equal(core.validateDashboardData(jsRepo).ok, false);
});

test("不正な証拠URLは描画せず警告にし、安全な相対パスだけを許可する", () => {
  const badEvidence = readData();
  badEvidence.evaluation.featureComparison[0].evidence = [{ label: "bad", path: "javascript:alert(1)" }];
  const result = core.validateDashboardData(badEvidence);
  assert.equal(result.ok, true, "証拠URLの不正はデータ全体を拒否せず、リンクだけを無効化する");
  assert.ok(result.warnings.some((w) => w.path.includes("featureComparison[0].evidence")));

  const badRef = readData();
  badRef.evaluation.remainingIssues[0].relatedRefs = ["../../etc/passwd"];
  const refResult = core.validateDashboardData(badRef);
  assert.equal(refResult.ok, true);
  assert.ok(refResult.warnings.some((w) => w.path.includes("remainingIssues[0].relatedRefs")));
});

test("https以外・資格情報付き・危険な相対パスはURLにしない", () => {
  assert.equal(core.sanitizeHttpsUrl("javascript:alert(1)"), null);
  assert.equal(core.sanitizeHttpsUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(core.sanitizeHttpsUrl("http://github.com/lero003/hazakura-editor"), null);
  assert.equal(core.sanitizeHttpsUrl("https://user:pass@github.com/lero003/hazakura-editor"), null);
  assert.equal(core.sanitizeHttpsUrl("https://github.com:8080/lero003/hazakura-editor"), null);
  assert.ok(core.sanitizeHttpsUrl("https://github.com/lero003/hazakura-editor"));
  assert.equal(core.sanitizeGithubRepoUrl("https://example.com/lero003/hazakura-editor"), null);

  const repo = "https://github.com/lero003/hazakura-editor";
  assert.equal(
    core.buildEvidenceUrl(repo, OLD, "next/Sources/HazakuraNext/BookPreviewView.swift#L12"),
    "https://github.com/lero003/hazakura-editor/blob/" + OLD + "/next/Sources/HazakuraNext/BookPreviewView.swift#L12"
  );
  assert.equal(core.buildEvidenceUrl(repo, OLD, "../secret"), null);
  assert.equal(core.buildEvidenceUrl(repo, OLD, "/etc/passwd"), null);
  assert.equal(core.buildEvidenceUrl(repo, OLD, "next/%2e%2e/secret"), null);
  assert.equal(core.buildEvidenceUrl(repo, OLD, "next\\secret"), null);
  assert.equal(
    core.buildEvidenceUrl(repo, OLD, "docs/roadmap.md#メモと縦書き"),
    "https://github.com/lero003/hazakura-editor/blob/" + OLD + "/docs/roadmap.md#%E3%83%A1%E3%83%A2%E3%81%A8%E7%B8%A6%E6%9B%B8%E3%81%8D"
  );
});

/* ------------------------------------------------------------------ *
 * Progress / acceptance / formulas
 * ------------------------------------------------------------------ */

test("カタログ数・対象内・対象外・将来検討・状態内訳を保存データから算出する", () => {
  const data = readData();
  const progress = core.computeProgress(data.evaluation);
  const items = data.evaluation.featureComparison;
  const inScope = items.filter((item) => item.implementationStatus !== "保留・対象外");

  assert.equal(progress.totalCatalogItems, items.length);
  assert.equal(progress.totalCatalogItems, 36);
  assert.equal(progress.inScopeItems, inScope.length);
  assert.equal(progress.inScopeItems, 35);
  assert.equal(progress.outOfScopeItems, 1);
  assert.equal(progress.futureConsiderationItems, 6);
  assert.equal(progress.statusBreakdown["実装済み"], 8);
  assert.equal(progress.statusBreakdown["試作実装"], 14);
  assert.equal(progress.statusBreakdown["部分実装"], 4);
  assert.equal(progress.statusBreakdown["未着手"], 9);
  assert.equal(progress.statusBreakdown["保留・対象外"], 1);
  assert.equal(progress.acceptance.totalItems, 24);
  assert.equal(progress.acceptance.passed, 0);
  assert.equal(progress.acceptance.unmeasured, 24);
});

test("計算式の説明が実データの36/35/1/6/24と一致し、旧い34/21を含まない", () => {
  const data = readData();
  const progress = core.computeProgress(data.evaluation);
  const formula = core.buildFormulaExplanation(data.evaluation, progress);
  assert.match(formula, /36 項目/);
  assert.match(formula, /35 項目を分母/);
  assert.match(formula, /「保留・対象外」1 件/);
  assert.match(formula, /「保留（将来検討）」6 件/);
  assert.match(formula, /24 項目/);
  assert.doesNotMatch(formula, /34項目/);
  assert.doesNotMatch(formula, /21項目/);
  assert.equal(data.evaluation.scoringRules.formulaExplanation, formula);
});

test("実機受け入れは明細から合格・未測定・不合格・対象外を再集計する", () => {
  const evaluation = evaluationFixture();
  const before = core.computeAcceptance(evaluation);
  assert.equal(before.totalItems, 24);
  assert.equal(before.passed, 0);
  assert.equal(before.unmeasured, 24);
  assert.equal(before.outOfScope, 0);
  assert.equal(before.providedMatches, true);

  const accepted = clone(evaluation);
  accepted.acceptanceAndPerformance.acceptanceRows[0].g2Result = "合格";
  const afterPass = core.computeAcceptance(accepted);
  assert.equal(afterPass.passed, 1);
  assert.equal(afterPass.unmeasured, 23);
  assert.equal(afterPass.providedMatches, false, "静的なacceptanceSummaryと明細がずれたことを検出する");

  const failed = clone(evaluation);
  failed.acceptanceAndPerformance.acceptanceRows[0].g2Result = "不合格";
  failed.acceptanceAndPerformance.acceptanceRows[1].g2Result = "対象外（第二世代専用）";
  const afterFail = core.computeAcceptance(failed);
  assert.equal(afterFail.failed, 1);
  assert.equal(afterFail.outOfScope, 1);
  assert.equal(afterFail.unmeasured, 22);
});

/* ------------------------------------------------------------------ *
 * CI status
 * ------------------------------------------------------------------ */

test("最新HEADの全ワークフロー成功はsuccess、旧HEADの成功はcurrentに数えない", () => {
  const meta = { generatedAt: "2026-11-28T07:00:00Z" };
  const mechanical = mechanicalFixture({
    checks: [
      check("swift", "Next Native"),
      check("frontend", "Quality"),
      check("native", "Quality"),
    ],
    runs: [
      run("Next Native", OLD, "success", "completed", 10),
      run("Quality", OLD, "success", "completed", 11),
    ],
  });
  const ci = core.resolveCiStatus(mechanical, meta);
  assert.equal(ci.state, "success");
  assert.equal(ci.label, "最新HEAD 全成功");
  assert.equal(ci.targetShortSha, "7e097768");
  assert.equal(ci.successWorkflows.length, 2);
  assert.ok(ci.oldHeadSuccessCount > 0);
  assert.equal(ci.missingWorkflows.length, 0);
});

test("最新HEADの失敗・実行中をsuccessと区別する", () => {
  const meta = { generatedAt: "2026-11-28T07:00:00Z" };
  const failure = core.resolveCiStatus(mechanicalFixture({
    checks: [check("swift", "Next Native", "FAILURE"), check("frontend", "Quality")],
  }), meta);
  assert.equal(failure.state, "failure");
  assert.match(failure.reason, /失敗/);

  const running = core.resolveCiStatus(mechanicalFixture({
    checks: [check("swift", "Next Native", "", "IN_PROGRESS"), check("frontend", "Quality")],
  }), meta);
  assert.equal(running.state, "running");
  assert.match(running.reason, /実行中/);
});

test("旧HEADの成功しかない場合はstale、一部だけ最新HEADならpartialにする", () => {
  const meta = { generatedAt: "2026-11-28T07:00:00Z" };
  const stale = core.resolveCiStatus(mechanicalFixture({
    checks: [],
    runs: [
      run("Next Native", OLD, "success", "completed", 10),
      run("Quality", OLD, "success", "completed", 11),
    ],
  }), meta);
  assert.equal(stale.state, "stale");
  assert.equal(stale.successWorkflows.length, 0);
  assert.equal(stale.oldHeadSuccessCount, 2);
  assert.equal(stale.workflows.every((wf) => wf.state === "old-head"), true);

  const partial = core.resolveCiStatus(mechanicalFixture({
    checks: [check("swift", "Next Native")],
    runs: [
      run("Next Native", TARGET, "success", "completed", 12),
      run("Quality", OLD, "success", "completed", 11),
    ],
  }), meta);
  assert.equal(partial.state, "partial");
  assert.equal(partial.successWorkflows.length, 1);
  assert.equal(partial.missingWorkflows.length, 1);
  assert.match(partial.reason, /Quality/);
});

test("GitHub取得失敗・skipはunavailableとして、成功に丸めない", () => {
  const meta = { generatedAt: "2026-11-28T07:00:00Z" };
  const failed = core.resolveCiStatus(mechanicalFixture({
    githubFetchStatus: "failed",
    runs: [run("Next Native", OLD, "success", "completed", 10)],
  }), meta);
  assert.equal(failed.state, "unavailable");
  assert.equal(failed.targetShortSha, "7e097768");
  assert.match(failed.reason, /取得に失敗/);

  const skipped = core.resolveCiStatus(mechanicalFixture({ githubFetchStatus: "skipped" }), meta);
  assert.equal(skipped.state, "unavailable");
  assert.match(skipped.reason, /skip-github/);
});

/* ------------------------------------------------------------------ *
 * Provenance
 * ------------------------------------------------------------------ */

test("Git・GitHub・ソース・評価の対象SHAを比較し、評価のHEAD移動を区別する", () => {
  const data = readData();
  const provenance = core.buildProvenance(data.mechanical, data.evaluation, data.meta);
  assert.equal(provenance.targetSha, TARGET);
  assert.equal(provenance.matches.githubVsGit, true);
  assert.equal(provenance.matches.sourceVsTarget, true);
  assert.equal(provenance.matches.evaluationVsTarget, false);
  assert.equal(provenance.evaluation.headMoved, true);
  assert.equal(provenance.evaluation.impact, "dashboard_only");
  assert.equal(provenance.status, "dashboard-only");
  assert.ok(provenance.warnings.some((w) => w.code === "evaluation_head_moved"));
});

test("評価対象SHAが最新HEADと一致すればconsistent、ソース不一致ならmismatch", () => {
  const evaluation = evaluationFixture();
  evaluation.evaluatedCommitSha = TARGET;
  evaluation.evaluatedShortSha = "7e097768";
  evaluation.isStaleRelativeToHead = false;
  const consistent = core.buildProvenance(mechanicalFixture(), evaluation, { generatedAt: "2026-11-28T07:00:00Z" });
  assert.equal(consistent.matches.evaluationVsTarget, true);
  assert.equal(consistent.evaluation.headMoved, false);
  assert.equal(consistent.status, "consistent");

  const sourceMismatch = core.buildProvenance(
    mechanicalFixture({ sourceHead: OLD }),
    evaluation,
    { generatedAt: "2026-11-28T07:00:00Z" }
  );
  assert.equal(sourceMismatch.matches.sourceVsTarget, false);
  assert.equal(sourceMismatch.status, "mismatch");
  assert.ok(sourceMismatch.warnings.some((w) => w.code === "source_head_mismatch"));
});

test("GitHub取得不能はprovenanceをunavailableにし、git HEADへフォールバックする", () => {
  const githubFailed = mechanicalFixture({
    githubFetchStatus: "failed",
    gitHead: TARGET,
  });
  const evaluation = evaluationFixture();
  evaluation.evaluatedCommitSha = TARGET;
  const provenance = core.buildProvenance(githubFailed, evaluation, { generatedAt: "2026-11-28T07:00:00Z" });
  assert.equal(provenance.targetSha, TARGET);
  assert.equal(provenance.githubHead, null);
  assert.equal(provenance.status, "unavailable");
  assert.ok(provenance.warnings.some((w) => w.code === "github_fetch_failed"));
});

/* ------------------------------------------------------------------ *
 * Diff / regression fixtures
 * ------------------------------------------------------------------ */

test("機能追加を進捗と差分に反映する", () => {
  const previous = readData();
  const current = clone(previous);
  current.evaluation.featureComparison.push({
    name: "回帰テスト用の新機能",
    category: "テスト",
    disposition: "再設計",
    implementationStatus: "未着手",
    verificationStatus: "未実施",
    deviceAcceptanceStatus: "未着手",
    g1Status: "なし",
    missingParts: "未実装",
    evidence: [],
  });
  const progress = core.computeProgress(current.evaluation);
  assert.equal(progress.totalCatalogItems, 37);
  assert.equal(progress.inScopeItems, 36);
  const diff = core.diffSnapshots(previous, current);
  assert.equal(diff.features.added.length, 1);
  assert.equal(diff.features.added[0].name, "回帰テスト用の新機能");
  assert.equal(diff.progress.totalCatalogItems.delta, 1);
  assert.equal(diff.progress.inScopeItems.delta, 1);
  assert.equal(diff.hasChanges, true);
});

test("実機合格への変化を差分に反映する", () => {
  const previous = readData();
  const current = clone(previous);
  current.evaluation.acceptanceAndPerformance.acceptanceRows[0].g2Result = "合格";
  const diff = core.diffSnapshots(previous, current);
  assert.equal(diff.acceptance.changed.length, 1);
  assert.equal(diff.acceptance.changed[0].fromStatus, "未測定");
  assert.equal(diff.acceptance.changed[0].toStatus, "実機受け入れ済み");
  assert.equal(diff.progress.acceptancePassed.delta, 1);
  assert.equal(diff.progress.acceptanceUnmeasured.delta, -1);
});

test("CI失敗・HEAD変更を差分に反映する", () => {
  const previous = readData();
  const current = clone(previous);
  current.mechanical.github.pr.statusCheckRollup = [
    check("swift", "Next Native", "FAILURE"),
    check("frontend", "Quality", "FAILURE"),
    check("native", "Quality", "FAILURE"),
  ];
  current.mechanical.github.pr.headRefOid = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  current.mechanical.git.headSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  current.meta.dataTarget = { sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", shortSha: "aaaaaaaa", source: "GitHub PR headRefOid", capturedAt: "2026-11-28T07:00:00Z" };
  const diff = core.diffSnapshots(previous, current);
  assert.equal(diff.ci.fromState, "success");
  assert.equal(diff.ci.toState, "failure");
  assert.equal(diff.ci.changed, true);
  assert.equal(diff.head.changed, true);
  assert.equal(diff.hasChanges, true);
});

test("課題追加・属性変更を差分に反映する", () => {
  const previous = readData();
  const current = clone(previous);
  current.evaluation.remainingIssues.push({
    id: "issue-regression",
    priority: "P2",
    origin: "newly_identified",
    title: "回帰テスト用の課題",
    summary: "追加",
    whyRemaining: "テスト",
    doneCriteria: "テスト",
    dependencies: [],
    relatedRefs: [],
    ownerType: "agent",
    parallelizable: true,
    recommendedOrder: 10,
  });
  const diff = core.diffSnapshots(previous, current);
  assert.equal(diff.issues.added.length, 1);
  assert.equal(diff.issues.added[0].title, "回帰テスト用の課題");
});

test("前回データとの比較は同一データで差分なしになる", () => {
  const data = readData();
  const diff = core.diffSnapshots(data, data);
  assert.equal(diff.available, true);
  assert.equal(diff.hasChanges, false);
  assert.equal(diff.counts.total, 0);
});

/* ------------------------------------------------------------------ *
 * Owner work / issues
 * ------------------------------------------------------------------ */

test("オーナー作業とエージェント実施可能作業を分け、推定であることを明示する", () => {
  const evaluation = evaluationFixture();
  const summary = core.summarizeOwnerWork(evaluation);
  assert.ok(summary.counts.owner_device > 0);
  assert.ok(summary.counts.agent + summary.counts.both > 0);
  assert.match(summary.estimateNote, /エージェントの推定/);
  assert.ok(summary.ownerTasks.every((issue) => issue.ownerType === "owner_device"));
  assert.ok(summary.agentTasks.every((issue) => issue.ownerType === "agent" || issue.ownerType === "both"));

  const actions = core.summarizeNextActions(evaluation, 3);
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.estimate === true));
  assert.ok(actions.every((action) => action.ownerLabel.length > 0));
});

test("受入結果の文字列は合格・不合格・未測定・対象外を混同しない", () => {
  assert.equal(core.classifyResultStatus("未測定（手順ひな形未記入）"), "未測定");
  assert.equal(core.classifyResultStatus("合格"), "実機受け入れ済み");
  assert.equal(core.classifyResultStatus("不合格"), "不合格");
  assert.equal(core.classifyResultStatus("対象外（第二世代専用）"), "対象外");
  assert.equal(core.classifyResultStatus(""), "不明・未確認");
});

test("ソース集計が取得不能ならテスト数を0に丸めない", () => {
  const summary = core.computeTestSummary({ available: false, note: "next/ が見つかりません" });
  assert.equal(summary.available, false);
  assert.equal(summary.testAnnotations, null);
  assert.match(summary.reason, /next/);
});

/* ------------------------------------------------------------------ *
 * HTML sync / no hardcoded display counts
 * ------------------------------------------------------------------ */

test("dashboard.html の埋め込みコアは dashboard-core.cjs と同期している", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const coreSource = fs.readFileSync(CORE_PATH, "utf8").trim();
  const match = html.match(/<!-- DASHBOARD_CORE_START -->\n<script id="dashboard-core">\n([\s\S]*?)\n<\/script>\n<!-- DASHBOARD_CORE_END -->/);
  assert.ok(match, "DASHBOARD_COREマーカーとscript要素が必要");
  assert.equal(match[1].trim(), coreSource);
});

test("dashboard.html の埋め込みJSONは dashboard-data.json と一致する", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const match = html.match(/<!-- DASHBOARD_DATA_START -->\n<script id="dashboard-data" type="application\/json">\n([\s\S]*?)\n<\/script>\n<!-- DASHBOARD_DATA_END -->/);
  assert.ok(match, "DASHBOARD_DATAマーカーとscript要素が必要");
  assert.deepEqual(JSON.parse(match[1]), readData());
});

test("表示スクリプトにテスト数・実機合格数・状態内訳のハードコードが残っていない", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const dataEnd = html.indexOf("<!-- DASHBOARD_DATA_END -->");
  assert.ok(dataEnd > 0);
  const renderScript = html.slice(dataEnd);
  const forbidden = [
    /549\s*件/,
    /9735/,
    /14089/,
    /3175/,
    /実装済み\s*8/,
    /試作\s*14/,
    /部分\s*4/,
    /未着手\s*9/,
    /全24/,
    /\|\|\s*549\b/,
    /\|\|\s*24\b/,
    /\|\|\s*9735\b/,
    /\|\|\s*14089\b/,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderScript, pattern, "ハードコードされた表示値: " + pattern);
  }
});

test("狭幅・キーボード向けの基本マークアップとフォーカス指定がある", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /overflow-x: hidden/);
  assert.match(html, /\.file-load-btn input \{/);
  assert.doesNotMatch(html, /\.file-load-btn input \{ display: none; \}/);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:\s|>)/, "詳細は初期状態で閉じる");
});
