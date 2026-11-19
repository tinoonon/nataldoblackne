/** Etapa 3: revisão + escolha do método (Pix) e geração da cobrança. */
import { config } from "./config.js";
import "./lib/layout.js";
import { $, api, esc } from "./lib/dom.js";
import { brl, calcTotals, deliveryRange } from "./lib/shared.js";
import { getCart, getCheckout } from "./lib/state.js";
import { renderSummary } from "./lib/summary.js";
import { setLoading } from "./lib/forms.js";
import { track } from "./lib/tracking.js";
import { getUtms } from "./lib/utm.js";

const st = getCheckout();
if (!getCart().length) location.replace("/carrinho");
else if (!st.orderId || !st.customer?.email) location.replace("/checkout/dados");
else if (!st.address?.cep || !st.shippingId) location.replace("/checkout/entrega");

function updateDisplay() {
  const t = renderSummary($("#summary"));
  const c = st.customer, a = st.address;

  $("#review").innerHTML = `
    <div class="review-box"><b>Contato</b>${esc(c.name)} · ${esc(c.email)} · ${esc(c.phone)} <a href="/checkout/dados">alterar</a></div>
    <div class="review-box"><b>Entrega</b>${esc(a.street)}, ${esc(a.number)}${a.complement ? " - " + esc(a.complement) : ""} · ${esc(a.district)} · ${esc(a.city)}/${esc(a.state)} · CEP ${esc(a.cep)} <a href="/checkout/entrega">alterar</a><br>${esc(t.shipping.label)} · chega ${deliveryRange(t.shipping)} (dias úteis)</div>`;

  $("#charge-box").innerHTML = t.chargeIsPartial
    ? `<b>${esc(config.pix.chargeLabel)}: ${brl(t.chargeCents)} via Pix</b>${esc(config.pix.explanation)}<br><span style="color:var(--muted)">Total do pedido: ${brl(t.totalCents)}</span>`
    : `<b>Total a pagar via Pix: ${brl(t.totalCents)}</b>Pague pelo app do seu banco com o QR Code ou o código copia e cola.`;
  
  return t;
}

let t = updateDisplay();

// Atualiza o display quando há mudanças no carrinho
const observer = setInterval(() => {
  const newT = updateDisplay();
  if (newT.totalCents !== t.totalCents) {
    t = newT;
  }
}, 500);

const alertEl = $("#alert");
$("#pay").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  alertEl.hidden = true;
  
  // Atualiza o carrinho antes de gerar o Pix
  t = updateDisplay();
  
  setLoading(btn, true, "Gerando Pix...");
  try {
    await api(`/orders/${st.orderId}/pix`, { method: "POST", body: { items: getCart(), customer: st.customer, address: st.address, shippingId: st.shippingId, tracking: getUtms() } });
    track("AddPaymentInfo", { value: t.chargeCents / 100 });
    clearInterval(observer);
    location.href = `/checkout/pix?pedido=${encodeURIComponent(st.orderId)}`;
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.hidden = false;
    alertEl.scrollIntoView({ block: "center", behavior: "smooth" });
    setLoading(btn, false);
  }
});

window.addEventListener("beforeunload", () => clearInterval(observer));
