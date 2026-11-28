#!/usr/bin/env node
/**
 * Hazakura Editor 第二世代 (PR #71 / next-native-editor) ダッシュボード再生成スクリプト
 *
 * 役割:
 * 1. Git / GitHub CLI (`gh`) / `next/` ソースから機械取得可能な統計・CI・コミット履歴を取得する
 *    (取得失敗時は推定で埋めず、fetchStatus: "failed" / "不明" を明示する)。
 * 2. 評価層 (evaluation) の対象SHA・評価日時を保持し、最新HEADと乖離がある場合は stale 警告フラグを立てる。
 * 3. 公開されている計算ルールに基づいて到達度指標を再計算する。
 * 4. `dashboard-data.json` を更新し、`dashboard.html` 内の埋め込みJSONブロックを安全に同期する。
 *
 * 依存: Node.js 標準モジュールのみ (外部パッケージ不要)
 * 実行: node next-dashboard/generate.mjs [--skip-github]
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const SKIP_GITHUB = process.argv.includes("--skip-github");

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

  return {
    available: true,
    sourceFiles,
    sourceLines,
    testFiles,
    testLines,
    testAnnotations,
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
  const baseShaRes = runCommand("git", ["rev-parse", "origin/main"]);
  const headShaRes = runCommand("git", ["rev-parse", "origin/next-native-editor"]);
  if (!baseShaRes.ok || !headShaRes.ok) {
    return { fetchStatus: "failed", error: "git ref origin/main または origin/next-native-editor を解決できません" };
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
    baseSha,
    baseShortSha: baseSha.slice(0, 8),
    headSha,
    headShortSha: headSha.slice(0, 8),
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
    return { fetchStatus: "skipped", note: "--skip-github 指定により GitHub API 取得を省略" };
  }
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
      error: prRes.error || "gh pr view 71 failed",
    };
  }

  try {
    const pr = JSON.parse(prRes.stdout);
    const reviews = reviewsRes.ok ? JSON.parse(reviewsRes.stdout) : null;
    const runs = runsRes.ok ? JSON.parse(runsRes.stdout) : null;
    return {
      fetchStatus: "ok",
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
      error: `GitHub JSON parse failed: ${err.message}`,
    };
  }
}

function computeProgressMetrics(data) {
  const implWeights = data.evaluation.scoringRules.implementationWeights;
  const verWeights = data.evaluation.scoringRules.verificationWeights;
  const accWeights = data.evaluation.scoringRules.acceptanceWeights;
  const readinessMix = data.evaluation.scoringRules.productReadinessWeights;

  const items = data.evaluation.featureComparison || [];
  const inScope = items.filter((item) => item.implementationStatus !== "保留・対象外");
  const parked = items.filter((item) => item.implementationStatus === "保留・対象外");

  let protoSum = 0;
  let productSum = 0;

  for (const item of inScope) {
    const wImpl = implWeights[item.implementationStatus] ?? 0;
    const wVer = verWeights[item.verificationStatus] ?? 0;
    const wAcc = accWeights[item.deviceAcceptanceStatus] ?? 0;
    protoSum += wImpl;
    productSum +=
      wImpl * readinessMix.implementation +
      wVer * readinessMix.verification +
      wAcc * readinessMix.deviceAcceptance;
  }

  const denominator = inScope.length || 1;
  const prototypePct = Math.round((protoSum / denominator) * 1000) / 10;
  const productPct = Math.round((productSum / denominator) * 1000) / 10;

  const statusCounts = {};
  for (const item of items) {
    statusCounts[item.implementationStatus] = (statusCounts[item.implementationStatus] || 0) + 1;
  }

  return {
    totalCatalogItems: items.length,
    inScopeItems: inScope.length,
    parkedItems: parked.length,
    prototypeNumerator: Math.round(protoSum * 100) / 100,
    productNumerator: Math.round(productSum * 100) / 100,
    prototypeCompletionPct: prototypePct,
    productReadinessPct: productPct,
    statusBreakdown: statusCounts,
  };
}

function syncHtml(data) {
  if (!fs.existsSync(HTML_PATH)) {
    console.log("dashboard.html はまだ存在しないため同期をスキップしました。");
    return;
  }
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const startMarker = "<!-- DASHBOARD_DATA_START -->";
  const endMarker = "<!-- DASHBOARD_DATA_END -->";
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error("dashboard.html 内に DASHBOARD_DATA マーカーが見つかりません。");
  }
  // </script> を含む文字列がHTMLパーサを壊さないようエスケープする
  const safeJson = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
  const replacement = `${startMarker}\n<script id="dashboard-data" type="application/json">\n${safeJson}\n</script>\n${endMarker}`;
  const updated = html.slice(0, startIdx) + replacement + html.slice(endIdx + endMarker.length);
  fs.writeFileSync(HTML_PATH, updated, "utf8");
  console.log(`Synced embedded JSON into ${HTML_PATH}`);
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

  data.meta.generatedAt = nowIso;
  data.mechanical.git = gitData;
  data.mechanical.github = ghData;
  if (nextMetrics.available) {
    data.mechanical.nextCodebase = nextMetrics;
  } else {
    data.mechanical.nextCodebase = {
      ...(data.mechanical.nextCodebase || {}),
      fetchStatus: "stale_or_unavailable",
      note: nextMetrics.reason,
    };
  }

  const currentHead =
    (ghData.fetchStatus === "ok" && ghData.pr?.headRefOid) ||
    (gitData.fetchStatus === "ok" && gitData.headSha) ||
    null;

  let isStale = false;
  if (currentHead && data.evaluation.evaluatedCommitSha && currentHead !== data.evaluation.evaluatedCommitSha) {
    const nonDashDiff = runCommand("git", [
      "diff",
      "--name-only",
      `${data.evaluation.evaluatedCommitSha}..${currentHead}`,
      "--",
      ":!next-dashboard/",
    ]);
    isStale = !nonDashDiff.ok || nonDashDiff.stdout.length > 0;
  }
  data.evaluation.isStaleRelativeToHead = isStale;
  data.evaluation.latestObservedHeadSha = currentHead || "不明";
  data.evaluation.computedProgress = computeProgressMetrics(data);

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Updated ${DATA_PATH}`);
  syncHtml(data);
}

main();
