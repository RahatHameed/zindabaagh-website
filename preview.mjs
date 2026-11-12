// Builds the site and serves dist/ locally. Usage: node preview.mjs
// Re-run after changing content (or refresh: every page request rebuilds).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain",
};
await build();

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (path === "" || path === ".") path = "index.html";
  else if (!extname(path)) path = path.replace(/[\/\\]+$/, "") + ".html"; // clean URLs, as nginx does with try_files
  const file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    if (path.endsWith(".html")) await build();
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found\n" + (e.code === "ENOENT" ? "" : e.message));
  }
}).listen(4321, "127.0.0.1", () => console.log("Preview: http://localhost:4321"));
