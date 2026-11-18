/**
 * Resumo do pedido (fixo ao lado no desktop, recolhível no topo no mobile).
 */
import { config } from "../config.js";
import { brl, calcTotals, deliveryRange } from "./shared.js";
import { esc } from "./dom.js";
import { getCart, getCheckout } from "./state.js";

export function renderSummary(el, { items = getCart(), shippingId = getCheckout().shippingId } = {}) {
  let t;
  try {
    t = calcTotals(config, items, shippingId);
  } catch {
    el.innerHTML = "";
    return null;
  }
  const lines = t.lines
    .map(
      (l) => `<li class="sum__line">
        <div class="sum__thumb">${config.product.gallery[0] ? `<img src="${esc(config.product.gallery[0])}" alt="" width="56" height="56">` : "🎄"}<span class="sum__qty">${l.qty}</span></div>
        <div class="sum__info"><p class="sum__name">${esc(config.product.name)}</p><p class="sum__muted">${esc(l.label)} de altura</p></div>
        <p class="sum__price">${brl(l.totalCents)}</p>
      </li>`
    )
    .join("");

  const shipRow = t.shipping
    ? `<div class="sum__row"><span>Frete (${esc(t.shipping.label)})</span><span>${t.shippingCents ? brl(t.shippingCents) : '<b class="free">GRÁTIS</b>'}</span></div>`
    : `<div class="sum__row"><span>Frete</span><span class="sum__muted">Calculado na próxima etapa</span></div>`;

  const partial =
    t.shipping && t.chargeIsPartial
      ? `<div class="sum__row sum__row--pay"><span>${esc(config.pix.chargeLabel)} (Pix)</span><b>${brl(t.chargeCents)}</b></div>`
      : "";
  const eta = t.shipping ? `<p class="sum__eta">Previsão de entrega: ${deliveryRange(t.shipping)}</p>` : "";

  el.innerHTML = `<details class="sum" id="sum-details">
    <summary class="sum__head"><span>Resumo do pedido</span><span class="sum__head-total">${brl(t.totalCents)}</span></summary>
    <div class="sum__body">
      <ul class="sum__list">${lines}</ul>
      <div class="sum__row"><span>Subtotal</span><span>${brl(t.subtotalCents)}</span></div>
      ${shipRow}
      <div class="sum__row sum__row--total"><span>Total do pedido</span><b>${brl(t.totalCents)}</b></div>
      ${partial}${eta}
    </div>
  </details>`;
  // Desktop: sempre aberto
  if (window.matchMedia("(min-width: 900px)").matches) el.querySelector("details").open = true;
  return t;
}
