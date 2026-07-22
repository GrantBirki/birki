import assert from "node:assert/strict";
import { test } from "node:test";
import earthMap from "../src/earth-map.js";
import {
  AsciiGlobe,
  calculateOrientation,
  configureGlobeGrid,
  decodeTextureData,
  degToRad,
  glyphForCell,
  globeMotion,
  hashCoordinate,
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

test("configures a cropped, centered desktop globe with precomputed row geometry", () => {
  const bounds = { height: 1248, width: 1674 };
  const grid = configureGlobeGrid(bounds);
  const oldFieldCells = (Math.ceil(bounds.width / grid.cellWidth) + 2)
    * (Math.ceil(bounds.height / grid.cellHeight) + 2);

  assert.equal(grid.fontSize, 9.25);
  assert.equal(grid.rowSpans.length, grid.rows);
  assert.ok(grid.columns * grid.cellWidth < bounds.width, "cropped field should be narrower than viewport");
  assert.ok(grid.rows * grid.cellHeight < bounds.height, "cropped field should be shorter than viewport");
  assert.ok(grid.columns * grid.rows < oldFieldCells * 0.8, "cropping should remove off-globe cells");

  for (const span of grid.rowSpans) {
    assert.equal(span.x.length, span.z.length);
    assert.equal(span.x.length, span.radiusSquared.length);
    assert.equal(span.x.length, span.endColumn - span.startColumn);
    assert.ok([...span.radiusSquared].every((value) => value <= 1.000_001));
  }
});

test("renders fixed-width cropped ASCII with visible content", () => {
  const grid = configureGlobeGrid({ height: 720, width: 1280 });
  const frame = renderAsciiGlobe({ grid, texture, time: 0 });
  const lines = frame.text.split("\n");
  const lengths = new Set(lines.map((line) => line.length));

  assert.equal(lines.length, grid.rows);
  assert.deepEqual([...lengths], [grid.columns]);
  assert.equal(frame.text.length, grid.rows * grid.columns + grid.rows - 1);
  assert.match(frame.text, /[01:.]/);
});

test("glyph selection and integer hashing are deterministic", () => {
  const first = glyphForCell(0.72, -1.31, 0.55, 80, 40, texture);
  const second = glyphForCell(0.72, -1.31, 0.55, 80, 40, texture);

  assert.equal(first, second);
  assert.equal(hashCoordinate(-31, 72, 0), hashCoordinate(-31, 72, 0));
  assert.notEqual(hashCoordinate(-31, 72, 0), hashCoordinate(-31, 73, 0));
  assert.ok(hashCoordinate(-31, 72, 0) >= 0 && hashCoordinate(-31, 72, 0) < 1);
});

test("coast samples retain fine detail without binary overfill", () => {
  const edgeTexture = { height: 1, mask: Uint8Array.of(140), width: 1 };
  const landTexture = { height: 1, mask: Uint8Array.of(210), width: 1 };

  assert.match(glyphForCell(0, 0, 0.5, 0, 0, edgeTexture), /^[.: ]$/);
  assert.match(glyphForCell(0, 0, 0.5, 0, 0, landTexture), /^[01+*x=%]$/);
});

test("open ocean cells remain visually quiet", () => {
  const oceanTexture = { height: 1, mask: Uint8Array.of(0), width: 1 };

  assert.equal(glyphForCell(0, 0, 0.5, 12, 8, oceanTexture), " ");
});

test("gentle drift uses the exact rotation, tilt, roll, and frame-rate limits", () => {
  const first = calculateOrientation(0);
  const maximumTiltTime = Math.PI / globeMotion.axialDriftRadiansPerSecond;
  const maximumRollTime = (Math.PI / 2) / globeMotion.rollRadiansPerSecond;

  assert.equal(globeMotion.framesPerSecond, 24);
  assert.equal(AsciiGlobe.targetFrameMs, 1000 / globeMotion.framesPerSecond);
  assert.ok(closeTo(first.rotation, degToRad(32)));
  assert.ok(closeTo(first.axialTilt, degToRad(-27.4)));
  assert.ok(closeTo(first.roll, 0));
  assert.ok(closeTo(calculateOrientation(10).rotation - first.rotation, 2));
  assert.ok(closeTo(calculateOrientation(maximumTiltTime).axialTilt, degToRad(-19.4)));
  assert.ok(closeTo(calculateOrientation(maximumRollTime).roll, degToRad(2)));
});

test("globe continues animating across time", () => {
  const grid = configureGlobeGrid({ height: 667, width: 375 });
  const first = renderAsciiGlobe({ grid, texture, time: 0 }).text;
  const later = renderAsciiGlobe({ grid, texture, time: 20 }).text;

  assert.notEqual(first, later);
});

test("bilinear earth sampling wraps longitude and interpolates neighboring texels", () => {
  const smallTexture = {
    height: 2,
    mask: Uint8Array.of(0, 100, 200, 255),
    width: 2,
  };
  const interpolated = sampleEarth(smallTexture, 0, -Math.PI / 2);

  assert.ok(closeTo(interpolated, 138.75 / 255));
  assert.equal(sampleEarth(smallTexture, 0, -Math.PI), sampleEarth(smallTexture, 0, Math.PI));
  assert.equal(sampleEarth(smallTexture, Math.PI, -Math.PI), 0);
  assert.equal(sampleEarth(smallTexture, -Math.PI, -Math.PI), 200 / 255);
});

function closeTo(actual, expected, tolerance = 1e-10) {
  return Math.abs(actual - expected) <= tolerance;
}
