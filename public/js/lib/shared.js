/**
 * Funções usadas tanto no navegador quanto no servidor (Node).
 * Sem acesso a DOM aqui. Valores monetários internos em CENTAVOS (inteiros).
 */

export const toCents = (v) => Math.round(Number(v) * 100);

export const brl = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ------------------------- Preços / totais ------------------------- */

export function activeShippingOptions(config) {
  return config.shipping.options.filter((o) => o.enabled);
}

/**
 * Calcula o pedido. Lança Error com mensagem amigável se algo for inválido.
 * items: [{ size: "180", qty: 1 }]
 */
export function calcTotals(config, items, shippingId) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Carrinho vazio.");
  const lines = items.map((it) => {
    const size = config.product.variants.find((s) => s.id === it.size);
    const qty = Number(it.qty);
    if (!size) throw new Error("Produto inválido.");
    if (!(size.price > 0)) throw new Error(`A opção ${size.label} ainda não está disponível.`);
    if (!Number.isInteger(qty) || qty < 1 || qty > config.maxQty) throw new Error("Quantidade inválida.");
    return {
      size: size.id,
      label: size.label,
      name: `${config.product.name} ${size.label}`,
      qty,
      unitCents: toCents(size.price),
      oldUnitCents: toCents(size.oldPrice || 0),
      totalCents: toCents(size.price) * qty,
    };
  });
  const subtotalCents = lines.reduce((a, l) => a + l.totalCents, 0);

  const options = activeShippingOptions(config);
  const ship = shippingId ? options.find((o) => o.id === shippingId) : null;
  if (shippingId && !ship) throw new Error("Opção de frete inválida.");
  const shippingCents = ship ? toCents(ship.price) : 0;
  const totalCents = subtotalCents + shippingCents;

  const fixed = config.pix.chargeMode === "fixed";
  const chargeCents = fixed ? Math.min(toCents(config.pix.fixedAmount), totalCents) : totalCents;

  return { lines, subtotalCents, shipping: ship || null, shippingCents, totalCents, chargeCents, chargeIsPartial: chargeCents < totalCents };
}

/* ------------------------- Datas ------------------------- */

export function addBusinessDays(date, n) {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) added++;
  }
  return d;
}

export const fmtDate = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** "entre 25/11 e 02/12" */
export function deliveryRange(ship, from = new Date()) {
  if (!ship) return "";
  return `entre ${fmtDate(addBusinessDays(from, ship.minDays))} e ${fmtDate(addBusinessDays(from, ship.maxDays))}`;
}

/* ------------------------- Máscaras ------------------------- */

export const digits = (s) => String(s ?? "").replace(/\D/g, "");

export function maskCPF(v) {
  const d = digits(v).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskPhone(v) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const maskCEP = (v) => {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/* ------------------------- Validações ------------------------- */

export function isValidCPF(value) {
  const c = digits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (const t of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(c[i]) * (t + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== Number(c[t])) return false;
  }
  return true;
}

export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()) && String(v).length <= 254;

export const isValidName = (v) => {
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length >= 5 && s.length <= 120 && s.split(" ").length >= 2 && /^[\p{L}'. -]+$/u.test(s);
};

export function isValidPhone(v) {
  const d = digits(v);
  return (d.length === 11 && d[2] === "9") || d.length === 10; // celular (9 dígitos) ou fixo
}

export const isValidCEP = (v) => digits(v).length === 8;

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/** Valida os campos de cliente; devolve { campo: "mensagem" } (vazio = ok). */
export function validateCustomer(c = {}) {
  const e = {};
  if (!isValidName(c.name)) e.name = "Informe seu nome completo.";
  if (!isValidEmail(c.email)) e.email = "Informe um e-mail válido.";
  if (!isValidCPF(c.cpf)) e.cpf = "CPF inválido.";
  if (!isValidPhone(c.phone)) e.phone = "Informe um WhatsApp válido com DDD.";
  return e;
}

export function validateAddress(a = {}) {
  const e = {};
  if (!isValidCEP(a.cep)) e.cep = "CEP inválido.";
  if (String(a.street ?? "").trim().length < 2) e.street = "Informe a rua.";
  if (String(a.number ?? "").trim().length < 1) e.number = "Informe o número (ou S/N).";
  if (String(a.district ?? "").trim().length < 2) e.district = "Informe o bairro.";
  if (String(a.city ?? "").trim().length < 2) e.city = "Informe a cidade.";
  if (!UFS.includes(String(a.state ?? "").toUpperCase())) e.state = "Selecione o estado.";
  return e;
}
