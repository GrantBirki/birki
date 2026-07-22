import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { contentTypeFor, resolveStaticPath } from "../scripts/static-files.mjs";

const indexHtml = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const stylesCss = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const buildScript = await readFile(new URL("../script/build", import.meta.url), "utf8");

test("page has the expected accessible landmark and heading structure", () => {
  assert.match(indexHtml, /<html lang="en">/);
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

test("external links are safe new-tab links with visible labels", () => {
  const externalAnchors = [...indexHtml.matchAll(/<a\b[^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/g)];

  assert.equal(externalAnchors.length, 4);

  for (const [anchor] of externalAnchors) {
    assert.match(anchor, /rel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b[^"]*"/);
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

test("keyboard focus has a visible outline treatment", () => {
  assert.match(stylesCss, /\.link-grid a:focus-visible \.icon-box/);
  assert.match(stylesCss, /outline: 1\.5px solid rgba\(100, 107, 255, 0\.58\);/);
  assert.match(stylesCss, /outline-offset: 2px;/);
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
