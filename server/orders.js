/**
 * Pedidos SEM banco de dados (ideal para a Vercel com só PROFANUS_API_KEY):
 *  - O navegador guarda carrinho/dados/endereço (localStorage) e reenvia ao gerar o Pix.
 *  - O servidor recalcula preço e frete a partir de public/js/config.js (o cliente não define valores).
 *  - O Pix é criado com external_id = "<pedido>_<tentativa>"; o status é sempre lido na Profanus Pay
 *    (fonte da verdade). Reenviar o mesmo external_id devolve a mesma cobrança (idempotente).
 *  - Os dados do pedido (nome, telefone, endereço) vão resumidos na descrição do Pix, para você ver
 *    no painel da Profanus quem pagou e para onde enviar.
 */
import { randomUUID } from "node:crypto";
import { config } from "../public/js/config.js";
import { calcTotals, digits, validateAddress, validateCustomer } from "../public/js/lib/shared.js";

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 6; // novos Pix por pedido (após expirar)
export const orderNumber = (id) => `${config.orderPrefix}-${id.slice(0, 6).toUpperCase()}`;

const clean = {
  customer: (c) => ({
    name: String(c?.name ?? "").trim().replace(/\s+/g, " "),
    email: String(c?.email ?? "").trim().toLowerCase(),
    cpf: digits(c?.cpf),
    phone: digits(c?.phone),
  }),
  address: (a) => ({
    cep: digits(a?.cep),
    street: String(a?.street ?? "").trim(),
    number: String(a?.number ?? "").trim(),
    complement: String(a?.complement ?? "").trim(),
    district: String(a?.district ?? "").trim(),
    city: String(a?.city ?? "").trim(),
    state: String(a?.state ?? "").trim().toUpperCase(),
  }),
};

function checkCustomer(customer) {
  const c = clean.customer(customer);
  const fields = validateCustomer({ ...c });
  if (Object.keys(fields).length) throw new HttpError(422, "Confira os campos destacados.", fields);
  return c;
}
function checkAddress(address) {
  const a = clean.address(address);
  const fields = validateAddress(a);
  if (Object.keys(fields).length) throw new HttpError(422, "Confira os campos destacados.", fields);
  return a;
}
function totalsFor(items, shippingId) {
  try {
    return calcTotals(config, items, shippingId);
  } catch (e) {
    throw new HttpError(400, e.message);
  }
}

/** Resumo do pedido para a descrição do Pix (limite do campo no banco: ~140 caracteres; o mais importante vem primeiro). */
function describe(id, t, c, a) {
  const items = t.lines.map((l) => `${l.qty}x${l.size}`).join("+");
  const compl = a.complement ? ` ${a.complement}` : "";
  const txt = `${orderNumber(id)} ${items}|${c.name}|${c.phone}|CEP ${a.cep} n${a.number}${compl}|${a.street},${a.district},${a.city}/${a.state}`;
  return txt.slice(0, 140);
}

