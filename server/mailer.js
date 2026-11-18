/** E-mail transacional via Resend (HTTP). Sem chave configurada, apenas registra no log. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function createMailer({ apiKey, from, apiBase = "https://api.resend.com" }) {
  const configured = Boolean(apiKey && from);

  async function send({ to, subject, html }) {
    if (!configured) {
      console.warn(`[email] RESEND_API_KEY/MAIL_FROM não configurados — e-mail "${subject}" NÃO enviado.`);
      return false;
    }
    const res = await fetch(`${apiBase}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
    return true;
  }

  return { configured, send, esc };
}

export function confirmationEmail({ config, order, view, brl }) {
  const rows = view.lines.map((l) => `<tr><td style="padding:6px 0">${l.qty}× ${esc(l.name)}</td><td align="right">${brl(l.totalCents)}</td></tr>`).join("");
  const a = view.address;
  return {
    subject: `Pedido ${view.number} confirmado — ${config.brand}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1b2140">
      <h1 style="color:#4f3bd9;font-size:22px">Pedido confirmado! ✨</h1>
      <p>Olá, <b>${esc(view.customerFirstName)}</b>! Recebemos o seu pagamento via Pix.</p>
      <p style="background:#f3f0ff;padding:10px 14px;border-radius:8px"><b>Pedido ${esc(view.number)}</b></p>
      <table width="100%" style="border-collapse:collapse;font-size:15px">${rows}
        <tr><td style="padding-top:8px;border-top:1px solid #eadfce"><b>Total do pedido</b></td><td align="right" style="border-top:1px solid #eadfce"><b>${brl(view.totalCents)}</b></td></tr>
        ${view.pix ? `<tr><td>Pago via Pix</td><td align="right">${brl(view.pix.amountCents)}</td></tr>` : ""}
      </table>
      <h3>Entrega</h3>
      <p>${esc(a.street)}, ${esc(a.number)}${a.complement ? " - " + esc(a.complement) : ""}<br>${esc(a.district)} · ${esc(a.city)}/${esc(a.state)} · CEP ${esc(a.cep)}<br>
      Previsão: <b>${esc(view.deliveryEstimate)}</b> (${esc(view.shippingLabel)})</p>
      <p>Assim que o pedido for despachado, enviaremos o código de rastreio por e-mail e WhatsApp.</p>
      <p style="font-size:13px;color:#6b5a52">Dúvidas? Responda este e-mail ou escreva para ${esc(config.supportEmail)}.<br>${esc(config.legalName)} · CNPJ ${esc(config.cnpj)}</p>
    </div>`,
  };
}
