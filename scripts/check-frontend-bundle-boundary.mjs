import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Run against the generated output, e.g.:
// node scripts/check-frontend-bundle-boundary.mjs dist app-store
// Without a lane argument, use the same environment selection as vite.config.ts.
const [directory, requestedLane] = process.argv.slice(2);
const lane = requestedLane ?? (
  process.env.VITE_HAZAKURA_DISTRIBUTION_LANE === "app-store" ||
  process.env.HAZAKURA_DISTRIBUTION_LANE === "app-store" ? "app-store" : "developer"
);
const usage = "Usage: check-frontend-bundle-boundary.mjs <output-directory> [app-store|developer]";
if (directory === "--help") {
  console.log(usage);
  process.exit(0);
}
assert(directory && ["app-store", "developer"].includes(lane),
  usage);
const root = resolve(directory);

function outputFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? outputFiles(path) : [path];
  });
}

const files = outputFiles(root);
const javascript = files.filter((path) => path.endsWith(".js"));
const stylesheets = files.filter((path) => path.endsWith(".css"));
assert(existsSync(join(root, "index.html")), "Main entry must be present");
assert(existsSync(join(root, "apple-assist.html")), "Local Assist entry must be present");
assert(javascript.length > 0 && stylesheets.length > 0, "Built JS and CSS must be present");

const js = javascript.map((path) => readFileSync(path, "utf8")).join("\n");
const css = stylesheets.map((path) => readFileSync(path, "utf8")).join("\n");

const hasAgentEntry = existsSync(join(root, "agent.html"));
const hasAgentStyles = css.includes(".agent-window-shell") || css.includes(".agent-terminal-host");
const hasXtermScript = js.includes("xterm-helper-textarea");
const hasXtermStyles = css.includes(".xterm-helper-textarea");
for (const [name, present] of Object.entries({ hasAgentEntry, hasAgentStyles, hasXtermScript, hasXtermStyles })) {
  assert.equal(present, lane === "developer", `${lane}: ${name}`);
}
assert(!js.includes("build:app-store-pkg"), "Build scripts from package.json must not be bundled");

const bytes = (paths) => paths.reduce((total, path) => total + statSync(path).size, 0);
console.log(JSON.stringify({ lane, jsBytes: bytes(javascript), cssBytes: bytes(stylesheets),
  ...{ hasAgentEntry, hasAgentStyles, hasXtermScript, hasXtermStyles } }, null, 2));
