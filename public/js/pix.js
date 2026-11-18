/** Tela do Pix: QR Code, copia e cola, contador e verificação automática do pagamento. */
import "./lib/layout.js";
import { $, api, esc, icon } from "./lib/dom.js";
import { brl, calcTotals } from "./lib/shared.js";
import { getCart, getCheckout } from "./lib/state.js";
import { config } from "./config.js";
import { renderSummary } from "./lib/summary.js";

const orderId = new URLSearchParams(location.search).get("pedido") || getCheckout().orderId;
const root = $("#pix-root");
if (!orderId) location.replace("/carrinho");

/* Sem banco no servidor: o navegador reenvia carrinho + dados ao (re)gerar o Pix; o servidor revalida e recalcula o valor. */
const payload = () => { const st = getCheckout(); return { items: getCart(), customer: st.customer, address: st.address, shippingId: st.shippingId }; };
const isPartial = () => { try { return calcTotals(config, getCart(), getCheckout().shippingId).chargeIsPartial; } catch { return false; } };

let timer = null, poll = null;
const stop = () => { clearInterval(timer); clearInterval(poll); };
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

async function load() {
  stop();
  let order;
  try {
    order = await api(`/orders/${orderId}`);
  } catch (err) {
    root.innerHTML = `<h1 id="h">Pedido não encontrado</h1><p class="co__lead">${esc(err.message)}</p><a class="btn btn--buy" href="/carrinho">Voltar ao carrinho</a>`;
    return;
  }
  order.chargeIsPartial = isPartial();
  if (order.status === "paid") return (location.replace(`/confirmacao?pedido=${encodeURIComponent(orderId)}`));
  if (!order.pix) return renderExpired(order, "Ainda não há um Pix gerado para este pedido.");
  const exp = new Date(order.pix.expiresAt).getTime();
  if (Date.now() >= exp) return renderExpired(order);
  renderPix(order, exp);
}

function renderPix(order, exp) {
  root.innerHTML = `
    <span class="pix-badge">${icon("lock")} Pagamento seguro via Pix</span>
    <h1 id="h" style="margin-top:.75rem">Pague com Pix</h1>
    <p class="co__lead" style="margin-bottom:0">${esc(order.number)} · ${esc(config.pix.chargeLabel)}</p>
    <p class="pix__amount">${brl(order.pix.amountCents)}</p>
    ${order.chargeIsPartial ? `<p class="co__lead" style="font-size:.85rem">${esc(config.pix.explanation)}</p>` : ""}
    <p class="pix__timer" id="timer">${icon("clock")} Expira em <span id="left">${mmss(exp - Date.now())}</span></p>
    ${order.pix.qrBase64 ? `<div class="pix__qr"><img src="data:image/png;base64,${esc(order.pix.qrBase64)}" alt="QR Code do Pix" width="220" height="220"></div>` : ""}
    <label for="code" class="sr-only">Código Pix copia e cola</label>
    <textarea id="code" class="pix__code" rows="4" readonly>${esc(order.pix.code)}</textarea>
    <button type="button" class="btn btn--buy btn--block" id="copy" style="margin-top:.75rem">${icon("copy")} COPIAR CÓDIGO PIX</button>
    <p id="copy-ok" class="badge-verified" role="status" style="margin-top:.5rem" hidden>${icon("check")} Código copiado!</p>
    <ol class="pix__steps">
      <li>Abra o app do seu banco e escolha <b>Pix</b>.</li>
      <li>Leia o QR Code ou use <b>Pix Copia e Cola</b>.</li>
      <li>Confira o valor e confirme. A aprovação é automática.</li>
    </ol>
    <p class="pix__wait"><span class="spinner" aria-hidden="true"></span> Aguardando o pagamento... esta página atualiza sozinha.</p>`;

  // Renderiza o resumo do pedido se houver elemento para isso
  const summaryEl = $("#summary");
  if (summaryEl) renderSummary(summaryEl);

  $("#copy").addEventListener("click", async () => {
    const code = $("#code");
    try { await navigator.clipboard.writeText(code.value); }
    catch { code.select(); document.execCommand("copy"); }
    $("#copy-ok").hidden = false;
    setTimeout(() => ($("#copy-ok").hidden = true), 3000);
  });
  $("#code").addEventListener("focus", (e) => e.target.select());

  timer = setInterval(() => {
    const left = exp - Date.now();
    if (left <= 0) { stop(); return renderExpired(order); }
    $("#left").textContent = mmss(left);
    $("#timer").classList.toggle("is-low", left < 120000);
  }, 1000);

  poll = setInterval(async () => {
    try {
      const s = await api(`/orders/${orderId}/status`);
      if (s.status === "paid") { stop(); location.replace(`/confirmacao?pedido=${encodeURIComponent(orderId)}`); }
      else if (s.status === "expired") { stop(); renderExpired(order); }
    } catch { /* tenta de novo no próximo ciclo */ }
  }, 4000);
}

function renderExpired(order, msg = "O tempo para pagar este Pix acabou. Gere um novo código para continuar — seu pedido continua salvo.") {
  stop();
  root.innerHTML = `<div class="pix__expired">
    <h1 id="h">Pix expirado</h1>
    <p class="co__lead">${esc(msg)}</p>
    <div class="form-alert" id="err" role="alert" hidden></div>
    <button type="button" class="btn btn--buy btn--block" id="renew">${icon("refresh")} GERAR NOVO PIX</button>
    <p class="co__back" style="margin-top:1rem"><a href="/checkout/pagamento">← Voltar ao pagamento</a></p></div>`;
  $("#renew").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { await api(`/orders/${orderId}/pix`, { method: "POST", body: payload() }); await load(); }
    catch (err) { const box = $("#err"); box.textContent = err.message; box.hidden = false; e.currentTarget.disabled = false; }
  });
}

load();
window.addEventListener("pagehide", stop);
