import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import earthMap from "../src/earth-map.js";
import { configureGlobeGrid, decodeTextureData, renderAsciiGlobe } from "../src/globe.js";

const texture = decodeTextureData(earthMap);

test("desktop globe render stays within its median and p95 budgets", (t) => {
  for (const bounds of [
    { height: 1248, width: 1674 },
    { height: 1440, width: 2560 },
  ]) {
    const result = measureRender(bounds);
    t.diagnostic(`${bounds.width}x${bounds.height} median=${result.median.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms max=${result.maximum.toFixed(2)}ms`);
    assert.ok(result.median < 12, `median render ${result.median.toFixed(2)}ms should stay under 12ms`);
    assert.ok(result.p95 < 24, `p95 render ${result.p95.toFixed(2)}ms should stay under 24ms`);
  }
});

test("mobile globe render stays within its median and p95 budgets", (t) => {
  const result = measureRender({ height: 667, width: 375 });

  t.diagnostic(`mobile median=${result.median.toFixed(2)}ms p95=${result.p95.toFixed(2)}ms max=${result.maximum.toFixed(2)}ms`);
  assert.ok(result.median < 8, `median mobile render ${result.median.toFixed(2)}ms should stay under 8ms`);
  assert.ok(result.p95 < 16, `p95 mobile render ${result.p95.toFixed(2)}ms should stay under 16ms`);
});

function measureRender(bounds) {
  const grid = configureGlobeGrid(bounds);
  const samples = [];

  for (let index = 0; index < 12; index += 1) {
    renderAsciiGlobe({ grid, texture, time: index * 0.25 });
  }

  for (let index = 0; index < 60; index += 1) {
    const start = performance.now();
    renderAsciiGlobe({ grid, texture, time: index * 0.25 });
    samples.push(performance.now() - start);
  }

  samples.sort((first, second) => first - second);
  return {
    maximum: samples.at(-1),
    median: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
  };
}

function percentile(samples, percentileValue) {
  return samples[Math.ceil(samples.length * percentileValue) - 1];
}
