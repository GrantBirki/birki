import { createReadStream, existsSync, readFileSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { contentTypeFor, resolveStaticPath } from "./static-files.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distRoot = join(projectRoot, "dist");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const liveReloadClients = new Set();
let building = false;
let pendingBuild = false;
let debounceTimer;

await runBuild("initial");
startServer();
startWatchers();

function startServer() {
  createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname === "/__live-reload") {
      response.writeHead(200, {
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
      });
      response.write("event: ready\ndata: ok\n\n");
      liveReloadClients.add(response);
      request.on("close", () => liveReloadClients.delete(response));
      return;
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = resolveStaticPath(distRoot, requestedPath);

    if (!filePath || !existsSync(filePath)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    if (requestedPath === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(injectReloadScript(readFileSync(filePath, "utf8")));
      return;
    }

    response.writeHead(200, { "content-type": contentTypeFor(filePath) });
    createReadStream(filePath).pipe(response);
  }).listen(port, host, () => {
    console.log(`Dev server listening at http://${host}:${port}`);
  });
}

function startWatchers() {
  const watchTargets = ["src", "public", "CNAME", "THIRD_PARTY_NOTICES.md"];

  for (const target of watchTargets) {
    const absoluteTarget = join(projectRoot, target);

    if (!existsSync(absoluteTarget)) {
      continue;
    }

    watch(
      absoluteTarget,
      { recursive: statSync(absoluteTarget).isDirectory() },
      () => queueBuild(target),
    );
  }
}

function queueBuild(reason) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runBuild(reason).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }, 90);
}

async function runBuild(reason) {
  if (building) {
    pendingBuild = true;
    return;
  }

  building = true;
  pendingBuild = false;
  console.log(`Rebuilding (${reason})...`);

  const code = await new Promise((resolve) => {
    const child = spawn(join(projectRoot, "script", "build"), [], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    child.on("close", resolve);
  });

  building = false;

  if (code !== 0) {
    console.error(`Build failed with exit code ${code}`);
    return;
  }

  notifyReload();

  if (pendingBuild) {
    await runBuild("queued change");
  }
}

function notifyReload() {
  for (const client of liveReloadClients) {
    client.write("event: reload\ndata: ok\n\n");
  }
}

function injectReloadScript(html) {
  const script = [
    "<script>",
    "new EventSource('/__live-reload').addEventListener('reload', () => location.reload());",
    "</script>",
  ].join("");

  return html.replace("</body>", `${script}</body>`);
}
