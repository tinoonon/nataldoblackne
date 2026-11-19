/**
 * Página de confirmação do pedido: só mostra "sucesso" se o servidor confirmar o pagamento na Profanus Pay.
 * Os detalhes (itens, endereço) vêm do que o próprio navegador guardou no checkout.
 */
import { config } from "./config.js";
import "./lib/layout.js";
import { $, api, esc, icon, whatsappLink } from "./lib/dom.js";
import { brl, calcTotals, deliveryRange } from "./lib/shared.js";
import { clearAll, getCart, getCheckout } from "./lib/state.js";
import { trackOnce } from "./lib/tracking.js";
import { reportPaid } from "./lib/utmify-sale.js";

const st = getCheckout();
const orderId = new URLSearchParams(location.search).get("pedido") || st.orderId;
const root = $("#ok-root");

/** Monta os detalhes a partir do estado local (se o navegador ainda os tiver). */
function localDetails() {
  try {
    const t = calcTotals(config, getCart(), st.shippingId);
    if (!st.address?.street || !t.shipping) return null;
    return { t, a: st.address, firstName: String(st.customer?.name || "").split(" ")[0], email: st.customer?.email || "", delivery: deliveryRange(t.shipping, new Date()) };
  } catch { return null; }
}

async function main() {
  if (!orderId) return (location.replace("/"));
  let s;
  try { s = await api(`/orders/${orderId}/status`); }
  catch (err) { root.innerHTML = `<h1>Não foi possível confirmar</h1><p class="co__lead">${esc(err.message)}</p><a class="btn btn--buy" href="/">Voltar à loja</a>`; return; }

  if (s.status !== "paid") {
    root.innerHTML = `<h1>Pagamento ainda não confirmado</h1><p class="co__lead">Não recebemos a confirmação do Pix deste pedido (${esc(s.number)}).</p><a class="btn btn--buy" href="/checkout/pix?pedido=${encodeURIComponent(orderId)}">Ver meu Pix</a>`;
    return;
  }

  const d = localDetails();
  await reportPaid(orderId); // backup: precisa vir ANTES do clearAll (usa carrinho/dados locais)
  clearAll(); // pedido concluído: limpa carrinho/checkout locais
  // Valor do evento = valor efetivamente pago agora via Pix.
  trackOnce(`purchase.${orderId}`, "Purchase", { value: (s.amountCents ?? d?.t.chargeCents ?? 0) / 100 }, orderId);

  const wa = whatsappLink(config, `Olá! Meu pedido é ${s.number}.`);
  const help = `<section><h2>Precisa de ajuda?</h2>
        <p>E-mail: <a href="mailto:${esc(config.supportEmail)}">${esc(config.supportEmail)}</a>${wa ? ` · <a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</p>
      </section>`;
  const summary = d ? `
      <section><h2>${icon("package")} Resumo</h2>
        <ul>${d.t.lines.map((l) => `<li><span class="strong">${l.qty}× ${esc(l.name)}</span> — ${brl(l.totalCents)}</li>`).join("")}</ul>
        <p>Total do pedido: <span class="strong">${brl(d.t.totalCents)}</span> · Pago via Pix: <span class="strong">${brl(s.amountCents ?? d.t.chargeCents)}</span></p>
      </section>
      <section><h2>${icon("truck")} Entrega</h2>
        <p class="strong">${esc(d.a.street)}, ${esc(d.a.number)}${d.a.complement ? " - " + esc(d.a.complement) : ""}</p>
        <p>${esc(d.a.district)} · ${esc(d.a.city)}/${esc(d.a.state)} · CEP ${esc(d.a.cep)}</p>
        <p>Previsão de entrega: <span class="strong">${esc(d.delivery)}</span> (${esc(d.t.shipping.label)})</p>
      </section>` : `
      <section><h2>${icon("package")} Pagamento recebido</h2>
        <p>Pago via Pix: <span class="strong">${brl(s.amountCents ?? 0)}</span>. Guarde o número do pedido para falar com o suporte.</p>
      </section>`;

  root.innerHTML = `
    <div class="ok__ico">${icon("check")}</div>
    <h1>Pedido confirmado!</h1>
    <p class="co__lead" style="margin-top:.5rem">${d?.firstName ? `Obrigado, <b>${esc(d.firstName)}</b>! ` : "Obrigado! "}Recebemos seu pagamento.</p>
    <span class="ok__num">Pedido ${esc(s.number)}</span>

    <div class="ok__box">
      ${summary}
      <section><h2>${icon("badge-check")} Próximos passos</h2>
        <p>Vamos preparar o seu pedido e entrar em contato pelo WhatsApp/e-mail informados no pedido com o código de rastreio assim que for despachado.</p>
      </section>
      ${help}
    </div>
    <p style="margin-top:1.5rem"><a class="btn btn--ghost" href="/">Voltar à loja</a></p>`;
}
main();
