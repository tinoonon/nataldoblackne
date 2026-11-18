/** Etapa 2: endereço (ViaCEP) + escolha do frete. */
import { config } from "./config.js";
import "./lib/layout.js";
import { $, api, esc } from "./lib/dom.js";
import { UFS, activeShippingOptions, brl, deliveryRange, digits, maskCEP, toCents, validateAddress } from "./lib/shared.js";
import { getCart, getCheckout, patchCheckout } from "./lib/state.js";
import { renderSummary } from "./lib/summary.js";
import { bindMask, clearOnInput, formData, setError, setLoading, showErrors, showFormAlert } from "./lib/forms.js";

const st = getCheckout();
if (!getCart().length) location.replace("/carrinho");
else if (!st.orderId) location.replace("/checkout/dados");

const form = $("#form");
const status = $("#cep-status");
const options = activeShippingOptions(config);
let shippingId = options.some((o) => o.id === st.shippingId) ? st.shippingId : options[0]?.id;

form.elements.state.insertAdjacentHTML("beforeend", UFS.map((u) => `<option value="${u}">${u}</option>`).join(""));
for (const [k, v] of Object.entries(st.address || {})) if (form.elements[k]) form.elements[k].value = v;

/* ----- Frete ----- */
function renderShipping() {
  $("#shipping").innerHTML = options
    .map(
      (o) => `<label class="opt"><input type="radio" name="shipping" value="${esc(o.id)}" ${o.id === shippingId ? "checked" : ""}>
        <span class="opt__main"><span class="opt__t">${esc(o.label)}</span><span class="opt__d">${esc(o.description || "")} · chega ${deliveryRange(o)} (dias úteis)</span></span>
        <span class="opt__p">${o.price > 0 ? brl(toCents(o.price)) : '<span class="free">GRÁTIS</span>'}</span></label>`
    )
    .join("");
}
$("#shipping").addEventListener("change", (e) => {
  shippingId = e.target.value;
  patchCheckout({ shippingId });
  renderSummary($("#summary"), { shippingId });
});
renderShipping();
renderSummary($("#summary"), { shippingId });

/* ----- CEP / ViaCEP ----- */
bindMask(form.elements.cep, maskCEP);
clearOnInput(form);
let lastCep = "";
form.elements.cep.addEventListener("input", async () => {
  const cep = digits(form.elements.cep.value);
  if (cep.length !== 8 || cep === lastCep) return;
  lastCep = cep;
  status.textContent = "Buscando endereço...";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
    clearTimeout(t);
    const d = await res.json();
    if (d.erro) {
      status.textContent = "CEP não encontrado. Preencha o endereço manualmente.";
      return;
    }
    const set = (name, v) => { if (v) { form.elements[name].value = v; setError(form.elements[name], ""); } };
    set("street", d.logradouro); set("district", d.bairro); set("city", d.localidade); set("state", d.uf);
    status.textContent = "Endereço encontrado ✓";
    (form.elements.street.value ? form.elements.number : form.elements.street).focus();
  } catch {
    status.textContent = "Não foi possível buscar o CEP agora. Preencha manualmente.";
  }
});

/* ----- Envio ----- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormAlert(form, "");
  const { shipping, ...address } = formData(form);
  if (showErrors(form, validateAddress(address))) return;

  const btn = $("button[type=submit]", form);
  setLoading(btn, true, "Salvando...");
  try {
    await api(`/orders/${st.orderId}`, { method: "PATCH", body: { address, shippingId } });
    patchCheckout({ address, shippingId });
    location.href = "/checkout/pagamento";
  } catch (err) {
    if (err.fields) showErrors(form, err.fields);
    showFormAlert(form, err.message);
    setLoading(btn, false);
  }
});
