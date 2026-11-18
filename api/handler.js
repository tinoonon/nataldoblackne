/**
 * Função serverless da Vercel. O vercel.json reescreve /api/* para cá (/api/handler?p=<caminho>);
 * aqui restauramos a URL original e delegamos para server/app.js.
 */
import { handleApi } from "../server/app.js";

export default function handler(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.searchParams.get("p");
  if (p !== null) {
    u.searchParams.delete("p");
    req.url = `/api/${p.replace(/^\/+/, "")}${u.search}`;
  }
  return handleApi(req, res);
}
