// Maintainer-only baseline. This measures parsing/sanitization in jsdom;
// it does not measure WebKit paint, editor latency, scrolling or theme cost.
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/measure-markdown-render.mjs REPORT.json');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const { renderMarkdown } = await server.ssrLoadModule('/src/features/editor/markdown.ts');
  const paragraphs = '# 原稿\n\n春の便り。庭の花を見ながら文章を書いています。\n\n';
  const structured = '## 表とコード\n\n| 名前 | 数量 |\n|---|---|\n| りんご | 3 |\n\n```js\nconst count = 3;\n```\n\n';
  const images = '![資料](assets/missing.png)\n\n';
  const results = [];
  for (const [kind, unit] of [['prose', paragraphs], ['structured', structured], ['images', images]]) {
    for (const chars of [100_000, 300_000]) {
      const input = unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars);
      const milliseconds = [];
      let html = '';
      for (let trial = 0; trial < 5; trial++) {
        const start = performance.now();
        html = renderMarkdown(input, { workspaceRoot: '/fixture', documentPath: '/fixture/book.md' });
        milliseconds.push(Math.round((performance.now() - start) * 10) / 10);
      }
      results.push({ kind, chars, htmlChars: html.length, milliseconds, medianMs: [...milliseconds].sort((a,b) => a-b)[2] });
    }
  }
  const report = { node: process.version, scope: 'jsdom parse/sanitize only; no WebKit/editor/theme timing', results };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await server.close(); dom.window.close(); }
