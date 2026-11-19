/**
 * Avisa o servidor que o Pix foi pago, para ele enviar a venda "paid" à Utmify.
 * O servidor reconfirma o pagamento na Profanus antes de enviar. Roda no máximo 1x por pedido por navegador.
 */
import { api } from "./dom.js";
import { getCart, getCheckout } from "./state.js";
import { getUtms } from "./utm.js";

export async function reportPaid(orderId) {
  const flag = `nat.utmify.paid.${orderId}`;
  try { if (sessionStorage.getItem(flag)) return; } catch { /* noop */ }
  const st = getCheckout();
  const items = getCart().length ? getCart() : st.cart || [];
  if (!items.length || !st.customer?.email) return; // sem dados locais não há como montar a venda
  try {
    const r = await Promise.race([
      api(`/orders/${orderId}/paid`, { method: "POST", body: { items, customer: st.customer, address: st.address, shippingId: st.shippingId, tracking: getUtms() } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
    ]);
    if (r?.sent || r?.reason === "already_sent") { try { sessionStorage.setItem(flag, "1"); } catch { /* noop */ } }
  } catch { /* não trava o cliente: a confirmação.js tenta de novo */ }
}
