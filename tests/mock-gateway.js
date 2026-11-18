/**
 * Gateway SIMULADO apenas para testes automatizados (Profanus Pay + Resend).
 * Nunca é usado em produção: o servidor só aponta para cá se PROFANUS_API_BASE/RESEND_API_BASE forem definidos.
 */
import { createServer } from "node:http";

export function startMockGateway(port) {
  const txs = new Map(); // id -> transação
  const emails = [];
  let seq = 5000;

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const json = (s, d) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(d)); };
    const url = new URL(req.url, "http://x");

    if (url.pathname.startsWith("/api/") && req.headers["x-api-key"] !== "TEST_KEY") return json(401, { error: "API Key invalida" });

    if (req.method === "POST" && url.pathname === "/api/pix/create") {
      if (!(body.amount >= 1)) return json(400, { error: "amount invalido" });
      for (const t of txs.values()) if (t.external_id === body.external_id) return json(200, { success: true, transaction: t });
      const id = `tx-${++seq}`;
      const t = {
        id, txid: String(seq), external_id: body.external_id, amount: body.amount, fee: 0.99, status: "pending",
        pix_copia_cola: `00020126MOCKPIX${seq}6304ABCD`,
        qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        expires_at: new Date(Date.now() + (body.expiration || 1800) * 1000).toISOString(),
        _request: body,
      };
      txs.set(id, t);
      return json(200, { success: true, transaction: t });
    }
    let m;
    if (req.method === "GET" && (m = url.pathname.match(/^\/api\/pix\/(.+)$/))) {
      const key = decodeURIComponent(m[1]);
      const t = txs.get(key) || [...txs.values()].find((x) => x.external_id === key || x.txid === key);
      return t ? json(200, t) : json(404, { error: "Transacao nao encontrada" });
    }
    if (req.method === "POST" && url.pathname === "/emails") { emails.push(body); return json(200, { id: "mail_1" }); }
    // controles de teste
    if (url.pathname === "/__approve") { const t = txs.get(url.searchParams.get("id")); t.status = url.searchParams.get("status") || "paid"; if (url.searchParams.get("amount")) t.amount = Number(url.searchParams.get("amount")); return json(200, { ok: true }); }
    if (url.pathname === "/__state") return json(200, { payments: [...txs.values()], emails });
    json(404, { error: "not found" });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
