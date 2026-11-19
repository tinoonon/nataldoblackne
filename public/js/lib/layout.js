/**
 * Layout compartilhado (faixa do topo, header, footer, banner de cookies).
 * Cada página escolhe com <body data-layout="site|checkout"> e importa este módulo.
 */
import { config } from "../config.js";
import { $, bindConfigText, esc, icon, whatsappLink } from "./dom.js";
import { cartCount } from "./state.js";
import { getConsent, setConsent, loadTracking } from "./tracking.js";
import { captureUtms } from "./utm.js";
import { loadUtmify } from "./utmify-pixel.js";

const logoHtml = (light = false) => {
  const src = light ? config.images.logoLight || config.images.logo : config.images.logo;
  return src
    ? `<img src="${esc(src)}" alt="${esc(config.brand)}" height="44" class="logo-img">`
    : `<span class="logo-text">${esc(config.brand)}</span>`;
};

function topBar() {
  return `<div class="topbar" role="note">✨ ${esc(config.topBar)}</div>`;
}

function siteHeader() {
  const n = cartCount();
  return `<header class="header">
    <div class="header__in">
      <span class="header__spacer"></span>
      <a href="/" class="logo" aria-label="${esc(config.brand)} - página inicial">${logoHtml()}</a>
      <a href="/carrinho" class="cart-link" aria-label="Carrinho, ${n} ${n === 1 ? "item" : "itens"}">
        ${icon("cart")}${n ? `<span class="cart-link__n">${n}</span>` : ""}
      </a>
    </div>
  </header>`;
}

function checkoutHeader() {
  return `<header class="header header--co">
    <div class="header__in">
      <a href="/carrinho" class="back-link" aria-label="Voltar ao carrinho">${icon("chevron-left")}<span>Carrinho</span></a>
      <a href="/" class="logo" aria-label="${esc(config.brand)} - página inicial">${logoHtml()}</a>
      <span class="secure-tag">${icon("lock")}<span>Compra segura</span></span>
    </div>
  </header>`;
}

function siteFooter() {
  const wa = whatsappLink(config);
  return `<footer class="footer">
    <div class="footer__grid">
      <div>
        <a href="/" class="logo logo--footer" aria-label="${esc(config.brand)}">${logoHtml(true)}</a>
        <p class="footer__slogan">${esc(config.slogan)}</p>
      </div>
      <nav aria-label="Institucional">
        <p class="footer__h">Institucional</p>
        <ul>
          <li><a href="/#diferenciais">Sobre nós</a></li>
          <li><a href="/privacidade">Política de Privacidade</a></li>
          <li><a href="/termos">Termos de Uso</a></li>
          <li><a href="/contato">Contato</a></li>
        </ul>
      </nav>
      <nav aria-label="Ajuda">
        <p class="footer__h">Ajuda</p>
        <ul>
          <li><a href="/#faq">FAQ</a></li>
          <li><a href="/contato#rastreio">Rastreio</a></li>
          <li><a href="/trocas">Trocas e Devoluções</a></li>
          <li><a href="/#faq">Frete e Entrega</a></li>
          ${wa ? `<li><a href="${esc(wa)}" rel="noopener" target="_blank">WhatsApp</a></li>` : ""}
        </ul>
      </nav>
      <div>
        <p class="footer__h">Pagamento seguro</p>
        <p class="footer__line">${icon("lock")} Pix</p>
        <p class="footer__line">${icon("shield-check", "i--green")} Site seguro (SSL)</p>
      </div>
    </div>
    <p class="footer__legal">© <span data-cfg-year></span> ${esc(config.legalName)}</p>
  </footer>`;
}

function checkoutFooter() {
  return `<footer class="footer footer--co">
    <p>${icon("lock")} Ambiente seguro · Seus dados são protegidos (LGPD)</p>
    <p><a href="/privacidade">Privacidade</a> · <a href="/termos">Termos</a> · <a href="/trocas">Trocas</a> · <a href="/contato">Contato</a></p>
    <p class="footer__legal">© <span data-cfg-year></span> ${esc(config.legalName)}</p>
  </footer>`;
}

function cookieBanner() {
  if (getConsent()) return;
  const el = document.createElement("div");
  el.className = "cookies";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Aviso de cookies");
  el.innerHTML = `<p>Usamos cookies para melhorar sua experiência e medir resultados, conforme a LGPD. Veja nossa <a href="/privacidade">Política de Privacidade</a>.</p>
    <div class="cookies__btns">
      <button type="button" class="btn btn--buy btn--sm" data-c="yes">Aceitar</button>
      <button type="button" class="btn btn--ghost btn--sm" data-c="no">Recusar</button>
    </div>`;
  el.addEventListener("click", (e) => {
    const v = e.target.closest("[data-c]")?.dataset.c;
    if (!v) return;
    setConsent(v);
    if (v === "yes") loadTracking();
    el.remove();
  });
  document.body.appendChild(el);
}

/** Barra de progresso 1-2-3 do checkout. */
export function progressBar(step) {
  const steps = ["Dados", "Entrega", "Pagamento"];
  return `<ol class="progress" aria-label="Etapas do checkout">${steps
    .map((s, i) => {
      const n = i + 1;
      const cls = n < step ? "is-done" : n === step ? "is-current" : "";
      return `<li class="progress__step ${cls}" ${n === step ? 'aria-current="step"' : ""}><span class="progress__dot">${n < step ? icon("check") : n}</span><span class="progress__label">${s}</span></li>`;
    })
    .join("")}</ol>`;
}

const mode = document.body.dataset.layout || "site";
if (mode === "checkout") {
  document.body.insertAdjacentHTML("afterbegin", checkoutHeader());
  document.body.insertAdjacentHTML("beforeend", checkoutFooter());
} else {
  document.body.insertAdjacentHTML("afterbegin", topBar() + siteHeader());
  document.body.insertAdjacentHTML("beforeend", siteFooter());
}
const stepEl = $("[data-progress]");
if (stepEl) stepEl.innerHTML = progressBar(Number(stepEl.dataset.progress));

bindConfigText(config);
captureUtms();
loadUtmify();
if (getConsent() === "yes") loadTracking();
cookieBanner();
