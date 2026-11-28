/**
 * Hazakura Editor 第二世代 開発状況ダッシュボード 共通ロジック
 *
 * このファイルは Node.js の回帰テストと、dashboard.html に埋め込まれる
 * ブラウザ用スクリプトの双方から利用する。外部依存はない。
 *
 * 設計方針:
 * - 表示に使う数値・状態・URL・差分は、可能な限り保存データから毎回導出する。
 * - 取得不能・旧HEAD・保留・対象外を「0」や「成功」に丸めない。
 * - URL は https のみを許可し、相対パスは repository 配下に閉じる。
 * - 入力 JSON は描画前に検証し、失敗時は呼び出し側が既存表示を保持できる形で返す。
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HazakuraDashboardCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SCHEMA_VERSION = "1.1.0";
  var MAX_ARRAY_ITEMS = 20000;
  var MAX_STRING_LENGTH = 200000;
  var MAX_URL_LENGTH = 4096;
  var SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

  var OWNER_LABELS = {
    agent: "エージェント実施可",
    owner_device: "オーナー実機確認",
    both: "協働（実機確認を含む）",
  };

  var PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asString(value) {
    return typeof value === "string" ? value : "";
  }

  function finiteNumber(value) {
    return typeof value === "number" && isFinite(value) ? value : null;
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function shortSha(value) {
    var text = asString(value);
    if (!text || text === "不明") return "不明";
    return text.slice(0, 8);
  }

  function compareSha(a, b) {
    if (!a || !b) return null;
    return a === b;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDateJst(iso) {
    if (!iso || iso === "不明") return "不明";
    try {
      var date = new Date(iso);
      if (isNaN(date.getTime())) return String(iso);
      return date.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }) + " JST";
    } catch (_) {
      return String(iso);
    }
  }

  function parseIsoMs(iso) {
    if (!iso || typeof iso !== "string") return null;
    var time = new Date(iso).getTime();
    return isNaN(time) ? null : time;
  }

  function safeNumber(value, fallback) {
    var n = finiteNumber(value);
    return n === null ? fallback : n;
  }

  function stateDefinitions(evaluation) {
    var rules = (evaluation && evaluation.scoringRules) || {};
    return asArray(rules.states);
  }

  function stateDef(evaluation, statusName) {
    var id = asString(statusName) || "不明・未確認";
    var states = stateDefinitions(evaluation);
    for (var i = 0; i < states.length; i += 1) {
      if (states[i] && states[i].id === id) return states[i];
    }
    var fallback = {
      "未着手": { id: "未着手", glyph: "○", tone: "muted", description: "第二世代で未着手。" },
      "調査・設計中": { id: "調査・設計中", glyph: "◌", tone: "info", description: "契約・境界・方式を比較検討中。" },
      "部分実装": { id: "部分実装", glyph: "◐", tone: "warn", description: "一部機能やコアのみ実装済み。" },
      "試作実装": { id: "試作実装", glyph: "◈", tone: "proto", description: "限定範囲の動作試作。" },
      "実装済み": { id: "実装済み", glyph: "●", tone: "ok", description: "予定スコープの実装が完了。" },
      "自動検証済み": { id: "自動検証済み", glyph: "✓", tone: "ok", description: "自動テストで境界・回帰を確認。" },
      "実機受け入れ済み": { id: "実機受け入れ済み", glyph: "◆", tone: "strong", description: "実機GUI・IME等で合格。" },
      "製品化済み": { id: "製品化済み", glyph: "★", tone: "strong", description: "配布可能な状態。" },
      "保留・対象外": { id: "保留・対象外", glyph: "－", tone: "parked", description: "後続へ保留、または対象外。" },
      "未実施": { id: "未実施", glyph: "○", tone: "muted", description: "自動検証が未実施。" },
      "部分検証": { id: "部分検証", glyph: "◐", tone: "warn", description: "一部の検証のみ実施。" },
      "未測定": { id: "未測定", glyph: "○", tone: "muted", description: "実機受け入れが未測定。" },
      "不合格": { id: "不合格", glyph: "×", tone: "alert", description: "実機受け入れが不合格。" },
      "要確認": { id: "要確認", glyph: "？", tone: "warn", description: "追加確認が必要。" },
      "対象外": { id: "対象外", glyph: "－", tone: "parked", description: "この世代・実行対象では対象外。" },
      "補助計測のみ": { id: "補助計測のみ", glyph: "◌", tone: "info", description: "補助計測のみで実機受け入れではない。" },
      "不明・未確認": { id: "不明・未確認", glyph: "？", tone: "alert", description: "証拠不足・未測定・未確認。" },
    };
    return fallback[id] || { id: id, glyph: "？", tone: "alert", description: "判定不能。" };
  }

  function classifyResultStatus(text) {
    var value = asString(text).trim();
    if (!value) return "不明・未確認";
    if (/不合格|失敗|エラー/.test(value)) return "不合格";
    if (/未測定|未実施|未確認|未記録/.test(value)) return "未測定";
    if (/対象外/.test(value)) return "対象外";
    if (/補助計測のみ/.test(value)) return "補助計測のみ";
    if (/製品化済み/.test(value)) return "製品化済み";
    if (/実機受け入れ済み|合格/.test(value)) return "実機受け入れ済み";
    return "不明・未確認";
  }

  /* ------------------------------------------------------------------ *
   * URL safety
   * ------------------------------------------------------------------ */

  function sanitizeHttpsUrl(value) {
    var text = asString(value).trim();
    if (!text || text.length > MAX_URL_LENGTH) return null;
    if (/[\u0000-\u001f\u007f\s]/.test(text)) return null;
    var url;
    try {
      url = new URL(text);
    } catch (_) {
      return null;
    }
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname || !/[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
    if (url.port && url.port !== "443") return null;
    return url.href;
  }

  function sanitizeGithubRepoUrl(value) {
    var safe = sanitizeHttpsUrl(value);
    if (!safe) return null;
    var url = new URL(safe);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    var parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    if (parts.length > 2) return null;
    return "https://github.com/" + parts[0] + "/" + parts[1];
  }

  function isSafeRelativePath(value) {
    var text = asString(value).trim();
    if (!text || text.length > 1024) return false;
    if (text.charAt(0) === "/" || text.indexOf("\\") !== -1) return false;
    if (/[\u0000-\u001f\u007f]/.test(text)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return false;
    if (/%2e|%2f|%5c/i.test(text)) return false;
    var withoutFragment = text.split("#")[0];
    if (!withoutFragment) return false;
    var segments = withoutFragment.split("/");
    for (var i = 0; i < segments.length; i += 1) {
      if (!segments[i] || segments[i] === "." || segments[i] === "..") return false;
    }
    return true;
  }

  function buildEvidenceUrl(repoUrl, ref, pathOrUrl) {
    var value = asString(pathOrUrl).trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return sanitizeHttpsUrl(value);
    if (!isSafeRelativePath(value)) return null;
    var repo = sanitizeGithubRepoUrl(repoUrl);
    if (!repo) return null;
    var revision = asString(ref).trim();
    if (!revision || revision.length > 256) return null;
    var hashIndex = value.indexOf("#");
    var pathPart = hashIndex === -1 ? value : value.slice(0, hashIndex);
    var fragment = hashIndex === -1 ? "" : value.slice(hashIndex + 1);
    var encodedPath = pathPart.split("/").map(function (segment) {
      return encodeURIComponent(segment);
    }).join("/");
    var encodedRef = encodeURIComponent(revision);
    return repo + "/blob/" + encodedRef + "/" + encodedPath + (fragment ? "#" + encodeURIComponent(fragment) : "");
  }

  /* ------------------------------------------------------------------ *
   * Schema validation
   * ------------------------------------------------------------------ */

  function validationError(errors, path, message) {
    if (errors.length < 40) errors.push({ path: path, message: message });
  }

  function requireObject(errors, value, path) {
    if (!isPlainObject(value)) {
      validationError(errors, path, "オブジェクトが必要です。");
      return false;
    }
    return true;
  }

  function requireString(errors, value, path, allowEmpty) {
    if (typeof value !== "string") {
      validationError(errors, path, "文字列が必要です。");
      return false;
    }
    if (!allowEmpty && !value.trim()) {
      validationError(errors, path, "空でない文字列が必要です。");
      return false;
    }
    if (value.length > MAX_STRING_LENGTH) {
      validationError(errors, path, "文字列が長すぎます。");
      return false;
    }
    return true;
  }

  function requireArray(errors, value, path) {
    if (!Array.isArray(value)) {
      validationError(errors, path, "配列が必要です。");
      return false;
    }
    if (value.length > MAX_ARRAY_ITEMS) {
      validationError(errors, path, "要素数が上限を超えています。");
      return false;
    }
    return true;
  }

  function validateIsoString(errors, value, path) {
    if (!requireString(errors, value, path, false)) return;
    if (parseIsoMs(value) === null) validationError(errors, path, "日時として解釈できません。");
  }

  function validateEvidenceList(errors, warnings, value, path, repoUrl) {
    if (value === undefined || value === null) return;
    if (!Array.isArray(value)) {
      validationError(errors, path, "根拠リストは配列である必要があります。");
      return;
    }
    for (var i = 0; i < value.length; i += 1) {
      var item = value[i];
      if (!isPlainObject(item)) {
        validationError(errors, path + "[" + i + "]", "根拠はオブジェクトである必要があります。");
        continue;
      }
      var target = item.path;
      if (target === undefined || target === null || target === "") continue;
      if (typeof target !== "string") {
        validationError(errors, path + "[" + i + "].path", "根拠パスは文字列である必要があります。");
        continue;
      }
      var safe = /^https?:\/\//i.test(target)
        ? sanitizeHttpsUrl(target)
        : buildEvidenceUrl(repoUrl, "0123456789abcdef0123456789abcdef01234567", target);
      if (!safe) {
        if (warnings.length < 40) {
          warnings.push({ path: path + "[" + i + "].path", message: "安全な https URL またはリポジトリ内の相対パスではないため、リンクしません。" });
        }
      }
    }
  }

  function validateRefList(errors, warnings, value, path, repoUrl) {
    if (value === undefined || value === null) return;
    if (!Array.isArray(value)) {
      validationError(errors, path, "参照リストは配列である必要があります。");
      return;
    }
    for (var i = 0; i < value.length; i += 1) {
      var ref = value[i];
      if (typeof ref !== "string") {
        validationError(errors, path + "[" + i + "]", "参照は文字列である必要があります。");
        continue;
      }
      var safe = /^https?:\/\//i.test(ref)
        ? sanitizeHttpsUrl(ref)
        : buildEvidenceUrl(repoUrl, "0123456789abcdef0123456789abcdef01234567", ref);
      if (!safe && warnings.length < 40) {
        warnings.push({ path: path + "[" + i + "]", message: "安全な https URL またはリポジトリ内の相対パスではないため、リンクしません。" });
      }
    }
  }

  function validateDashboardData(raw) {
    var errors = [];
    var warnings = [];
    if (!isPlainObject(raw)) {
      return { ok: false, errors: [{ path: "$", message: "JSON ルートがオブジェクトではありません。" }], warnings: [], data: null };
    }

    var meta = raw.meta;
    if (requireObject(errors, meta, "meta")) {
      if (requireString(errors, meta.schemaVersion, "meta.schemaVersion", false)) {
        if (!/^1\.[0-9]+\.[0-9]+$/.test(meta.schemaVersion)) {
          validationError(errors, "meta.schemaVersion", "対応していない schemaVersion です。");
        } else if (meta.schemaVersion !== SCHEMA_VERSION) {
          warnings.push({
            path: "meta.schemaVersion",
            message: "このダッシュボードの既定スキーマは " + SCHEMA_VERSION + " です。読み込みは継続します。",
          });
        }
      }
      validateIsoString(errors, meta.generatedAt, "meta.generatedAt");
      if (requireString(errors, meta.repoUrl, "meta.repoUrl", false)) {
        if (!sanitizeGithubRepoUrl(meta.repoUrl)) {
          validationError(errors, "meta.repoUrl", "https://github.com/<owner>/<repo> 形式ではありません。");
        }
      }
      if (finiteNumber(meta.prNumber) === null) {
        validationError(errors, "meta.prNumber", "数値が必要です。");
      }
      requireString(errors, meta.targetBranch, "meta.targetBranch", false);
    }

    var mechanical = raw.mechanical;
    if (requireObject(errors, mechanical, "mechanical")) {
      if (requireObject(errors, mechanical.git, "mechanical.git")) {
        requireString(errors, mechanical.git.fetchStatus, "mechanical.git.fetchStatus", false);
      }
      if (requireObject(errors, mechanical.github, "mechanical.github")) {
        requireString(errors, mechanical.github.fetchStatus, "mechanical.github.fetchStatus", false);
        if (mechanical.github.fetchStatus === "ok") {
          if (!requireObject(errors, mechanical.github.pr, "mechanical.github.pr")) {
            // error already recorded
          } else {
            requireString(errors, mechanical.github.pr.headRefOid, "mechanical.github.pr.headRefOid", false);
            requireArray(errors, mechanical.github.pr.statusCheckRollup, "mechanical.github.pr.statusCheckRollup");
          }
        }
      }
      if (requireObject(errors, mechanical.nextCodebase, "mechanical.nextCodebase")) {
        if (mechanical.nextCodebase.available !== false) {
          var numericFields = ["sourceFiles", "sourceLines", "testFiles", "testLines", "testAnnotations"];
          for (var n = 0; n < numericFields.length; n += 1) {
            if (finiteNumber(mechanical.nextCodebase[numericFields[n]]) === null) {
              validationError(errors, "mechanical.nextCodebase." + numericFields[n], "数値が必要です。");
            }
          }
        }
      }
    }

    var evaluation = raw.evaluation;
    if (requireObject(errors, evaluation, "evaluation")) {
      validateIsoString(errors, evaluation.evaluatedAt, "evaluation.evaluatedAt");
      requireString(errors, evaluation.evaluatedCommitSha, "evaluation.evaluatedCommitSha", false);
      if (requireObject(errors, evaluation.scoringRules, "evaluation.scoringRules")) {
        requireArray(errors, evaluation.scoringRules.states, "evaluation.scoringRules.states");
        requireObject(errors, evaluation.scoringRules.implementationWeights, "evaluation.scoringRules.implementationWeights");
        requireObject(errors, evaluation.scoringRules.verificationWeights, "evaluation.scoringRules.verificationWeights");
        requireObject(errors, evaluation.scoringRules.acceptanceWeights, "evaluation.scoringRules.acceptanceWeights");
      }
      if (requireArray(errors, evaluation.featureComparison, "evaluation.featureComparison")) {
        for (var i = 0; i < evaluation.featureComparison.length; i += 1) {
          var item = evaluation.featureComparison[i];
          var itemPath = "evaluation.featureComparison[" + i + "]";
          if (!requireObject(errors, item, itemPath)) continue;
          requireString(errors, item.name, itemPath + ".name", false);
          requireString(errors, item.implementationStatus, itemPath + ".implementationStatus", false);
          requireString(errors, item.verificationStatus, itemPath + ".verificationStatus", false);
          requireString(errors, item.deviceAcceptanceStatus, itemPath + ".deviceAcceptanceStatus", false);
          validateEvidenceList(errors, warnings, item.evidence, itemPath + ".evidence", meta && meta.repoUrl);
        }
      }
      if (requireObject(errors, evaluation.acceptanceAndPerformance, "evaluation.acceptanceAndPerformance")) {
        if (requireArray(errors, evaluation.acceptanceAndPerformance.acceptanceRows, "evaluation.acceptanceAndPerformance.acceptanceRows")) {
          var rows = evaluation.acceptanceAndPerformance.acceptanceRows;
          for (var r = 0; r < rows.length; r += 1) {
            var row = rows[r];
            var rowPath = "evaluation.acceptanceAndPerformance.acceptanceRows[" + r + "]";
            if (!requireObject(errors, row, rowPath)) continue;
            requireString(errors, row.id, rowPath + ".id", false);
            requireString(errors, row.title, rowPath + ".title", false);
            requireString(errors, row.g2Result, rowPath + ".g2Result", false);
          }
        }
      }
      if (requireArray(errors, evaluation.remainingIssues, "evaluation.remainingIssues")) {
        for (var j = 0; j < evaluation.remainingIssues.length; j += 1) {
          var issue = evaluation.remainingIssues[j];
          var issuePath = "evaluation.remainingIssues[" + j + "]";
          if (!requireObject(errors, issue, issuePath)) continue;
          requireString(errors, issue.title, issuePath + ".title", false);
          requireString(errors, issue.priority, issuePath + ".priority", false);
          requireString(errors, issue.origin, issuePath + ".origin", false);
          requireString(errors, issue.ownerType, issuePath + ".ownerType", false);
          validateRefList(errors, warnings, issue.relatedRefs, issuePath + ".relatedRefs", meta && meta.repoUrl);
        }
      }
    }

    if (meta && mechanical && evaluation) {
      if (mechanical.github && mechanical.github.fetchStatus === "failed") {
        warnings.push({ path: "mechanical.github.fetchStatus", message: "GitHub 情報を取得できませんでした。CI 状態は「取得不能」として扱います。" });
      }
      if (mechanical.github && mechanical.github.fetchStatus === "skipped") {
        warnings.push({ path: "mechanical.github.fetchStatus", message: "GitHub 情報は --skip-github により省略されています。CI 状態は「未取得」です。" });
      }
      if (mechanical.git && mechanical.git.fetchStatus === "failed") {
        warnings.push({ path: "mechanical.git.fetchStatus", message: "Git 統計を取得できませんでした。" });
      }
      if (evaluation.evaluatedCommitSha && mechanical.nextCodebase && mechanical.nextCodebase.headSha) {
        if (evaluation.evaluatedCommitSha !== mechanical.nextCodebase.headSha) {
          warnings.push({
            path: "evaluation.evaluatedCommitSha",
            message: "定性評価の対象SHAとソース集計の対象SHAが一致しません。表示では両方を明示します。",
          });
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      data: errors.length === 0 ? raw : null,
    };
  }

  /* ------------------------------------------------------------------ *
   * Progress / acceptance
   * ------------------------------------------------------------------ */

  function computeAcceptance(evaluation) {
    var acceptance = (evaluation && evaluation.acceptanceAndPerformance) || {};
    var rows = asArray(acceptance.acceptanceRows);
    var counts = { passed: 0, failed: 0, unmeasured: 0, outOfScope: 0, other: 0 };
    var groups = {};
    var statuses = {};
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i] || {};
      var status = classifyResultStatus(row.g2Result);
      statuses[status] = (statuses[status] || 0) + 1;
      var group = asString(row.group) || "未分類";
      if (!groups[group]) groups[group] = { total: 0, passed: 0, unmeasured: 0, failed: 0 };
      groups[group].total += 1;
      if (status === "実機受け入れ済み" || status === "製品化済み") {
        counts.passed += 1;
        groups[group].passed += 1;
      } else if (status === "不合格") {
        counts.failed += 1;
        groups[group].failed += 1;
      } else if (status === "未測定") {
        counts.unmeasured += 1;
        groups[group].unmeasured += 1;
      } else if (status === "対象外") {
        counts.outOfScope += 1;
      } else {
        counts.other += 1;
      }
    }
    var totalItems = rows.length;
    var applicableItems = totalItems - counts.outOfScope;
    var measured = counts.passed + counts.failed + counts.other;
    var provided = acceptance.acceptanceSummary || null;
    var providedMatches = null;
    if (provided && typeof provided === "object") {
      providedMatches =
        safeNumber(provided.totalItems, -1) === totalItems &&
        safeNumber(provided.passed, -1) === counts.passed &&
        safeNumber(provided.unmeasured, -1) === counts.unmeasured;
    }
    return {
      totalItems: totalItems,
      applicableItems: applicableItems,
      passed: counts.passed,
      failed: counts.failed,
      unmeasured: counts.unmeasured,
      outOfScope: counts.outOfScope,
      other: counts.other,
      measured: measured,
      completionPct: applicableItems > 0 ? round1((counts.passed / applicableItems) * 100) : null,
      statusBreakdown: statuses,
      groups: groups,
      provided: provided,
      providedMatches: providedMatches,
      source: "evaluation.acceptanceAndPerformance.acceptanceRows",
    };
  }

  function orderedBreakdown(breakdown, preferredOrder) {
    var order = asArray(preferredOrder);
    var result = [];
    for (var i = 0; i < order.length; i += 1) {
      if (breakdown[order[i]]) result.push({ id: order[i], count: breakdown[order[i]] });
    }
    Object.keys(breakdown).sort().forEach(function (key) {
      if (order.indexOf(key) === -1) result.push({ id: key, count: breakdown[key] });
    });
    return result;
  }

  function computeProgress(evaluation) {
    var ev = evaluation || {};
    var rules = ev.scoringRules || {};
    var implWeights = rules.implementationWeights || {};
    var verWeights = rules.verificationWeights || {};
    var accWeights = rules.acceptanceWeights || {};
    var mix = rules.productReadinessWeights || {};
    var items = asArray(ev.featureComparison);
    var inScope = [];
    var outOfScope = [];
    var future = [];
    var statusBreakdown = {};
    var verificationBreakdown = {};
    var acceptanceBreakdown = {};
    var dispositionBreakdown = {};
    var weights = { implementation: safeNumber(mix.implementation, 0.3), verification: safeNumber(mix.verification, 0.3), deviceAcceptance: safeNumber(mix.deviceAcceptance, 0.4) };
    var prototypeSum = 0;
    var productSum = 0;
    var unknownImplementationStatuses = {};

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i] || {};
      var implStatus = asString(item.implementationStatus) || "不明・未確認";
      var verStatus = asString(item.verificationStatus) || "不明・未確認";
      var accStatus = asString(item.deviceAcceptanceStatus) || "不明・未確認";
      var disposition = asString(item.disposition) || "未分類";
      statusBreakdown[implStatus] = (statusBreakdown[implStatus] || 0) + 1;
      verificationBreakdown[verStatus] = (verificationBreakdown[verStatus] || 0) + 1;
      acceptanceBreakdown[accStatus] = (acceptanceBreakdown[accStatus] || 0) + 1;
      dispositionBreakdown[disposition] = (dispositionBreakdown[disposition] || 0) + 1;

      if (implStatus === "保留・対象外") {
        outOfScope.push(item);
        continue;
      }
      inScope.push(item);
      if (disposition === "保留") future.push(item);

      var wImpl = Object.prototype.hasOwnProperty.call(implWeights, implStatus) ? implWeights[implStatus] : 0;
      var wVer = Object.prototype.hasOwnProperty.call(verWeights, verStatus) ? verWeights[verStatus] : 0;
      var wAcc = Object.prototype.hasOwnProperty.call(accWeights, accStatus) ? accWeights[accStatus] : 0;
      if (!Object.prototype.hasOwnProperty.call(implWeights, implStatus)) {
        unknownImplementationStatuses[implStatus] = true;
      }
      prototypeSum += wImpl;
      productSum += wImpl * weights.implementation + wVer * weights.verification + wAcc * weights.deviceAcceptance;
    }

    var denominator = inScope.length;
    var acceptance = computeAcceptance(ev);
    return {
      totalCatalogItems: items.length,
      inScopeItems: denominator,
      outOfScopeItems: outOfScope.length,
      futureConsiderationItems: future.length,
      inScopeFutureConsiderationItems: future.length,
      prototypeNumerator: Math.round(prototypeSum * 100) / 100,
      productNumerator: Math.round(productSum * 100) / 100,
      prototypeCompletionPct: denominator > 0 ? round1((prototypeSum / denominator) * 100) : null,
      productReadinessPct: denominator > 0 ? round1((productSum / denominator) * 100) : null,
      statusBreakdown: statusBreakdown,
      statusBreakdownOrdered: orderedBreakdown(statusBreakdown, [
        "実装済み", "試作実装", "部分実装", "調査・設計中", "未着手", "保留・対象外", "不明・未確認",
      ]),
      verificationBreakdown: verificationBreakdown,
      acceptanceBreakdown: acceptanceBreakdown,
      dispositionBreakdown: dispositionBreakdown,
      unknownImplementationStatuses: Object.keys(unknownImplementationStatuses),
      weights: weights,
      acceptance: acceptance,
      source: "evaluation.featureComparison",
    };
  }

  function buildFormulaExplanation(evaluation, progress) {
    var rules = (evaluation && evaluation.scoringRules) || {};
    var p = progress || computeProgress(evaluation);
    var implWeights = rules.implementationWeights || {};
    var verWeights = rules.verificationWeights || {};
    var accWeights = rules.acceptanceWeights || {};
    var mix = rules.productReadinessWeights || {};
    function weightText(map, keys) {
      return keys.map(function (key) {
        var value = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : 0;
        return key + "=" + value;
      }).join(" / ");
    }
    return [
      "対象カタログ " + p.totalCatalogItems + " 項目のうち「保留・対象外」" + p.outOfScopeItems + " 件を除く " + p.inScopeItems + " 項目を分母とします。",
      "このうち「保留（将来検討）」" + p.futureConsiderationItems + " 件は分母に含み、実装重み 0 として計上します（対象外とは区別）。",
      "(1) 機能・試作到達度 = 実装状態の重み平均（" + weightText(implWeights, ["未着手", "調査・設計中", "部分実装", "試作実装", "実装済み"]) + "）。",
      "(2) 製品品質到達度 = 実装 " + safeNumber(mix.implementation, 0.3) + " + 自動検証 " + safeNumber(mix.verification, 0.3) + " + 実機受け入れ " + safeNumber(mix.deviceAcceptance, 0.4) +
        " の3軸加重平均（自動検証: " + weightText(verWeights, ["未実施", "部分検証", "自動検証済み"]) +
        "、実機受け入れ: " + weightText(accWeights, ["未着手", "補助計測のみ", "実機受け入れ済み"]) + "）。",
      "実機受け入れは " + p.acceptance.totalItems + " 項目（合格 " + p.acceptance.passed + " / 未測定 " + p.acceptance.unmeasured + " / 対象外 " + p.acceptance.outOfScope + "）。",
      "安全性・実機ゲートが未通過の間は、数値に関わらず製品化不可の警告を表示します。",
    ].join("");
  }

  function computeTestSummary(nextCodebase) {
    var code = nextCodebase || {};
    if (code.available === false) {
      return { available: false, reason: code.note || code.reason || "ソース集計を取得できませんでした。", sourceFiles: null, sourceLines: null, testFiles: null, testLines: null, testAnnotations: null };
    }
    return {
      available: true,
      sourceFiles: finiteNumber(code.sourceFiles),
      sourceLines: finiteNumber(code.sourceLines),
      testFiles: finiteNumber(code.testFiles),
      testLines: finiteNumber(code.testLines),
      testAnnotations: finiteNumber(code.testAnnotations),
      suiteAnnotations: finiteNumber(code.suiteAnnotations),
      headSha: code.headSha || null,
      dirty: code.dirty === true,
      capturedAt: code.capturedAt || null,
      targetPath: code.targetPath || "next/",
    };
  }

  /* ------------------------------------------------------------------ *
   * CI status
   * ------------------------------------------------------------------ */

  function classifyRunState(status, conclusion) {
    var statusText = asString(status).toLowerCase();
    var conclusionText = asString(conclusion).toLowerCase();
    if (statusText && statusText !== "completed") return "running";
    if (conclusionText === "success" || conclusionText === "neutral" || conclusionText === "skipped") return "success";
    if (/failure|timed_out|cancelled|action_required|startup_failure|stale/.test(conclusionText)) return "failure";
    if (!conclusionText) return "unavailable";
    return "unknown";
  }

  function classifyCheckState(status, conclusion) {
    var statusText = asString(status).toUpperCase();
    var conclusionText = asString(conclusion).toUpperCase();
    if (statusText && statusText !== "COMPLETED") return "running";
    if (conclusionText === "SUCCESS" || conclusionText === "NEUTRAL" || conclusionText === "SKIPPED") return "success";
    if (/FAILURE|TIMED_OUT|CANCELLED|ACTION_REQUIRED|STARTUP_FAILURE|STALE/.test(conclusionText)) return "failure";
    if (!conclusionText) return "unavailable";
    return "unknown";
  }

  function latestRunsByWorkflow(runs, targetSha) {
    var map = {};
    for (var i = 0; i < runs.length; i += 1) {
      var run = runs[i] || {};
      var name = asString(run.workflowName) || "不明なワークフロー";
      var time = parseIsoMs(run.createdAt) || 0;
      if (!map[name]) {
        map[name] = { latest: null, latestTime: -1, onTarget: null, onTargetTime: -1 };
      }
      if (time > map[name].latestTime) {
        map[name].latest = run;
        map[name].latestTime = time;
      }
      if (targetSha && asString(run.headSha) === targetSha && time > map[name].onTargetTime) {
        map[name].onTarget = run;
        map[name].onTargetTime = time;
      }
    }
    return map;
  }

  function runKey(run) {
    return String(run.databaseId || run.url || run.headSha || "");
  }

  function ciToneForState(state) {
    if (state === "success") return "ok";
    if (state === "failure") return "alert";
    if (state === "running") return "info";
    if (state === "partial" || state === "stale") return "warn";
    return "muted";
  }

  function ciLabelForState(state) {
    if (state === "success") return "最新HEAD 全成功";
    if (state === "failure") return "最新HEAD 失敗";
    if (state === "running") return "最新HEAD 実行中";
    if (state === "partial") return "最新HEAD 一部未取得";
    if (state === "stale") return "旧HEADのみ成功";
    if (state === "unavailable") return "取得不能";
    return "要確認";
  }

  function resolveCiStatus(mechanical, meta) {
    var mech = mechanical || {};
    var git = mech.git || {};
    var github = mech.github || {};
    var pr = github.pr || {};
    var fetchStatus = asString(github.fetchStatus) || "failed";
    var generatedAt = meta && meta.generatedAt ? meta.generatedAt : null;
    var targetSha = null;
    var targetSource = null;
    if (fetchStatus === "ok" && pr.headRefOid) {
      targetSha = pr.headRefOid;
      targetSource = "GitHub PR headRefOid";
    } else if (git.fetchStatus === "ok" && git.headSha) {
      targetSha = git.headSha;
      targetSource = "git head（GitHub取得なし）";
    }
    var allChecks = asArray(pr.statusCheckRollup);
    var allRuns = asArray(github.recentRuns);
    var latestRuns = latestRunsByWorkflow(allRuns, targetSha);
    var currentChecksByWorkflow = {};
    var workflowNames = [];

    function addWorkflowName(name) {
      if (name && workflowNames.indexOf(name) === -1) workflowNames.push(name);
    }

    for (var i = 0; i < allChecks.length; i += 1) {
      var check = allChecks[i] || {};
      var checkName = asString(check.workflowName) || asString(check.name) || "不明なワークフロー";
      addWorkflowName(checkName);
      if (!currentChecksByWorkflow[checkName]) currentChecksByWorkflow[checkName] = [];
      currentChecksByWorkflow[checkName].push(check);
    }
    for (var runName in latestRuns) {
      if (Object.prototype.hasOwnProperty.call(latestRuns, runName)) addWorkflowName(runName);
    }

    var workflows = [];
    var oldHeadSuccesses = [];
    var seenOld = {};
    var failureWorkflows = [];
    var runningWorkflows = [];
    var successWorkflows = [];
    var missingWorkflows = [];
    var oldHeadWorkflows = [];

    for (var w = 0; w < workflowNames.length; w += 1) {
      var name = workflowNames[w];
      var checks = currentChecksByWorkflow[name] || [];
      var currentRunEntry = latestRuns[name];
      var currentRun = currentRunEntry && currentRunEntry.onTarget;
      var latestRun = currentRunEntry && currentRunEntry.latest;
      var state = null;
      var source = null;
      var headSha = null;
      var startedAt = null;
      var completedAt = null;
      var runUrl = null;
      var checkDetails = [];

      if (checks.length > 0) {
        source = "PR statusCheckRollup";
        headSha = targetSha;
        for (var c = 0; c < checks.length; c += 1) {
          var checkState = classifyCheckState(checks[c].status, checks[c].conclusion);
          checkDetails.push({
            name: asString(checks[c].name) || "check",
            state: checkState,
            status: asString(checks[c].status),
            conclusion: asString(checks[c].conclusion),
            url: sanitizeHttpsUrl(checks[c].detailsUrl),
          });
          if (!startedAt && checks[c].startedAt) startedAt = checks[c].startedAt;
          if (!completedAt && checks[c].completedAt && asString(checks[c].completedAt).indexOf("0001-") !== 0) completedAt = checks[c].completedAt;
          if (checkState === "failure") state = "failure";
          else if (checkState === "running" && state !== "failure") state = "running";
          else if (checkState === "unavailable" && state !== "failure" && state !== "running") state = "unavailable";
        }
        if (!state) state = "success";
        if (currentRun) {
          runUrl = sanitizeHttpsUrl(currentRun.url);
          if (!startedAt) startedAt = currentRun.createdAt || null;
          if (!completedAt) completedAt = currentRun.updatedAt || null;
        } else if (checks.length > 0 && checks[0].detailsUrl) {
          runUrl = sanitizeHttpsUrl(checks[0].detailsUrl);
        }
      } else if (currentRun) {
        source = "recentRuns（対象HEAD一致）";
        headSha = asString(currentRun.headSha);
        state = classifyRunState(currentRun.status, currentRun.conclusion);
        startedAt = currentRun.createdAt || null;
        completedAt = currentRun.updatedAt || null;
        runUrl = sanitizeHttpsUrl(currentRun.url);
      } else if (latestRun) {
        source = "旧HEADの実行記録（最新HEADには未適用）";
        headSha = asString(latestRun.headSha);
        state = "old-head";
        startedAt = latestRun.createdAt || null;
        completedAt = latestRun.updatedAt || null;
        runUrl = sanitizeHttpsUrl(latestRun.url);
        var oldState = classifyRunState(latestRun.status, latestRun.conclusion);
        if (oldState === "success" && !seenOld[runKey(latestRun)]) {
          seenOld[runKey(latestRun)] = true;
          oldHeadSuccesses.push({
            workflowName: name,
            headSha: asString(latestRun.headSha),
            shortSha: shortSha(latestRun.headSha),
            runUrl: sanitizeHttpsUrl(latestRun.url),
            updatedAt: latestRun.updatedAt || null,
            conclusion: asString(latestRun.conclusion) || "success",
          });
        }
      }

      var workflow = {
        name: name,
        state: state || "unavailable",
        label: state === "old-head" ? "旧HEADのみ" : ciLabelForState(state || "unavailable"),
        tone: state === "old-head" ? "muted" : ciToneForState(state || "unavailable"),
        source: source || "取得不能",
        headSha: headSha || null,
        shortSha: headSha ? shortSha(headSha) : "不明",
        matchesTarget: headSha && targetSha ? headSha === targetSha : null,
        startedAt: startedAt,
        completedAt: completedAt,
        runUrl: runUrl,
        checks: checkDetails,
      };
      workflows.push(workflow);
      if (workflow.state === "failure") failureWorkflows.push(workflow);
      else if (workflow.state === "running") runningWorkflows.push(workflow);
      else if (workflow.state === "success") successWorkflows.push(workflow);
      else {
        if (workflow.state === "old-head") oldHeadWorkflows.push(workflow);
        missingWorkflows.push(workflow);
      }
    }

    for (var r = 0; r < allRuns.length; r += 1) {
      var run = allRuns[r] || {};
      if (!targetSha || asString(run.headSha) === targetSha) continue;
      if (classifyRunState(run.status, run.conclusion) !== "success") continue;
      var key = runKey(run);
      if (seenOld[key]) continue;
      seenOld[key] = true;
      oldHeadSuccesses.push({
        workflowName: asString(run.workflowName) || "不明なワークフロー",
        headSha: asString(run.headSha),
        shortSha: shortSha(run.headSha),
        runUrl: sanitizeHttpsUrl(run.url),
        updatedAt: run.updatedAt || null,
        conclusion: asString(run.conclusion) || "success",
      });
    }

    var overallState = "unavailable";
    var reason = "最新HEADに紐づくCI結果を取得できませんでした。";
    if (fetchStatus === "failed") {
      overallState = "unavailable";
      reason = "GitHub 情報の取得に失敗しました。旧HEADの成功を最新HEADの成功として扱いません。";
    } else if (fetchStatus === "skipped") {
      overallState = "unavailable";
      reason = "--skip-github のため GitHub Actions の状態を取得していません。";
    } else if (!targetSha) {
      overallState = "unavailable";
      reason = "対象HEADを特定できませんでした。";
    } else if (failureWorkflows.length > 0) {
      overallState = "failure";
      reason = failureWorkflows.map(function (wf) { return wf.name; }).join(" / ") + " が最新HEADで失敗しています。";
    } else if (runningWorkflows.length > 0) {
      overallState = "running";
      reason = runningWorkflows.map(function (wf) { return wf.name; }).join(" / ") + " が最新HEADで実行中です。";
    } else if (successWorkflows.length > 0 && missingWorkflows.length === 0) {
      overallState = "success";
      reason = "最新HEAD（" + shortSha(targetSha) + "）に紐づく全ワークフローが成功しています。";
    } else if (successWorkflows.length > 0) {
      overallState = "partial";
      reason = "一部のワークフローのみ最新HEADの結果があります。未取得または旧HEADのみ: " + missingWorkflows.map(function (wf) { return wf.name; }).join(" / ") + "。";
    } else if (oldHeadSuccesses.length > 0) {
      overallState = "stale";
      reason = "最新HEAD（" + shortSha(targetSha) + "）の結果はなく、旧HEADの成功記録のみがあります。最新HEADの成功としては扱いません。";
    }

    return {
      targetSha: targetSha,
      targetShortSha: targetSha ? shortSha(targetSha) : "不明",
      targetSource: targetSource,
      capturedAt: generatedAt,
      fetchStatus: fetchStatus,
      state: overallState,
      label: ciLabelForState(overallState),
      tone: ciToneForState(overallState),
      reason: reason,
      workflows: workflows,
      failureWorkflows: failureWorkflows,
      runningWorkflows: runningWorkflows,
      successWorkflows: successWorkflows,
      missingWorkflows: missingWorkflows,
      oldHeadWorkflows: oldHeadWorkflows,
      oldHeadSuccesses: oldHeadSuccesses.slice(0, 8),
      oldHeadSuccessCount: oldHeadSuccesses.length,
      checkSourceNote: "statusCheckRollup は PR の現在の headRefOid に紐づく check として扱います。recentRuns は headSha を照合し、旧HEADの成功は current の成功に数えません。",
    };
  }

  /* ------------------------------------------------------------------ *
   * Provenance
   * ------------------------------------------------------------------ */

  function buildProvenance(mechanical, evaluation, meta) {
    var mech = mechanical || {};
    var git = mech.git || {};
    var github = mech.github || {};
    var pr = github.pr || {};
    var next = mech.nextCodebase || {};
    var ev = evaluation || {};
    var gitHead = asString(git.headSha) || null;
    var githubHead = github.fetchStatus === "ok" ? asString(pr.headRefOid) || null : null;
    var sourceSha = asString(next.headSha) || null;
    var evaluationSha = asString(ev.evaluatedCommitSha) || null;
    var targetSha = githubHead || gitHead || sourceSha || null;
    var targetSource = githubHead ? "GitHub PR headRefOid" : (gitHead ? "git head" : (sourceSha ? "ソース集計HEAD" : null));
    var evaluationMatches = compareSha(evaluationSha, targetSha);
    var sourceMatches = compareSha(sourceSha, targetSha);
    var githubMatchesGit = compareSha(githubHead, gitHead);
    var headMoved = evaluationSha && targetSha ? evaluationSha !== targetSha : null;
    var impact = asString(ev.evaluationImpact) || (headMoved ? "unknown" : "current");
    var warnings = [];

    if (github.fetchStatus === "failed") warnings.push({ code: "github_fetch_failed", severity: "warning", message: "GitHub PR / Actions 情報を取得できません。CI は取得不能として表示します。" });
    if (github.fetchStatus === "skipped") warnings.push({ code: "github_fetch_skipped", severity: "info", message: "GitHub 情報は --skip-github により省略されています。" });
    if (git.fetchStatus === "failed") warnings.push({ code: "git_fetch_failed", severity: "warning", message: "Git 統計を取得できません。" });
    if (githubMatchesGit === false) warnings.push({ code: "github_git_head_mismatch", severity: "warning", message: "GitHub PR の headRefOid と git head が一致しません。CI は GitHub 側を、差分統計は git 側を基準にしています。" });
    if (sourceMatches === false) warnings.push({ code: "source_head_mismatch", severity: "warning", message: "ソース集計の対象HEADがデータ対象HEADと一致しません。行数・@Test数は別時点の値です。" });
    if (next.available === false) warnings.push({ code: "source_unavailable", severity: "warning", message: "next/ のソース集計を取得できません。" });
    if (next.dirty === true) warnings.push({ code: "source_dirty", severity: "info", message: "ソース集計は next/ の作業ツリーを含みます（未コミット変更あり）。" });
    if (!evaluationSha) warnings.push({ code: "evaluation_sha_missing", severity: "warning", message: "定性評価の対象SHAが記録されていません。" });
    if (headMoved) {
      warnings.push({
        code: "evaluation_head_moved",
        severity: impact === "dashboard_only" ? "info" : "warning",
        message: "最新HEADが定性評価の対象SHAから進んでいます。" + (impact === "dashboard_only" ? "next/ の製品コード変更はありません（ダッシュボード・文書・CIのみ）。評価内容への影響は限定的です。" : impact === "code_changed" ? "next/ の製品コード変更があります。評価の更新を検討してください。" : "変更範囲を確認できません。評価の更新を検討してください。"),
      });
    }

    var fetchIncomplete = github.fetchStatus !== "ok" || git.fetchStatus !== "ok" || next.available === false;
    var hasHardMismatch = warnings.some(function (w) {
      return w.code === "github_git_head_mismatch" || w.code === "source_head_mismatch" || w.code === "evaluation_sha_missing";
    });
    var provenanceStatus = hasHardMismatch
      ? "mismatch"
      : (fetchIncomplete ? "unavailable" : (headMoved ? (impact === "dashboard_only" ? "dashboard-only" : "stale") : (targetSha ? "consistent" : "unavailable")));

    return {
      targetSha: targetSha,
      targetShortSha: targetSha ? shortSha(targetSha) : "不明",
      targetSource: targetSource,
      gitHead: gitHead,
      githubHead: githubHead,
      sourceSha: sourceSha,
      evaluationSha: evaluationSha,
      evaluationShortSha: evaluationSha ? shortSha(evaluationSha) : "不明",
      generatedAt: meta && meta.generatedAt ? meta.generatedAt : null,
      evaluatedAt: ev.evaluatedAt || null,
      sourceCapturedAt: next.capturedAt || null,
      matches: {
        githubVsGit: githubMatchesGit,
        githubVsTarget: compareSha(githubHead, targetSha),
        gitVsTarget: compareSha(gitHead, targetSha),
        sourceVsTarget: sourceMatches,
        evaluationVsTarget: evaluationMatches,
      },
      evaluation: {
        headMoved: headMoved,
        impact: impact,
        nonDashboardChangesSinceEvaluation: finiteNumber(ev.nonDashboardChangesSinceEvaluation),
        productFilesChangedSinceEvaluation: finiteNumber(ev.productFilesChangedSinceEvaluation),
        supportingFilesChangedSinceEvaluation: finiteNumber(ev.supportingFilesChangedSinceEvaluation),
      },
      source: {
        available: next.available !== false,
        dirty: next.dirty === true,
        fetchStatus: next.fetchStatus || null,
      },
      warnings: warnings,
      status: provenanceStatus,
    };
  }

  /* ------------------------------------------------------------------ *
   * Issue estimates / next actions
   * ------------------------------------------------------------------ */

  function issuesByPriority(issues) {
    return asArray(issues).slice().sort(function (a, b) {
      var pa = PRIORITY_ORDER[a.priority] === undefined ? 99 : PRIORITY_ORDER[a.priority];
      var pb = PRIORITY_ORDER[b.priority] === undefined ? 99 : PRIORITY_ORDER[b.priority];
      if (pa !== pb) return pa - pb;
      var oa = finiteNumber(a.recommendedOrder);
      var ob = finiteNumber(b.recommendedOrder);
      if (oa !== null && ob !== null && oa !== ob) return oa - ob;
      return asString(a.title).localeCompare(asString(b.title), "ja");
    });
  }

  function summarizeOwnerWork(evaluation) {
    var issues = asArray(evaluation && evaluation.remainingIssues);
    var counts = { agent: 0, owner_device: 0, both: 0, unknown: 0 };
    var official = 0;
    var proposals = 0;
    for (var i = 0; i < issues.length; i += 1) {
      var owner = asString(issues[i].ownerType);
      if (Object.prototype.hasOwnProperty.call(counts, owner)) counts[owner] += 1;
      else counts.unknown += 1;
      if (issues[i].origin === "roadmap_official") official += 1;
      else if (issues[i].origin === "newly_identified") proposals += 1;
    }
    var ordered = issuesByPriority(issues);
    var ownerTasks = ordered.filter(function (issue) { return issue.ownerType === "owner_device"; }).slice(0, 4);
    var agentTasks = ordered.filter(function (issue) { return issue.ownerType === "agent" || issue.ownerType === "both"; }).slice(0, 4);
    return {
      total: issues.length,
      counts: counts,
      officialCount: official,
      proposalCount: proposals,
      ownerTasks: ownerTasks,
      agentTasks: agentTasks,
      estimateNote: "優先度・推奨順序・並行可否・依存関係はエージェントの推定です。公式ロードマップの決定事項ではありません。",
    };
  }

  function summarizeNextActions(evaluation, limit) {
    var max = finiteNumber(limit) === null ? 3 : Math.max(0, Math.min(10, limit));
    var ordered = issuesByPriority(evaluation && evaluation.remainingIssues);
    return ordered.slice(0, max).map(function (issue) {
      return {
        id: asString(issue.id),
        title: asString(issue.title),
        priority: asString(issue.priority),
        ownerType: asString(issue.ownerType),
        ownerLabel: OWNER_LABELS[issue.ownerType] || asString(issue.ownerType) || "担当未設定",
        origin: asString(issue.origin),
        originLabel: issue.origin === "roadmap_official" ? "公式ロードマップ" : (issue.origin === "newly_identified" ? "新規発見（提案）" : "区分不明"),
        recommendedOrder: finiteNumber(issue.recommendedOrder),
        estimate: true,
      };
    });
  }

  /* ------------------------------------------------------------------ *
   * Diff
   * ------------------------------------------------------------------ */

  function delta(previous, current) {
    var from = finiteNumber(previous);
    var to = finiteNumber(current);
    return {
      from: from,
      to: to,
      delta: from !== null && to !== null ? Math.round((to - from) * 10) / 10 : null,
    };
  }

  function featureKey(item) {
    return asString(item.category) + "::" + asString(item.name);
  }

  function diffFeatures(previousItems, currentItems) {
    var prevMap = {};
    var currMap = {};
    var i;
    for (i = 0; i < previousItems.length; i += 1) prevMap[featureKey(previousItems[i])] = previousItems[i];
    for (i = 0; i < currentItems.length; i += 1) currMap[featureKey(currentItems[i])] = currentItems[i];
    var added = [];
    var removed = [];
    var changed = [];
    Object.keys(currMap).forEach(function (key) {
      if (!prevMap[key]) {
        added.push({ key: key, name: currMap[key].name, category: currMap[key].category, implementationStatus: currMap[key].implementationStatus });
        return;
      }
      var fields = [
        ["implementationStatus", "実装"],
        ["verificationStatus", "自動検証"],
        ["deviceAcceptanceStatus", "実機受入"],
        ["disposition", "区分"],
      ];
      for (var f = 0; f < fields.length; f += 1) {
        var field = fields[f][0];
        if (asString(prevMap[key][field]) !== asString(currMap[key][field])) {
          changed.push({
            key: key,
            name: currMap[key].name,
            category: currMap[key].category,
            field: field,
            label: fields[f][1],
            from: asString(prevMap[key][field]),
            to: asString(currMap[key][field]),
          });
        }
      }
    });
    Object.keys(prevMap).forEach(function (key) {
      if (!currMap[key]) removed.push({ key: key, name: prevMap[key].name, category: prevMap[key].category, implementationStatus: prevMap[key].implementationStatus });
    });
    return { added: added, removed: removed, changed: changed };
  }

  function issueKey(issue) {
    return asString(issue.id) || asString(issue.title);
  }

  function diffIssues(previousIssues, currentIssues) {
    var prevMap = {};
    var currMap = {};
    var i;
    for (i = 0; i < previousIssues.length; i += 1) prevMap[issueKey(previousIssues[i])] = previousIssues[i];
    for (i = 0; i < currentIssues.length; i += 1) currMap[issueKey(currentIssues[i])] = currentIssues[i];
    var added = [];
    var removed = [];
    var changed = [];
    Object.keys(currMap).forEach(function (key) {
      if (!prevMap[key]) {
        added.push({ key: key, title: currMap[key].title, priority: currMap[key].priority, ownerType: currMap[key].ownerType });
        return;
      }
      var fields = [
        ["priority", "優先度"],
        ["ownerType", "担当"],
        ["recommendedOrder", "推奨順序"],
        ["origin", "区分"],
      ];
      for (var f = 0; f < fields.length; f += 1) {
        var field = fields[f][0];
        if (String(prevMap[key][field]) !== String(currMap[key][field])) {
          changed.push({
            key: key,
            title: currMap[key].title,
            field: field,
            label: fields[f][1],
            from: prevMap[key][field],
            to: currMap[key][field],
          });
        }
      }
    });
    Object.keys(prevMap).forEach(function (key) {
      if (!currMap[key]) removed.push({ key: key, title: prevMap[key].title, priority: prevMap[key].priority });
    });
    return { added: added, removed: removed, changed: changed };
  }

  function diffAcceptanceRows(previousRows, currentRows) {
    var prevMap = {};
    var currMap = {};
    var i;
    for (i = 0; i < previousRows.length; i += 1) prevMap[asString(previousRows[i].id)] = previousRows[i];
    for (i = 0; i < currentRows.length; i += 1) currMap[asString(currentRows[i].id)] = currentRows[i];
    var changed = [];
    var added = [];
    var removed = [];
    Object.keys(currMap).forEach(function (key) {
      if (!prevMap[key]) {
        added.push({ id: key, title: currMap[key].title, g2Result: currMap[key].g2Result });
        return;
      }
      if (asString(prevMap[key].g2Result) !== asString(currMap[key].g2Result)) {
        changed.push({
          id: key,
          title: currMap[key].title,
          from: asString(prevMap[key].g2Result),
          to: asString(currMap[key].g2Result),
          fromStatus: classifyResultStatus(prevMap[key].g2Result),
          toStatus: classifyResultStatus(currMap[key].g2Result),
        });
      }
    });
    Object.keys(prevMap).forEach(function (key) {
      if (!currMap[key]) removed.push({ id: key, title: prevMap[key].title });
    });
    return { added: added, removed: removed, changed: changed };
  }

  function diffSnapshots(previous, current) {
    if (!isPlainObject(previous) || !isPlainObject(current)) {
      return { available: false, reason: "比較できるデータがありません。" };
    }
    var prevEval = previous.evaluation || {};
    var currEval = current.evaluation || {};
    var prevProgress = computeProgress(prevEval);
    var currProgress = computeProgress(currEval);
    var prevProvenance = buildProvenance(previous.mechanical, prevEval, previous.meta);
    var currProvenance = buildProvenance(current.mechanical, currEval, current.meta);
    var prevCi = resolveCiStatus(previous.mechanical, previous.meta);
    var currCi = resolveCiStatus(current.mechanical, current.meta);
    var prevAcceptance = prevProgress.acceptance;
    var currAcceptance = currProgress.acceptance;
    var features = diffFeatures(asArray(prevEval.featureComparison), asArray(currEval.featureComparison));
    var issues = diffIssues(asArray(prevEval.remainingIssues), asArray(currEval.remainingIssues));
    var acceptance = diffAcceptanceRows(
      asArray((prevEval.acceptanceAndPerformance || {}).acceptanceRows),
      asArray((currEval.acceptanceAndPerformance || {}).acceptanceRows)
    );
    var progress = {
      prototypePct: delta(prevProgress.prototypeCompletionPct, currProgress.prototypeCompletionPct),
      productPct: delta(prevProgress.productReadinessPct, currProgress.productReadinessPct),
      totalCatalogItems: delta(prevProgress.totalCatalogItems, currProgress.totalCatalogItems),
      inScopeItems: delta(prevProgress.inScopeItems, currProgress.inScopeItems),
      outOfScopeItems: delta(prevProgress.outOfScopeItems, currProgress.outOfScopeItems),
      futureConsiderationItems: delta(prevProgress.futureConsiderationItems, currProgress.futureConsiderationItems),
      acceptancePassed: delta(prevAcceptance.passed, currAcceptance.passed),
      acceptanceUnmeasured: delta(prevAcceptance.unmeasured, currAcceptance.unmeasured),
      acceptanceTotal: delta(prevAcceptance.totalItems, currAcceptance.totalItems),
    };
    var changedCount = features.added.length + features.removed.length + features.changed.length +
      issues.added.length + issues.removed.length + issues.changed.length +
      acceptance.added.length + acceptance.removed.length + acceptance.changed.length;
    var ciChanged = prevCi.state !== currCi.state || prevCi.targetSha !== currCi.targetSha;
    var headChanged = prevProvenance.targetSha !== currProvenance.targetSha;
    var evaluationChanged = prevProvenance.evaluationSha !== currProvenance.evaluationSha;
    if (ciChanged) changedCount += 1;
    if (headChanged) changedCount += 1;
    if (evaluationChanged) changedCount += 1;
    if (progress.prototypePct.delta || progress.productPct.delta) changedCount += 1;
    return {
      available: true,
      previousGeneratedAt: previous.meta ? previous.meta.generatedAt : null,
      currentGeneratedAt: current.meta ? current.meta.generatedAt : null,
      previousEvaluationAt: prevEval.evaluatedAt || null,
      currentEvaluationAt: currEval.evaluatedAt || null,
      progress: progress,
      features: features,
      issues: issues,
      acceptance: acceptance,
      ci: {
        fromState: prevCi.state,
        toState: currCi.state,
        fromLabel: prevCi.label,
        toLabel: currCi.label,
        fromTarget: prevCi.targetShortSha,
        toTarget: currCi.targetShortSha,
        changed: ciChanged,
      },
      head: { from: prevProvenance.targetSha, to: currProvenance.targetSha, changed: headChanged },
      evaluation: { from: prevProvenance.evaluationSha, to: currProvenance.evaluationSha, changed: evaluationChanged },
      counts: {
        featuresAdded: features.added.length,
        featuresRemoved: features.removed.length,
        featureStatusChanges: features.changed.length,
        issuesAdded: issues.added.length,
        issuesRemoved: issues.removed.length,
        issueChanges: issues.changed.length,
        acceptanceChanges: acceptance.changed.length,
        total: changedCount,
      },
      hasChanges: changedCount > 0,
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    OWNER_LABELS: OWNER_LABELS,
    isPlainObject: isPlainObject,
    asArray: asArray,
    asString: asString,
    finiteNumber: finiteNumber,
    round1: round1,
    shortSha: shortSha,
    compareSha: compareSha,
    escapeHtml: escapeHtml,
    formatDateJst: formatDateJst,
    parseIsoMs: parseIsoMs,
    stateDefinitions: stateDefinitions,
    stateDef: stateDef,
    classifyResultStatus: classifyResultStatus,
    sanitizeHttpsUrl: sanitizeHttpsUrl,
    sanitizeGithubRepoUrl: sanitizeGithubRepoUrl,
    isSafeRelativePath: isSafeRelativePath,
    buildEvidenceUrl: buildEvidenceUrl,
    validateDashboardData: validateDashboardData,
    computeAcceptance: computeAcceptance,
    computeProgress: computeProgress,
    buildFormulaExplanation: buildFormulaExplanation,
    computeTestSummary: computeTestSummary,
    resolveCiStatus: resolveCiStatus,
    buildProvenance: buildProvenance,
    summarizeOwnerWork: summarizeOwnerWork,
    summarizeNextActions: summarizeNextActions,
    diffSnapshots: diffSnapshots,
    _internal: {
      classifyRunState: classifyRunState,
      classifyCheckState: classifyCheckState,
      featureKey: featureKey,
      issueKey: issueKey,
      latestRunsByWorkflow: latestRunsByWorkflow,
    },
  };
});
