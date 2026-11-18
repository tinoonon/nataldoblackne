/** Página de contato: canais + formulário (salvo no banco pelo servidor). */
import { config } from "./config.js";
import "./lib/layout.js";
import { $, api, whatsappLink } from "./lib/dom.js";
import { isValidEmail } from "./lib/shared.js";
import { formData, setLoading, showFormAlert } from "./lib/forms.js";

$("#mail-link").href = `mailto:${config.supportEmail}`;
const wa = whatsappLink(config);
if (wa) {
  $("#wa-link").href = wa;
  $("#wa-row").hidden = false;
}

const form = $("#contact-form");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = formData(form);
  if (!data.name.trim() || !isValidEmail(data.email) || data.message.trim().length < 5) {
    return showFormAlert(form, "Preencha nome, um e-mail válido e a mensagem.");
  }
  showFormAlert(form, "");
  const btn = $("button[type=submit]", form);
  setLoading(btn, true, "Enviando...");
  try {
    await api("/contact", { method: "POST", body: data });
    form.reset();
    $("#contact-ok").hidden = false;
  } catch (err) {
    showFormAlert(form, err.message);
  } finally {
    setLoading(btn, false);
  }
});
