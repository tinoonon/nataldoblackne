/**
 * Utmify — envio de vendas (server-side).
 * POST https://api.utmify.com.br/api-credentials/orders  ·  header x-api-token (NUNCA expor no front)
 * Fluxo Pix: "waiting_payment" ao gerar o Pix e "paid" quando o pagamento é confirmado (mesmo orderId e mesmo createdAt).
 * Falhas aqui nunca derrubam o checkout: só são registradas nos Logs da Vercel.
 */
const pad = (n) => String(n).padStart(2, "0");
/** "YYYY-MM-DD HH:MM:SS" em UTC (formato exigido pela Utmify). */
export const utmifyDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

const TRACK_FIELDS = ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"];
/** Só aceita os campos conhecidos; ausentes = null (a Utmify exige null, não string vazia). */
export function cleanTracking(t = {}) {
  const out = {};
  for (const f of TRACK_FIELDS) {
    const v = t && typeof t[f] === "string" ? t[f].trim().slice(0, 255) : "";
    out[f] = v || null;
  }
  return out;
}

export function createUtmify({ token, apiBase = "https://api.utmify.com.br", platform = "LojaCortinaLED", timeoutMs = 6000, log = console }) {
  const configured = Boolean(token);

  async function send({ orderId, status, createdAt, approvedDate = null, customer, products, tracking, totalCents, ip }) {
    if (!configured) return { skipped: true };
    const body = {
      orderId,
      platform,
      paymentMethod: "pix",
      status,
      createdAt: utmifyDate(createdAt),
      approvedDate: approvedDate ? utmifyDate(approvedDate) : null,
      refundedAt: null,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || null,
        document: customer.cpf || null,
        country: "BR",
        ...(ip && ip !== "?" ? { ip } : {}),
      },
      products: products.map((p) => ({ id: p.id, name: p.name, planId: null, planName: null, quantity: p.qty, priceInCents: p.unitCents })),
      trackingParameters: cleanTracking(tracking),
      // Sem taxa do gateway informada: comissão = valor total (a Utmify aceita; ajuste aqui se quiser descontar a taxa da Profanus).
      commission: { totalPriceInCents: totalCents, gatewayFeeInCents: 0, userCommissionInCents: totalCents },
      isTest: false,
    };
    try {
      const res = await fetch(`${apiBase}/api-credentials/orders`, {
        method: "POST",
        headers: { "x-api-token": token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      if (!res.ok) {
        log.error(`[utmify] ${status} ${orderId} → HTTP ${res.status}: ${text.slice(0, 300)}`);
        return { ok: false, status: res.status };
      }
      log.log(`[utmify] ${status} ${orderId} enviado (utm_source=${body.trackingParameters.utm_source ?? "-"})`);
      return { ok: true };
    } catch (e) {
      log.error(`[utmify] ${status} ${orderId} falhou: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  return { name: "utmify", configured, send };
}
