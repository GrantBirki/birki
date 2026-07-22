# birki 💻

My dependency-free personal website.

## Local Development 🔨

Use the exact Node.js version in `.node-version`. Bootstrap validates the runtime and never installs anything.

### Bootstrap

```shell
script/bootstrap
```

### Run

```shell
script/dev
```

### Lint

```shell
script/lint
```

### Test

```shell
script/test
```

### Build 🏗️

```shell
script/build
```

`script/build [source-root] [output-root] [source-sha]` is a Bash-only, allowlist-based release build. It defaults to the repository root, `dist/`, and a `development` identity. CI supplies the exact 40-character source commit and publishes it as `version.txt` with the artifact.

### Preview

```shell
script/preview
```

## Build boundary

The release build is deterministic, offline, and has no package-manager or dependency-install step. Node.js is an explicitly pinned external tool used for development, linting, and tests; GitHub-hosted runners, commit-pinned Actions, and GitHub Pages are the hosting boundary. Repository tests build the same source twice and compare every output file by name and SHA-256 digest.

## Deploy to GitHub Pages 🚀

Pull requests can be deployed with a `.deploy` comment after required checks pass. The `issue_comment` workflow uses trusted build logic from `main`, treats the pull request checkout as data, builds the exact candidate SHA, and verifies that same SHA at `https://birki.io/version.txt` before reporting success.

Normal pushes deploy the exact `main` commit. A manual `workflow_dispatch` rebuilds and redeploys the current `main`, providing a deterministic rollback from a branch deployment without relying on caches.

## Icons 🎨

Icons are local inline SVGs.
