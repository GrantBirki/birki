import { extname, isAbsolute, join, normalize, relative } from "node:path";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
]);

export function contentTypeFor(filePath) {
  return contentTypes.get(extname(filePath)) ?? "application/octet-stream";
}

export function resolveStaticPath(root, requestedPath) {
  const filePath = normalize(join(root, requestedPath));
  const relativePath = relative(root, filePath);

  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}
