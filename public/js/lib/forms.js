/** Ajudantes de formulário: máscaras e mensagens de erro acessíveis. */
import { $, esc } from "./dom.js";

/** Aplica máscara enquanto digita. */
export function bindMask(input, maskFn) {
  if (!input) return;
  input.addEventListener("input", () => {
    input.value = maskFn(input.value);
  });
}

export function setError(input, msg) {
  const wrap = input.closest(".field");
  if (!wrap) return;
  let err = $(".field__err", wrap);
  if (!err) {
    err = document.createElement("p");
    err.className = "field__err";
    err.id = `${input.id}-err`;
    wrap.appendChild(err);
  }
  err.textContent = msg || "";
  wrap.classList.toggle("has-error", !!msg);
  input.setAttribute("aria-invalid", msg ? "true" : "false");
  if (msg) input.setAttribute("aria-describedby", err.id);
  else input.removeAttribute("aria-describedby");
}

/** Mostra { campo: msg } e foca no primeiro erro. Retorna true se houver erros. */
export function showErrors(form, errors) {
  let first = null;
  form.querySelectorAll("[name]").forEach((inp) => {
    const msg = errors[inp.name];
    setError(inp, msg);
    if (msg && !first) first = inp;
  });
  if (first) first.focus();
  return !!first;
}

export function clearOnInput(form) {
  form.addEventListener("input", (e) => {
    if (e.target.name) setError(e.target, "");
  });
}

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.classList.toggle("is-loading", loading);
  if (text !== undefined) btn.dataset.label ??= btn.innerHTML;
  btn.innerHTML = loading ? `<span class="spinner" aria-hidden="true"></span> ${esc(text || "Aguarde...")}` : btn.dataset.label ?? btn.innerHTML;
}

export function showFormAlert(form, msg) {
  let box = $(".form-alert", form);
  if (!box) {
    box = document.createElement("div");
    box.className = "form-alert";
    box.setAttribute("role", "alert");
    form.prepend(box);
  }
  box.textContent = msg || "";
  box.hidden = !msg;
  if (msg) box.scrollIntoView({ block: "center", behavior: "smooth" });
}
