import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { handleApi, send, HttpError, PUBLIC_URL, pix } from "./app.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = join(ROOT, "public");

/* ------------------------- Arquivos estáticos ------------------------- */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".xml": "application/xml",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg", ".txt", ".xml"]);
const gzCache = new Map();

async function resolveFile(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  if (rel.includes("\0")) return null;
  const base = normalize(join(PUBLIC_DIR, rel));
  if (!base.startsWith(PUBLIC_DIR)) return null;
  for (const cand of [base, `${base}.html`, join(base, "index.html")]) {
    try {
      const s = await stat(cand);
      if (s.isFile() && !cand.split("/").some((p) => p.startsWith(".") && p !== "")) return { file: cand, mtime: s.mtimeMs };
    } catch { /* tenta o próximo */ }
  }
  return null;
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Método não permitido", { "Content-Type": "text/plain" });
  const found = await resolveFile(url.pathname);
  if (!found) {
    const nf = await readFile(join(PUBLIC_DIR, "404.html")).catch(() => "<h1>404</h1>");
    return send(res, 404, nf, { "Content-Type": "text/html; charset=utf-8" });
  }
  const ext = extname(found.file).toLowerCase();
  let body = await readFile(found.file);
  const headers = { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": [".html", ".js", ".css", ".json"].includes(ext) ? "no-cache" : "public, max-age=86400" };
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] || "") && body.length > 1024) {
    const key = `${found.file}:${found.mtime}`;
    if (!gzCache.has(key)) gzCache.set(key, gzipSync(body));
    body = gzCache.get(key);
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  }
  if (req.method === "HEAD") return send(res, 200, "", headers);
  send(res, 200, body, headers);
}

/* ------------------------- Servidor ------------------------- */
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, PUBLIC_URL);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res);
    await serveStatic(req, res, url);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, fields: e.fields });
    console.error("[erro]", e);
    send(res, 500, { error: "Erro interno. Tente novamente." });
  }
});

server.listen(PORT, () => {
  console.log(`Loja no ar: ${PUBLIC_URL}  (porta ${PORT})`);
  if (!pix.configured) console.warn("⚠ PROFANUS_API_KEY não configurada: o Pix NÃO será gerado até você preencher o .env");
});
