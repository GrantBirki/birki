import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { contentTypeFor, resolveStaticPath } from "./static-files.mjs";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const host = process.env.HOST ?? "127.0.0.1";

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolveStaticPath(root, requestedPath);

  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "content-type": contentTypeFor(filePath) });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Preview server listening at http://${host}:${port}`);
});
