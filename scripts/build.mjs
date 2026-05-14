import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const dist = join(root, "dist");

await rm(dist, { force: true, recursive: true });
await mkdir(join(dist, "assets"), { recursive: true });

await cp(join(root, "src", "index.html"), join(dist, "index.html"));
await cp(join(root, "src", "styles.css"), join(dist, "styles.css"));
await cp(join(root, "public", "favicon.ico"), join(dist, "favicon.ico"));
await cp(join(root, "public", "manifest.json"), join(dist, "manifest.json"));
await cp(join(root, "CNAME"), join(dist, "CNAME"));
await cp(join(root, "THIRD_PARTY_NOTICES.md"), join(dist, "THIRD_PARTY_NOTICES.md"));
