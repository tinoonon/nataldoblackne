/**
 * Provedor de Pix: Profanus Pay.
 * Base URL: https://profanuspay.com  ·  Auth: header x-api-key (NUNCA expor no front).
 *
 * Endpoints usados:
 *  - POST /api/pix/create  → gera a cobrança (external_id = chave de idempotência)
 *  - GET  /api/pix/{id}    → consulta (aceita UUID, txid ou external_id) — fonte da verdade
 *  - Webhook payment.confirmed assinado com HMAC-SHA256 (header X-Webhook-Signature: t=<unix>,v1=<hex>)
 *
 * Sem banco de dados e sem webhook: o estado do pagamento vive na própria Profanus (consultado por external_id).
 * Única configuração necessária: a variável de ambiente PROFANUS_API_KEY.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createProfanus({
  apiKey,
  apiBase = "https://profanuspay.com",
  attempts = 3,
  timeoutMs = 7000,
}) {
  const configured = Boolean(apiKey);

  /** Chamada com retry exponencial só para falhas transitórias (rede, 429, 5xx). */
  async function call(path, { method = "GET", body } = {}) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      if (i) await sleep(400 * 2 ** (i - 1) + Math.random() * 200);
      try {
        const res = await fetch(`${apiBase}${path}`, {
          method,
          headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) return data;
        const err = new Error(`Profanus Pay ${res.status}: ${data.error || data.message || "erro"}`);
        err.status = res.status;
        err.details = data;
        // 401/400/404/409 não adianta repetir; 429 e 5xx (inclui 502 do gateway) podem passar.
        if (res.status === 429 || res.status >= 500) { lastErr = err; continue; }
        throw err;
      } catch (e) {
        if (e.status) throw e; // erro HTTP definitivo
        lastErr = e; // timeout / rede: tenta de novo
      }
    }
    throw lastErr;
  }

  const normalize = (p) => ({
    id: String(p.id),
    status: p.status, // pending | paid | expired | cancelled
    amountCents: Math.round(Number(p.amount) * 100),
    externalReference: UUID_RE.test(p.external_id || "") ? p.external_id.slice(0, 36) : null,
    code: p.pix_copia_cola || null,
    qrBase64: p.qr_code_base64 ? String(p.qr_code_base64).replace(/^data:image\/\w+;base64,/, "") : null,
    expiresAt: p.expires_at ? new Date(p.expires_at) : null,
  });

  return {
    name: "profanus",
    configured,

    /**
     * external_id = "<orderId>_<tentativa>": reenviar o mesmo external_id devolve a MESMA cobrança
     * (idempotência no gateway), então retry/duplo clique nunca cobra duas vezes.
     */
    async createPix({ amountCents, description, externalId, expiresAt }) {
      if (amountCents < 100) throw new Error("Valor mínimo do Pix na Profanus Pay é R$ 1,00.");
      const payload = {
        amount: Number((amountCents / 100).toFixed(2)),
        description,
        external_id: externalId,
        expiration: Math.max(60, Math.round((expiresAt.getTime() - Date.now()) / 1000)),
      };
      let data;
      try {
        data = await call("/api/pix/create", { method: "POST", body: payload });
      } catch (e) {
        // 409: external_id já existe mas não pôde ser devolvido → busca a cobrança existente.
        if (e.status !== 409) throw e;
        const existing = await call(`/api/pix/${encodeURIComponent(externalId)}`);
        data = { transaction: existing };
      }
      const t = normalize(data.transaction || {});
      if (!t.code) throw new Error("Profanus Pay não retornou o código Pix.");
      return { ...t, expiresAt: t.expiresAt || expiresAt };
    },

    /** Consulta direto no gateway (fonte da verdade). Aceita UUID, txid ou external_id. Retorna null se não existir. */
    async getPayment(id) {
      try {
        return normalize(await call(`/api/pix/${encodeURIComponent(id)}`));
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },
  };
}
