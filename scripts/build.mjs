import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const dist = join(root, "dist");

await rm(dist, { force: true, recursive: true });
await mkdir(join(dist, "assets"), { recursive: true });
await mkdir(join(dist, "vendor"), { recursive: true });
await mkdir(join(dist, "vendor", "addons", "effects"), { recursive: true });

await cp(join(root, "src", "index.html"), join(dist, "index.html"));
await cp(join(root, "src", "styles.css"), join(dist, "styles.css"));
await cp(join(root, "public", "favicon.ico"), join(dist, "favicon.ico"));
await cp(join(root, "public", "manifest.json"), join(dist, "manifest.json"));
await cp(join(root, "CNAME"), join(dist, "CNAME"));
await cp(join(root, "node_modules", "three", "build", "three.module.js"), join(dist, "vendor", "three.module.js"));
await cp(join(root, "node_modules", "three", "build", "three.core.js"), join(dist, "vendor", "three.core.js"));

const asciiEffectSource = join(root, "node_modules", "three", "examples", "jsm", "effects", "AsciiEffect.js");
const asciiEffectDestination = join(dist, "vendor", "addons", "effects", "AsciiEffect.js");
const asciiEffect = await readFile(asciiEffectSource, "utf8");
await writeFile(
  asciiEffectDestination,
  asciiEffect.replace("oCanvas.getContext( '2d' )", "oCanvas.getContext( '2d', { willReadFrequently: true } )"),
);
