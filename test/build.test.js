import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const buildScript = join(repoRoot, "script", "build");
const fixedSha = "0123456789abcdef0123456789abcdef01234567";
const expectedFiles = [
  "CNAME",
  "THIRD_PARTY_NOTICES.md",
  "assets/earth-map.js",
  "assets/globe.js",
  "assets/main.js",
  "favicon.ico",
  "index.html",
  "manifest.json",
  "styles.css",
  "version.txt",
];

test("build output is deterministic and contains only the release allowlist", async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "birki-build-"));
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const first = join(temporaryRoot, "first");
  const second = join(temporaryRoot, "second");

  await runBuild(repoRoot, first, fixedSha);
  await runBuild(repoRoot, second, fixedSha);

  assert.deepEqual(await listFiles(first), expectedFiles);
  assert.deepEqual(await listFiles(second), expectedFiles);
  assert.equal(await digestTree(first), await digestTree(second));
  assert.equal(await readFile(join(first, "version.txt"), "utf8"), `${fixedSha}\n`);
});

test("build accepts output paths containing spaces", async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "birki-build-spaces-"));
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const output = join(temporaryRoot, "output with spaces");

  await runBuild(repoRoot, output, fixedSha);
  assert.deepEqual(await listFiles(output), expectedFiles);
});

test("build rejects malformed identity and unsafe filesystem inputs", async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "birki-build-safety-"));
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }));

  await assert.rejects(runBuild(repoRoot, join(temporaryRoot, "bad-sha"), "main"), /source SHA/);

  const sourceLink = join(temporaryRoot, "source-link");
  await symlink(repoRoot, sourceLink);
  await assert.rejects(runBuild(sourceLink, join(temporaryRoot, "linked-source"), fixedSha), /symlink/);

  const fixture = join(temporaryRoot, "fixture");
  await createFixture(fixture);
  await assert.rejects(runBuild(fixture, join(fixture, "assets"), fixedSha), /only dist/);

  await rm(join(fixture, "CNAME"));
  await symlink(join(repoRoot, "CNAME"), join(fixture, "CNAME"));
  await assert.rejects(runBuild(fixture, join(temporaryRoot, "linked-file"), fixedSha), /symlink/);
});

async function runBuild(source, output, sha) {
  return execFileAsync("bash", [buildScript, source, output, sha], { cwd: repoRoot });
}

async function createFixture(root) {
  const files = [
    "CNAME",
    "THIRD_PARTY_NOTICES.md",
    "public/favicon.ico",
    "public/manifest.json",
    "src/earth-map.js",
    "src/globe.js",
    "src/index.html",
    "src/main.js",
    "src/styles.css",
  ];

  for (const file of files) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(repoRoot, file), destination);
  }
}

async function listFiles(root) {
  const entries = [];

  async function walk(directory) {
    for (const name of await readdir(directory)) {
      const absolutePath = join(directory, name);
      const metadata = await lstat(absolutePath);

      if (metadata.isDirectory()) {
        await walk(absolutePath);
      } else {
        entries.push(relative(root, absolutePath));
      }
    }
  }

  await walk(root);
  return entries.sort();
}

async function digestTree(root) {
  const digest = createHash("sha256");

  for (const file of await listFiles(root)) {
    digest.update(file);
    digest.update("\0");
    digest.update(await readFile(join(root, file)));
    digest.update("\0");
  }

  return digest.digest("hex");
}
