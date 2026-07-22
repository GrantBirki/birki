import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/.test(name)).sort();
const workflows = await Promise.all(workflowNames.map(async (name) => ({
  body: await readFile(new URL(name, workflowDirectory), "utf8"),
  name,
})));

test("every remote GitHub Action is pinned to a full commit SHA", () => {
  for (const workflow of workflows) {
    for (const line of workflow.body.split("\n").filter((candidate) => /^\s*uses:/.test(candidate))) {
      assert.match(
        line,
        /^\s*uses:\s*(?:\.\/|[^\s@]+@[0-9a-f]{40})(?:\s+#.*)?$/,
        `${workflow.name}: ${line.trim()}`,
      );
    }
  }
});

test("workflows do not install packages or use dependency caches", () => {
  for (const workflow of workflows) {
    assert.doesNotMatch(workflow.body, /\b(?:npm|npx|yarn|pnpm|bun)\b/i, workflow.name);
    assert.doesNotMatch(workflow.body, /^\s*cache:/m, workflow.name);
  }
});

test("branch deployment keeps trusted logic separate from candidate content", () => {
  const workflow = workflows.find(({ name }) => name === "branch-deploy.yml")?.body ?? "";

  assert.match(workflow, /allow_forks: "false"/);
  assert.match(workflow, /commit_verification: "true"/);
  assert.match(workflow, /checks: "all"/);
  assert.match(workflow, /permissions: "admin"/);
  assert.match(workflow, /TRUSTED_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /CANDIDATE_SHA: \$\{\{ needs\.trigger\.outputs\.sha \}\}/);
  assert.match(workflow, /sha_pattern='\^\[0-9a-f\]\{40\}\$'/);
  assert.match(workflow, /path: \$\{\{ steps\.validate\.outputs\.trusted_path \}\}/);
  assert.match(workflow, /path: \$\{\{ steps\.validate\.outputs\.working_path \}\}/);
  assert.match(workflow, /"\$\{GITHUB_WORKSPACE\}\/\$\{TRUSTED_PATH\}\/script\/build"/);
  assert.doesNotMatch(workflow, /\$\{WORKING_PATH\}\/script\//);
  assert.doesNotMatch(workflow, /- name: update command reaction/);
  assert.match(workflow, /result:[\s\S]*?permissions:[\s\S]*?pull-requests: write[\s\S]*?steps:/);
  assert.match(workflow, /- name: complete deployment status\n\s+if: \$\{\{ needs\.trigger\.outputs\.noop != 'true' && needs\.trigger\.outputs\.deployment_id != '' \}\}/);
  assert.match(workflow, /version\.txt\?sha=\$\{EXPECTED_SHA\}/);
});

test("the Node project metadata is dependency-free", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.deepEqual(Object.keys(manifest).sort(), ["name", "private", "type"]);
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");

  for (const file of ["package-lock.json", "tsconfig.json"]) {
    await assert.rejects(readFile(new URL(`../${file}`, import.meta.url)), { code: "ENOENT" });
  }
});

test("earth texture provenance is immutable and documented", async () => {
  const source = await readFile(new URL("../src/earth-map.js", import.meta.url), "utf8");
  const notice = await readFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");
  const blobUrl = "https://github.com/jcubic/ascii-globe/blob/015566a3150ba3f3a72feb008adf7e698945d1ce/src/maps/earth.ts";

  assert.match(source, new RegExp(blobUrl.replaceAll(".", "\\.")));
  assert.match(notice, new RegExp(blobUrl.replaceAll(".", "\\.")));
});
