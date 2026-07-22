import assert from "node:assert/strict";
import { test } from "node:test";
import earthMap from "../src/earth-map.js";
import {
  calculateOrientation,
  configureGlobeGrid,
  decodeTextureData,
  degToRad,
  glyphForCell,
  renderAsciiGlobe,
  sampleEarth,
} from "../src/globe.js";

const texture = decodeTextureData(earthMap);

test("decodes the bundled earth texture into a bounded mask", () => {
  assert.equal(texture.width, 330);
  assert.equal(texture.height, 165);
  assert.equal(texture.mask.length, texture.width * texture.height);
  assert.ok(texture.mask.some((value) => value > 0), "texture should include land/coast data");
});

test("rejects truncated texture data before allocating a mask", () => {
  const truncated = btoa(String.fromCharCode(0, 10, 0, 10));

  assert.throws(
    () => decodeTextureData(truncated),
    /truncated/,
  );
});

test("configures a centered globe that fits inside a desktop viewport", () => {
  const bounds = { height: 1248, width: 1674 };
  const grid = configureGlobeGrid(bounds);

  assert.equal(grid.fontSize, 10.5);
  assert.ok(grid.radius * 2 < bounds.height, "globe diameter should fit in viewport height");
  assert.ok(grid.columns * grid.cellWidth > bounds.width, "ASCII field should cover viewport width");
  assert.ok(grid.rows * grid.cellHeight > bounds.height, "ASCII field should cover viewport height");
});

test("renders fixed-width ASCII with visible content", () => {
  const grid = configureGlobeGrid({ height: 720, width: 1280 });
  const frame = renderAsciiGlobe({ grid, reducedMotion: false, texture, time: 0 });
  const lines = frame.text.split("\n");
  const lengths = new Set(lines.map((line) => line.length));

  assert.equal(lines.length, grid.rows);
  assert.deepEqual([...lengths], [grid.columns]);
  assert.match(frame.text, /[01:.]/);
});

test("glyph selection is stable for fixed earth coordinates", () => {
  const first = glyphForCell(0.72, -1.31, 0.55, 80, 40, texture);
  const second = glyphForCell(0.72, -1.31, 0.55, 80, 40, texture);

  assert.equal(first, second);
});

test("low-confidence coast samples render fine detail without binary overfill", () => {
  const edgeTexture = { height: 1, mask: Uint8Array.of(140), width: 1 };
  const landTexture = { height: 1, mask: Uint8Array.of(210), width: 1 };

  assert.match(glyphForCell(0, 0, 0.5, 0, 0, edgeTexture), /^[.: ]$/);
  assert.match(glyphForCell(0, 0, 0.5, 0, 0, landTexture), /^[01+*x=%]$/);
});

test("open ocean cells remain visually quiet", () => {
  const oceanTexture = { height: 1, mask: Uint8Array.of(0), width: 1 };

  assert.equal(glyphForCell(0, 0, 0.5, 12, 8, oceanTexture), " ");
});

test("starts with a northern hemisphere bias and later drifts through southern views", () => {
  const first = calculateOrientation(0, false);
  const sampledTilts = [0, 80, 160, 240, 320].map((time) => calculateOrientation(time, false).axialTilt);

  assert.ok(first.axialTilt < degToRad(-30), "initial tilt should favor the northern hemisphere");
  assert.ok(Math.min(...sampledTilts) < degToRad(-30), "drift should include northern views");
  assert.ok(Math.max(...sampledTilts) > degToRad(30), "drift should include southern views");
});

test("reduced motion keeps the rendered frame stable across time", () => {
  const grid = configureGlobeGrid({ height: 667, width: 375 });
  const first = renderAsciiGlobe({ grid, reducedMotion: true, texture, time: 0 }).text;
  const later = renderAsciiGlobe({ grid, reducedMotion: true, texture, time: 500 }).text;

  assert.equal(first, later);
});

test("earth sampling wraps longitude at the dateline", () => {
  const west = sampleEarth(texture, 0, -Math.PI);
  const east = sampleEarth(texture, 0, Math.PI);

  assert.equal(west, east);
});
