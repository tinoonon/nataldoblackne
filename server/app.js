/**
 * API da loja (pedidos, Pix Profanus Pay, contato), sem banco e sem webhook, independente de onde roda:
 *  - local:   server/server.js chama handleApi()
 *  - Vercel:  api/[...path].js chama handleApi()
 * Segredos só via variáveis de ambiente (PROFANUS_API_KEY etc.) — nada disso vai para o front.
 */
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createProfanus } from "./providers/profanus.js";
import { createMailer } from "./mailer.js";
import { createOrders, HttpError } from "./orders.js";
import { isValidEmail } from "../public/js/lib/shared.js";

export { HttpError };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.VERCEL) { try { process.loadEnvFile(join(ROOT, ".env")); } catch { /* .env opcional */ } }

const env = process.env;
const PORT = Number(env.PORT || 3000);
export const PUBLIC_URL = (env.PUBLIC_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : `http://localhost:${PORT}`)).replace(/\/$/, "");

export const pix = createProfanus({
  apiKey: env.PROFANUS_API_KEY,
  apiBase: env.PROFANUS_API_BASE || undefined, // só para testes com gateway simulado
});
export const mailer = createMailer({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM, apiBase: env.RESEND_API_BASE });
const orders = createOrders({ pix });

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://connect.facebook.net https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "media-src 'self' https:",
    "connect-src 'self' https://viacep.com.br https://www.facebook.com https://connect.facebook.net https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  ...(PUBLIC_URL.startsWith("https://") ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
};

/* Rate limit em memória (por instância; em serverless é uma proteção parcial). */
const hits = new Map();
function rateLimited(k, limit, windowMs) {
  const t = Date.now();
  const arr = (hits.get(k) || []).filter((x) => t - x < windowMs);
  arr.push(t);
  hits.set(k, arr);
  if (hits.size > 5000) for (const [kk, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(kk);
  return arr.length > limit;
}

const clientIp = (req) => {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return (env.VERCEL || env.TRUST_PROXY === "1" ? fwd : "") || req.socket?.remoteAddress || "?";
};

export const send = (res, status, data, headers = {}) => {
  const body = typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, { ...SECURITY_HEADERS, ...(typeof data === "object" && !Buffer.isBuffer(data) ? { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } : {}), ...headers });
  res.end(body);
};

async function readRaw(req, limit = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, "Requisição muito grande.");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function readJson(req) {
  const raw = await readRaw(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "JSON inválido."); }
}

const UUID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";

async function route(req, res, url) {
  const ip = clientIp(req);
  const method = req.method;
  const path = url.pathname.replace(/\/$/, "");

  if (rateLimited(`api:${ip}`, 120, 60_000)) throw new HttpError(429, "Muitas requisições. Aguarde um instante.");

  if (method === "GET" && path === "/api/health") return send(res, 200, { ok: true, pix: pix.configured });

  if (method === "POST" && path === "/api/orders") {
    if (rateLimited(`draft:${ip}`, 20, 60_000)) throw new HttpError(429, "Muitas tentativas. Aguarde um instante.");
    return send(res, 200, await orders.saveDraft(await readJson(req)));
  }

  let m;
  if ((m = path.match(new RegExp(`^/api/orders/${UUID}$`)))) {
    if (method === "GET") return send(res, 200, await orders.getView(m[1]));
    if (method === "PATCH") return send(res, 200, await orders.saveAddress(m[1], await readJson(req)));
  }
  if ((m = path.match(new RegExp(`^/api/orders/${UUID}/address$`))) && (method === "POST" || method === "PATCH")) return send(res, 200, await orders.saveAddress(m[1], await readJson(req)));
  if ((m = path.match(new RegExp(`^/api/orders/${UUID}/status$`))) && method === "GET") return send(res, 200, await orders.status(m[1]));
  if ((m = path.match(new RegExp(`^/api/orders/${UUID}/pix$`))) && method === "POST") {
    if (rateLimited(`pix:${ip}`, 10, 60_000)) throw new HttpError(429, "Muitas tentativas de gerar Pix. Aguarde um minuto.");
    return send(res, 200, await orders.createPix(m[1], await readJson(req)));
  }

  if (method === "POST" && path === "/api/contact") {
    if (rateLimited(`contact:${ip}`, 5, 600_000)) throw new HttpError(429, "Muitas mensagens. Tente mais tarde.");
    const b = await readJson(req);
    const name = String(b.name ?? "").trim().slice(0, 120), email = String(b.email ?? "").trim().slice(0, 254);
    const message = String(b.message ?? "").trim().slice(0, 2000), order = String(b.order ?? "").trim().slice(0, 40);
    if (!name || !isValidEmail(email) || message.length < 5) throw new HttpError(422, "Preencha nome, e-mail válido e mensagem.");
    // Sem banco: a mensagem vai por e-mail (se RESEND_API_KEY/MAIL_FROM/CONTACT_NOTIFY_EMAIL existirem) e sempre para os Logs da Vercel.
    console.log("[contato]", JSON.stringify({ name, email, order, message }));
    if (env.CONTACT_NOTIFY_EMAIL) {
      mailer.send({ to: env.CONTACT_NOTIFY_EMAIL, subject: `Contato do site: ${name}`, html: `<p><b>${mailer.esc(name)}</b> (${mailer.esc(email)}) — pedido: ${mailer.esc(order) || "-"}</p><p>${mailer.esc(message).replace(/\n/g, "<br>")}</p>` }).catch((e) => console.error("[email] contato:", e.message));
    }
    return send(res, 200, { ok: true });
  }

  throw new HttpError(404, "Rota não encontrada.");
}

/** Handler único da API (usado pelo servidor local e pela função da Vercel). */
export async function handleApi(req, res) {
  try {
    await route(req, res, new URL(req.url, PUBLIC_URL));
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, fields: e.fields });
    console.error("[erro]", e);
    send(res, 500, { error: "Erro interno. Tente novamente." });
  }
}
