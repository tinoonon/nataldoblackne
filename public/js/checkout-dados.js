/** Etapa 1: dados pessoais (máscaras + validação) e criação do pedido (rascunho) no servidor. */
import { config } from "./config.js";
import "./lib/layout.js";
import { $, api } from "./lib/dom.js";
import { maskCPF, maskPhone, validateCustomer, calcTotals } from "./lib/shared.js";
import { getCart, getCheckout, patchCheckout } from "./lib/state.js";
import { renderSummary } from "./lib/summary.js";
import { bindMask, clearOnInput, formData, setLoading, showErrors, showFormAlert } from "./lib/forms.js";
import { track } from "./lib/tracking.js";

if (!getCart().length) location.replace("/carrinho");

const form = $("#form");
const saved = getCheckout();
for (const [k, v] of Object.entries(saved.customer || {})) if (form.elements[k]) form.elements[k].value = v;

bindMask(form.elements.cpf, maskCPF);
bindMask(form.elements.phone, maskPhone);
clearOnInput(form);
renderSummary($("#summary"), { shippingId: null });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormAlert(form, "");
  const customer = formData(form);
  customer.name = customer.name.trim().replace(/\s+/g, " ");
  customer.email = customer.email.trim().toLowerCase();
  if (showErrors(form, validateCustomer(customer))) return;

  const btn = $("button[type=submit]", form);
  setLoading(btn, true, "Salvando...");
  try {
    const { orderId } = await api("/orders", { method: "POST", body: { id: saved.orderId, items: getCart(), customer } });
    patchCheckout({ orderId, customer });
    try { track("InitiateCheckout", { value: calcTotals(config, getCart()).subtotalCents / 100 }); } catch { /* noop */ }
    location.href = "/checkout/entrega";
  } catch (err) {
    if (err.fields) showErrors(form, err.fields);
    showFormAlert(form, err.message);
    setLoading(btn, false);
  }
});