export function createOrders({ pix, log = console }) {
  const checkId = (id) => {
    if (!UUID_RE.test(id)) throw new HttpError(404, "Pedido não encontrado.");
    return id.toLowerCase();
  };
  const isLive = (tx) => tx.status === "pending" && tx.expiresAt && tx.expiresAt.getTime() > Date.now();

  /** Acha a tentativa mais recente do pedido na Profanus (1 chamada no caso comum). */
  async function latest(id) {
    let last = null;
    for (let k = 1; k <= MAX_ATTEMPTS; k++) {
      const tx = await pix.getPayment(`${id}_${k}`);
      if (!tx) return { last, next: k };
      last = { ...tx, attempt: k };
      if (tx.status === "paid" || isLive(tx)) return { last, next: k + 1 };
    }
    return { last, next: MAX_ATTEMPTS + 1 };
  }

  const viewPix = (tx) => ({ code: tx.code, qrBase64: tx.qrBase64, expiresAt: tx.expiresAt.toISOString(), amountCents: tx.amountCents });
  const statusOf = (tx) => (!tx ? "checkout" : tx.status === "paid" ? "paid" : isLive(tx) ? "awaiting_payment" : "expired");

  /* ---------- Etapa 1: valida cliente + itens e devolve o id do pedido ---------- */
  async function saveDraft({ id, items, customer }) {
    checkCustomer(customer);
    totalsFor(items, null);
    const orderId = typeof id === "string" && UUID_RE.test(id) ? id.toLowerCase() : randomUUID();
    return { orderId, number: orderNumber(orderId) };
  }

  /* ---------- Etapa 2: valida endereço + frete ---------- */
  async function saveAddress(id, { address, shippingId }) {
    checkId(id);
    checkAddress(address);
    const ship = config.shipping.options.find((o) => o.id === shippingId && o.enabled);
    if (!ship) throw new HttpError(400, "Escolha uma forma de envio.");
    return { ok: true };
  }

  /* ---------- Etapa 3: gera o Pix (recebe o estado do checkout e revalida tudo) ---------- */
  async function createPix(id, { items, customer, address, shippingId } = {}) {
    id = checkId(id);
    const c = checkCustomer(customer);
    const a = checkAddress(address);
    const t = totalsFor(items, shippingId);
    if (!t.shipping) throw new HttpError(400, "Escolha uma forma de envio.");

    if (!pix.configured) {
      log.error("[pix] PROFANUS_API_KEY não configurada: não é possível gerar o Pix.");
      throw new HttpError(503, "O pagamento via Pix está temporariamente indisponível. Tente novamente em alguns minutos ou fale com o suporte.");
    }

    try {
      const { last, next } = await latest(id);
      if (last?.status === "paid") throw new HttpError(409, "Este pedido já foi pago.");
      // Reaproveita o Pix ainda válido (duplo clique / voltar e avançar não cobra duas vezes)
      if (last && isLive(last) && last.amountCents === t.chargeCents && last.expiresAt.getTime() > Date.now() + 60_000) return viewPix(last);
      if (next > MAX_ATTEMPTS) throw new HttpError(429, "Muitos códigos Pix gerados para este pedido. Fale com o suporte.");

      const created = await pix.createPix({
        amountCents: t.chargeCents,
        description: describe(id, t, c, a),
        externalId: `${id}_${next}`,
        expiresAt: new Date(Date.now() + config.pix.expiresMinutes * 60_000),
      });
      return viewPix(created);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (e.status === 401) log.error("[pix] PROFANUS_API_KEY inválida (401). Confira a variável de ambiente na Vercel.");
      log.error("[pix] falha ao criar cobrança:", e.message, e.details ? JSON.stringify(e.details) : "");
      throw new HttpError(502, "Não foi possível gerar o Pix agora. Tente novamente em instantes.");
    }
  }

  /* ---------- Status: sempre consultado na Profanus Pay ---------- */
  async function status(id) {
    id = checkId(id);
    if (!pix.configured) throw new HttpError(503, "Pagamento indisponível no momento.");
    let last;
    try {
      ({ last } = await latest(id));
    } catch (e) {
      log.error("[pix] erro ao consultar pagamento:", e.message);
      throw new HttpError(502, "Não foi possível consultar o pagamento agora.");
    }
    return { status: statusOf(last), expiresAt: last?.expiresAt?.toISOString() ?? null, amountCents: last?.amountCents ?? null, number: orderNumber(id) };
  }

  /** Dados para a tela do Pix. */
  async function getView(id) {
    id = checkId(id);
    const s = await status(id);
    let pixView = null;
    if (s.status !== "checkout") {
      const { last } = await latest(id);
      pixView = last ? viewPix(last) : null;
    }
    return { id, number: s.number, status: s.status, pix: pixView, chargeIsPartial: false };
  }

  return { saveDraft, saveAddress, createPix, status, getView };
}
