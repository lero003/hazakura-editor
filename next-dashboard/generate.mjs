#!/usr/bin/env node
/**
 * Hazakura Editor 第二世代 (PR #71 / next-native-editor) ダッシュボード再生成スクリプト
 *
 * 役割:
 * 1. Git / GitHub CLI (`gh`) / `next/` ソースから機械取得可能な統計・CI・コミット履歴を取得する
 *    (取得失敗時は推定で埋めず、fetchStatus: "failed" / "不明" を明示する)。
 * 2. 表示用の導出値 (CI状態、SHA来歴、進捗、受入集計、計算式) を dashboard-core.cjs で再計算する。
 * 3. 評価層 (evaluation) の対象SHA・評価日時を保持し、最新HEADとの差分が
 *    next/ の製品コード変更を含むか、ダッシュボード・文書・CIのみかを区別して記録する。
 * 4. `dashboard-data.json` と `dashboard.html` 内の埋め込みJSON・共通ロジックを同期する。
 *
 * 依存: Node.js 標準モジュールのみ (外部パッケージ不要)
 * 実行: node next-dashboard/generate.mjs [--skip-github]
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const core = require("./dashboard-core.cjs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const FALLBACK_NEXT_WORKTREE = path.join(
  REPO_ROOT,
  ".agents/worktrees/second-generation-design/.agents/worktrees/next-native-editor"
);
const NEXT_WORKTREE = fs.existsSync(path.join(REPO_ROOT, "next"))
  ? REPO_ROOT
  : FALLBACK_NEXT_WORKTREE;
const DATA_PATH = path.join(__dirname, "dashboard-data.json");
const HTML_PATH = path.join(__dirname, "dashboard.html");
const CORE_PATH = path.join(__dirname, "dashboard-core.cjs");

const SKIP_GITHUB = process.argv.includes("--skip-github");
const DATA_START_MARKER = "<!-- DASHBOARD_DATA_START -->";
const DATA_END_MARKER = "<!-- DASHBOARD_DATA_END -->";
const CORE_START_MARKER = "<!-- DASHBOARD_CORE_START -->";
const CORE_END_MARKER = "<!-- DASHBOARD_CORE_END -->";

function runCommand(cmd, args, cwd = REPO_ROOT) {
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20000,
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message ? String(error.message).split("\n")[0] : "command failed",
      stdout: "",
    };
  }
}

function countNextMetrics(worktreeRoot) {
  const nextDir = path.join(worktreeRoot, "next");
  if (!fs.existsSync(nextDir)) {
    return { available: false, reason: "next-native-editor worktree が見つかりません" };
  }

  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".build" || entry.name === ".DS_Store") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.isFile()) out.push(full);
    }
    return out;
  };

  const modules = [
    "Sources/HazakuraNext",
    "Sources/HazakuraNextCore",
    "Sources/HazakuraNextEditor",
    "Sources/HazakuraNextLayoutProbe",
    "Sources/HazakuraNextModelProbe",
    "Tests/HazakuraNextTests",
    "Tests/HazakuraNextCoreTests",
    "Tests/HazakuraNextEditorTests",
    "Tests/HazakuraNextLayoutProbeTests",
    "Tests/HazakuraNextModelProbeTests",
    "scripts",
    "Resources",
  ];

  const moduleStats = [];
  let sourceFiles = 0;
  let sourceLines = 0;
  let testFiles = 0;
  let testLines = 0;
  let testAnnotations = 0;
  let suiteAnnotations = 0;

  for (const mod of modules) {
    const modDir = path.join(nextDir, mod);
    if (!fs.existsSync(modDir)) continue;
    const files = walk(modDir);
    let lines = 0;
    let tests = 0;
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const lineCount = content === "" ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
      lines += lineCount;
      const matches = content.match(/@Test\b/g);
      if (matches) tests += matches.length;
    }
    moduleStats.push({ module: mod, files: files.length, lines, tests });
    if (mod.startsWith("Sources/")) {
      sourceFiles += files.length;
      sourceLines += lines;
    } else if (mod.startsWith("Tests/")) {
      testFiles += files.length;
      testLines += lines;
      testAnnotations += tests;
    }
  }

  for (const file of walk(nextDir)) {
    if (!file.endsWith(".swift")) continue;
    const content = fs.readFileSync(file, "utf8");
    const suites = content.match(/@Suite\b/g);
    if (suites) suiteAnnotations += suites.length;
  }

  const headRes = runCommand("git", ["rev-parse", "HEAD"], worktreeRoot);
  const dirtyRes = runCommand("git", ["status", "--porcelain", "--", "next/"], worktreeRoot);
  const dirtyPaths = dirtyRes.ok && dirtyRes.stdout ? dirtyRes.stdout.split("\n").filter(Boolean) : [];

  return {
    available: true,
    fetchStatus: "ok",
    targetPath: "next/",
    headSha: headRes.ok ? headRes.stdout : null,
    headShortSha: headRes.ok ? headRes.stdout.slice(0, 8) : null,
    dirty: dirtyPaths.length > 0,
    dirtyFileCount: dirtyPaths.length,
    capturedAt: new Date().toISOString(),
    sourceFiles,
    sourceLines,
    testFiles,
    testLines,
    testAnnotations,
    suiteAnnotations,
    modules: moduleStats,
  };
}

function classifyCommit(subject) {
  if (/設計方針|再構築へ切り替え|受け入れ|比較に使う|記録ひな形/.test(subject)) return "設計・受け入れ";
  if (/推論|プローブ|LayoutProbe|計測|走査を短縮|高速化|共通化/.test(subject)) return "性能・推論検証";
  if (/未確定入力|変換|Undo|Redo|破棄|復旧|退避|原本|UTF-16|BOM|URL|サンドボックス|署名|中止|拒否|照合/.test(subject)) {
    return "安全性・境界強化";
  }
  if (/CI|直列化|試験を追加|試験する/.test(subject)) return "CI・自動テスト";
  return "機能実装";
}

function collectGitData() {
  const capturedAt = new Date().toISOString();
  const baseShaRes = runCommand("git", ["rev-parse", "origin/main"]);
  const headShaRes = runCommand("git", ["rev-parse", "origin/next-native-editor"]);
  const localHeadRes = runCommand("git", ["rev-parse", "HEAD"]);
  if (!baseShaRes.ok || !headShaRes.ok) {
    return { fetchStatus: "failed", capturedAt, error: "git ref origin/main または origin/next-native-editor を解決できません" };
  }
  const baseSha = baseShaRes.stdout;
  const headSha = headShaRes.stdout;

  const logRes = runCommand("git", [
    "log",
    "--reverse",
    "--format=%H|%h|%ai|%s",
    `${baseSha}..${headSha}`,
  ]);

  const commits = logRes.ok && logRes.stdout
    ? logRes.stdout.split("\n").map((line) => {
        const [sha, shortSha, date, ...msgParts] = line.split("|");
        const subject = msgParts.join("|");
        return {
          sha,
          shortSha,
          date,
          category: classifyCommit(subject),
          subject,
        };
      })
    : [];

  const diffAllRes = runCommand("git", ["diff", "--shortstat", `${baseSha}...${headSha}`]);
  const diffNextRes = runCommand("git", ["diff", "--shortstat", `${baseSha}...${headSha}`, "--", "next/"]);
  const diffDocsRes = runCommand("git", ["diff", "--shortstat", `${baseSha}...${headSha}`, "--", ":!next/"]);
  const g1CodeDiffRes = runCommand("git", [
    "diff",
    "--name-only",
    `${baseSha}...${headSha}`,
    "--",
    "src/",
    "src-tauri/",
    "src-helpers/",
    "package.json",
  ]);

  return {
    fetchStatus: "ok",
    capturedAt,
    baseSha,
    baseShortSha: baseSha.slice(0, 8),
    headSha,
    headShortSha: headSha.slice(0, 8),
    localHeadSha: localHeadRes.ok ? localHeadRes.stdout : null,
    localHeadMatchesRemote: localHeadRes.ok ? localHeadRes.stdout === headSha : null,
    commitCount: commits.length,
    commits,
    shortstatAll: diffAllRes.ok ? diffAllRes.stdout : "不明",
    shortstatNext: diffNextRes.ok ? diffNextRes.stdout : "不明",
    shortstatNonNext: diffDocsRes.ok ? diffDocsRes.stdout : "不明",
    g1ProductFilesChanged: g1CodeDiffRes.ok
      ? g1CodeDiffRes.stdout.split("\n").filter(Boolean).length
      : null,
  };
}

function collectGitHubData() {
  if (SKIP_GITHUB) {
    return {
      fetchStatus: "skipped",
      capturedAt: new Date().toISOString(),
      note: "--skip-github 指定により GitHub API 取得を省略",
    };
  }
  const capturedAt = new Date().toISOString();
  const prRes = runCommand("gh", [
    "pr",
    "view",
    "71",
    "--json",
    "number,title,state,url,headRefName,baseRefName,headRefOid,additions,deletions,changedFiles,createdAt,updatedAt,body,statusCheckRollup",
  ]);
  const reviewsRes = runCommand("gh", ["api", "repos/lero003/hazakura-editor/pulls/71/reviews"]);
  const runsRes = runCommand("gh", [
    "run",
    "list",
    "--branch",
    "next-native-editor",
    "--limit",
    "15",
    "--json",
    "databaseId,workflowName,headSha,status,conclusion,createdAt,updatedAt,url,event",
  ]);

  if (!prRes.ok) {
    return {
      fetchStatus: "failed",
      capturedAt,
      error: prRes.error || "gh pr view 71 failed",
      runsFetchStatus: runsRes.ok ? "ok" : "failed",
      reviewsFetchStatus: reviewsRes.ok ? "ok" : "failed",
    };
  }

  try {
    const pr = JSON.parse(prRes.stdout);
    const reviews = reviewsRes.ok ? JSON.parse(reviewsRes.stdout) : null;
    const runs = runsRes.ok ? JSON.parse(runsRes.stdout) : null;
    return {
      fetchStatus: "ok",
      capturedAt,
      reviewsFetchStatus: reviewsRes.ok ? "ok" : "failed",
      runsFetchStatus: runsRes.ok ? "ok" : "failed",
      pr: {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.url,
        baseRefName: pr.baseRefName,
        headRefName: pr.headRefName,
        headRefOid: pr.headRefOid,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        body: pr.body,
        statusCheckRollup: pr.statusCheckRollup || [],
      },
      reviewsCount: Array.isArray(reviews) ? reviews.length : null,
      recentRuns: Array.isArray(runs) ? runs : [],
    };
  } catch (err) {
    return {
      fetchStatus: "failed",
      capturedAt,
      error: `GitHub JSON parse failed: ${err.message}`,
      runsFetchStatus: runsRes.ok ? "ok" : "failed",
      reviewsFetchStatus: reviewsRes.ok ? "ok" : "failed",
    };
  }
}

function resolveEvaluationDelta(evaluationSha, currentHead) {
  if (!evaluationSha || !currentHead) {
    return {
      headMoved: false,
      impact: "unknown",
      nonDashboardChangesSinceEvaluation: null,
      changedFilesSinceEvaluation: null,
      error: "評価対象SHAまたは最新HEADを特定できません",
    };
  }
  if (evaluationSha === currentHead) {
    return {
      headMoved: false,
      impact: "current",
      nonDashboardChangesSinceEvaluation: 0,
      productFilesChangedSinceEvaluation: 0,
      supportingFilesChangedSinceEvaluation: 0,
      changedFilesSinceEvaluation: [],
      error: null,
    };
  }
  const diffRes = runCommand("git", [
    "diff",
    "--name-only",
    `${evaluationSha}..${currentHead}`,
    "--",
    ":!next-dashboard/",
  ]);
  if (!diffRes.ok) {
    return {
      headMoved: true,
      impact: "unknown",
      nonDashboardChangesSinceEvaluation: null,
      changedFilesSinceEvaluation: null,
      error: "評価対象SHAからの差分を取得できません",
    };
  }
  const files = diffRes.stdout.split("\n").filter(Boolean);
  const productFiles = files.filter((file) => file.startsWith("next/"));
  const supportingFiles = files.filter((file) => !file.startsWith("next/") && !file.startsWith("next-dashboard/"));
  return {
    headMoved: true,
    // 定性評価は next/ の製品コードを対象とする。ダッシュボード・文書・CIのみの
    // 変更は「製品コード変更なし」として code_changed と区別する。
    impact: productFiles.length > 0 ? "code_changed" : "dashboard_only",
    nonDashboardChangesSinceEvaluation: files.length,
    productFilesChangedSinceEvaluation: productFiles.length,
    supportingFilesChangedSinceEvaluation: supportingFiles.length,
    changedFilesSinceEvaluation: files,
    error: null,
  };
}

function replaceMarkedBlock(html, startMarker, endMarker, replacement, label) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`dashboard.html 内に ${label} マーカーが見つかりません。`);
  }
  return html.slice(0, startIdx) + replacement + html.slice(endIdx + endMarker.length);
}

function syncHtml(data) {
  if (!fs.existsSync(HTML_PATH)) {
    console.log("dashboard.html はまだ存在しないため同期をスキップしました。");
    return;
  }
  let html = fs.readFileSync(HTML_PATH, "utf8");
  const coreSource = fs.readFileSync(CORE_PATH, "utf8").trim();
  if (coreSource.includes(CORE_END_MARKER) || coreSource.includes(CORE_START_MARKER)) {
    throw new Error("dashboard-core.cjs に同期マーカーが含まれています。");
  }
  const coreReplacement = `${CORE_START_MARKER}\n<script id="dashboard-core">\n${coreSource}\n</script>\n${CORE_END_MARKER}`;
  html = replaceMarkedBlock(html, CORE_START_MARKER, CORE_END_MARKER, coreReplacement, "DASHBOARD_CORE");

  // </script> を含む文字列がHTMLパーサを壊さないようエスケープする
  const safeJson = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
  const dataReplacement = `${DATA_START_MARKER}\n<script id="dashboard-data" type="application/json">\n${safeJson}\n</script>\n${DATA_END_MARKER}`;
  html = replaceMarkedBlock(html, DATA_START_MARKER, DATA_END_MARKER, dataReplacement, "DASHBOARD_DATA");

  fs.writeFileSync(HTML_PATH, html, "utf8");
  console.log(`Synced embedded core + JSON into ${HTML_PATH}`);
}

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`${DATA_PATH} が見つかりません。`);
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const nowIso = new Date().toISOString();

  const gitData = collectGitData();
  const ghData = collectGitHubData();
  const nextMetrics = countNextMetrics(NEXT_WORKTREE);

  data.meta.schemaVersion = "1.1.0";
  data.meta.generatorVersion = "1.1.0";
  data.meta.generatedAt = nowIso;
  data.mechanical.git = gitData;
  data.mechanical.github = ghData;
  if (nextMetrics.available) {
    data.mechanical.nextCodebase = nextMetrics;
  } else {
    data.mechanical.nextCodebase = {
      ...(data.mechanical.nextCodebase || {}),
      available: false,
      fetchStatus: "failed",
      headSha: null,
      headShortSha: null,
      dirty: null,
      error: nextMetrics.reason,
      capturedAt: nowIso,
    };
  }

  const currentHead =
    (ghData.fetchStatus === "ok" && ghData.pr?.headRefOid) ||
    (gitData.fetchStatus === "ok" && gitData.headSha) ||
    null;

  const evalDelta = resolveEvaluationDelta(data.evaluation.evaluatedCommitSha, currentHead);
  data.evaluation.isStaleRelativeToHead = evalDelta.headMoved;
  data.evaluation.headMovedSinceEvaluation = evalDelta.headMoved;
  data.evaluation.evaluationImpact = evalDelta.impact;
  data.evaluation.nonDashboardChangesSinceEvaluation = evalDelta.nonDashboardChangesSinceEvaluation;
  data.evaluation.productFilesChangedSinceEvaluation = evalDelta.productFilesChangedSinceEvaluation;
  data.evaluation.supportingFilesChangedSinceEvaluation = evalDelta.supportingFilesChangedSinceEvaluation;
  data.evaluation.changedFilesSinceEvaluation = evalDelta.changedFilesSinceEvaluation;
  data.evaluation.evaluationDeltaError = evalDelta.error;
  data.evaluation.latestObservedHeadSha = currentHead || "不明";
  data.evaluation.evaluatedShortSha = data.evaluation.evaluatedCommitSha
    ? data.evaluation.evaluatedCommitSha.slice(0, 8)
    : "不明";

  data.meta.dataTarget = {
    sha: currentHead || "不明",
    shortSha: currentHead ? currentHead.slice(0, 8) : "不明",
    source: ghData.fetchStatus === "ok" && ghData.pr?.headRefOid ? "GitHub PR headRefOid" : "git head",
    capturedAt: nowIso,
  };

  const progress = core.computeProgress(data.evaluation);
  data.evaluation.computedProgress = progress;
  data.evaluation.computedAcceptance = progress.acceptance;
  data.evaluation.scoringRules.formulaExplanation = core.buildFormulaExplanation(data.evaluation, progress);

  const acceptanceSummary = data.evaluation.acceptanceAndPerformance?.acceptanceSummary || {};
  data.evaluation.acceptanceAndPerformance.acceptanceSummary = {
    ...acceptanceSummary,
    totalItems: progress.acceptance.totalItems,
    passed: progress.acceptance.passed,
    failed: progress.acceptance.failed,
    unmeasured: progress.acceptance.unmeasured,
    outOfScope: progress.acceptance.outOfScope,
    measured: progress.acceptance.measured,
    source: "evaluation.acceptanceAndPerformance.acceptanceRows から再計算",
    note:
      "docs/next-native-acceptance-record.md の明細 " +
      progress.acceptance.totalItems +
      " 項目を集計。合格 " +
      progress.acceptance.passed +
      " / 未測定 " +
      progress.acceptance.unmeasured +
      " / 対象外 " +
      progress.acceptance.outOfScope +
      "。自動テストや補助プローブの結果は実機受け入れへ転記しない。",
  };

  if (data.mechanical.ciHighlights) {
    data.mechanical.ciHighlights.capturedAt = data.evaluation.evaluatedAt;
    data.mechanical.ciHighlights.note =
      "CIの最終成功時に記録した詳細値。最新HEADの状態は mechanical.ci を参照し、旧HEADの成功を最新HEADの成功として扱わない。";
  }

  data.mechanical.ci = core.resolveCiStatus(data.mechanical, data.meta);
  data.mechanical.provenance = core.buildProvenance(data.mechanical, data.evaluation, data.meta);

  syncHtml(data);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Updated ${DATA_PATH}`);
}

main();
