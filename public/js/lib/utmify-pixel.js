/**
 * Pixel + script de UTMs da Utmify, carregados em TODAS as páginas.
 * (Antes eram scripts inline só na index.html e a CSP bloqueava tudo.)
 */
import { config } from "../config.js";

export function loadUtmify() {
  const id = config.tracking.utmifyPixelId;
  if (!id || window.__utmifyLoaded) return;
  window.__utmifyLoaded = true;
  window.pixelId = id;

  const pixel = document.createElement("script");
  pixel.async = true;
  pixel.defer = true;
  pixel.src = "https://cdn.utmify.com.br/scripts/pixel/pixel.js";
  document.head.appendChild(pixel);

  const utms = document.createElement("script");
  utms.async = true;
  utms.defer = true;
  utms.src = "https://cdn.utmify.com.br/scripts/utms/latest.js";
  utms.setAttribute("data-utmify-prevent-xcod-sck", "");
  utms.setAttribute("data-utmify-prevent-subids", "");
  document.head.appendChild(utms);
}
