import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import earthMap from "../src/earth-map.js";
import { configureGlobeGrid, decodeTextureData, renderAsciiGlobe } from "../src/globe.js";

const texture = decodeTextureData(earthMap);

test("desktop globe render stays within the 30 FPS frame budget", (t) => {
  const grid = configureGlobeGrid({ height: 1248, width: 1674 });
  const samples = [];

  for (let i = 0; i < 4; i += 1) {
    renderAsciiGlobe({ grid, reducedMotion: false, texture, time: i });
  }

  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    renderAsciiGlobe({ grid, reducedMotion: false, texture, time: i * 0.25 });
    samples.push(performance.now() - start);
  }

  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const worst = Math.max(...samples);

  t.diagnostic(`desktop ASCII render mean=${mean.toFixed(2)}ms worst=${worst.toFixed(2)}ms`);
  assert.ok(mean < 16, `mean render ${mean.toFixed(2)}ms should stay under 16ms`);
  assert.ok(worst < 33, `worst render ${worst.toFixed(2)}ms should leave room for browser work`);
});

test("mobile globe render has ample headroom", (t) => {
  const grid = configureGlobeGrid({ height: 667, width: 375 });
  const samples = [];

  for (let i = 0; i < 30; i += 1) {
    const start = performance.now();
    renderAsciiGlobe({ grid, reducedMotion: false, texture, time: i * 0.25 });
    samples.push(performance.now() - start);
  }

  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const worst = Math.max(...samples);

  t.diagnostic(`mobile ASCII render mean=${mean.toFixed(2)}ms worst=${worst.toFixed(2)}ms`);
  assert.ok(mean < 10, `mean mobile render ${mean.toFixed(2)}ms should stay under 10ms`);
  assert.ok(worst < 24, `worst mobile render ${worst.toFixed(2)}ms should leave room for browser work`);
});
