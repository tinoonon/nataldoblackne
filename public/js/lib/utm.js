/**
 * Captura UTMs/src/sck da URL e guarda no localStorage para usar no fim do checkout
 * (a venda só é enviada à Utmify no servidor, então os parâmetros precisam viajar junto).
 * Se chegar um novo link com UTMs, ele substitui o anterior (último clique).
 */
const KEY = "nat.utm";
const FIELDS = ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"];

export function captureUtms() {
  try {
    const q = new URLSearchParams(location.search);
    const found = {};
    for (const f of FIELDS) { const v = q.get(f); if (v) found[f] = v.slice(0, 255); }
    if (Object.keys(found).length) localStorage.setItem(KEY, JSON.stringify(found));
  } catch { /* noop */ }
}

export function getUtms() {
  const out = {};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* noop */ }
  for (const f of FIELDS) out[f] = saved[f] || null;
  return out;
}
