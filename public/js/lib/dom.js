/** Utilitários de DOM. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escapa texto para uso seguro em innerHTML. */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Ícone do sprite /img/icons.svg */
export const icon = (name, cls = "") =>
  `<svg class="i ${cls}" aria-hidden="true" focusable="false"><use href="/img/icons.svg#${name}"/></svg>`;

/** Placeholder bem identificado para imagens/vídeos que ainda serão enviados. */
export const placeholder = (label, cls = "") => `<div class="ph ${cls}" role="img" aria-label="Espaço reservado: ${esc(label)}">[${esc(label)}]</div>`;

/** Link do WhatsApp do suporte (ou null). */
export const whatsappLink = (cfg, text = "") =>
  cfg.supportWhatsapp ? `https://wa.me/${cfg.supportWhatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;

/** Preenche [data-cfg="brand"] etc. com valores da config. */
export function bindConfigText(config) {
  document.querySelectorAll("[data-cfg]").forEach((el) => {
    const v = el.dataset.cfg.split(".").reduce((o, k) => o?.[k], config);
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll("[data-cfg-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
}

/** Chamada JSON à API; lança Error com mensagem do servidor. */
export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Verifique sua internet e tente de novo.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Algo deu errado (erro ${res.status}). Tente novamente.`);
    err.status = res.status;
    err.fields = data?.fields;
    throw err;
  }
  return data;
}
