import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { contentTypeFor, resolveStaticPath } from "../scripts/static-files.mjs";

const indexHtml = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const stylesCss = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const mainScript = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const buildScript = await readFile(new URL("../script/build", import.meta.url), "utf8");

test("page has the expected metadata, landmark, and heading structure", () => {
  assert.match(indexHtml, /<html lang="en">/);
  assert.match(indexHtml, /<title>Grant Birki — Security Engineer &amp; Systems Builder<\/title>/);
  assert.match(indexHtml, /name="description"/);
  assert.match(indexHtml, /<main class="site-shell" aria-label="Grant Birki landing page">/);
  assert.match(indexHtml, /<section class="hero-surface" aria-labelledby="site-title">/);
  assert.equal(indexHtml.match(/<h1\b/g)?.length, 1);
  assert.match(indexHtml, /<h1 id="site-title">/);
});

test("decorative visual layers are hidden from assistive technology", () => {
  assert.match(indexHtml, /<div class="ambient-grid" aria-hidden="true">/);
  assert.match(indexHtml, /<div class="ascii-globe" aria-hidden="true">/);
  assert.equal(indexHtml.match(/<svg\b[^>]*aria-hidden="true"/g)?.length, 5);
});

test("profile links stay in the current tab and retain visible labels", () => {
  const anchors = [...indexHtml.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)];

  assert.equal(anchors.length, 5);
  for (const [anchor] of anchors) {
    assert.doesNotMatch(anchor, /\btarget=/);
    assert.doesNotMatch(anchor, /href="javascript:/i);
    assert.match(anchor, /<span>[A-Za-z]+<\/span>/);
  }
});

test("no external CDN or remote asset is loaded by the page shell", () => {
  const assetUrls = [...indexHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(assetUrls, [
    "./favicon.ico",
    "./manifest.json",
    "./styles.css",
    "./assets/main.js",
  ]);
});

test("layout reflows vertically and keyboard focus surrounds the full target", () => {
  assert.match(stylesCss, /overflow-x: hidden;/);
  assert.match(stylesCss, /overflow-y: auto;/);
  assert.match(stylesCss, /\.site-shell \{[\s\S]*?min-height: 100svh;/);
  assert.match(stylesCss, /\.hero-surface \{[\s\S]*?min-height: 100svh;/);
  assert.match(stylesCss, /\.link-grid a:focus-visible \{[\s\S]*?outline: 2px solid var\(--lavender-deep\);/);
  assert.match(stylesCss, /--lavender-deep: #4f56d9;/);
  assert.doesNotMatch(stylesCss, /\.hero-surface::before/);
  assert.doesNotMatch(stylesCss, /text-shadow: 0 0 24px/);
});

test("important text and focus colors meet their contrast targets", () => {
  assert.ok(contrastRatio("#4f56d9", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#1d2029", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#4f56d9", "#ffffff") >= 3);
});

test("globe animation does not branch on reduced-motion preferences", () => {
  assert.doesNotMatch(mainScript, /matchMedia|prefers-reduced-motion/);
});

test("essential page assets remain under the compressed transfer budget", async (t) => {
  const assetUrls = [
    "../src/index.html",
    "../src/styles.css",
    "../src/earth-map.js",
    "../src/globe.js",
    "../src/main.js",
  ];
  const sizes = await Promise.all(assetUrls.map(async (url) => gzipSync(await readFile(new URL(url, import.meta.url))).length));
  const total = sizes.reduce((sum, size) => sum + size, 0);

  t.diagnostic(`essential gzip transfer=${total} bytes`);
  assert.ok(total <= 20 * 1024, `essential compressed assets use ${total} bytes`);
});

test("build output includes required third-party notices", () => {
  assert.match(buildScript, /THIRD_PARTY_NOTICES\.md/);
});

test("static file helper rejects paths outside the served root", () => {
  const root = "/repo/dist";

  assert.equal(resolveStaticPath(root, "/index.html"), "/repo/dist/index.html");
  assert.equal(resolveStaticPath(root, "/../secret.txt"), null);
  assert.equal(resolveStaticPath(root, "../secret.txt"), null);
  assert.equal(contentTypeFor("/repo/dist/THIRD_PARTY_NOTICES.md"), "text/markdown; charset=utf-8");
});

function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  return channels
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
