/** Lógica da landing page: galeria, seletor de tamanho + cor, quantidade, avaliações, FAQ. */
import { config } from "./config.js";
import "./lib/layout.js";
import { $, $$, esc, icon, placeholder } from "./lib/dom.js";
import { brl, toCents } from "./lib/shared.js";
import { setSingleItem } from "./lib/state.js";
import { track } from "./lib/tracking.js";

const { variants, sizeOptions, colorOptions } = config.product;
const money = (v) => brl(toCents(v));

/* ---------------- Slots de imagem (config.images) ---------------- */
$$("[data-slot]").forEach((el) => {
  const src = config.images[el.dataset.slot];
  el.outerHTML = src
    ? `<img src="${esc(src)}" alt="${esc(el.dataset.label.replace(/^FOTO:? ?/, "Foto: "))}" loading="lazy" decoding="async">`
    : placeholder(el.dataset.label);
});

/* ---------------- Prova social ---------------- */
if (config.approvedFamilies) {
  const p = $("#proof");
  p.hidden = false;
  p.innerHTML = `<span class="stars" aria-label="5 de 5 estrelas">${icon("star").repeat(5)}</span> <span><b>+${Number(config.approvedFamilies).toLocaleString("pt-BR")}</b> famílias já aprovaram</span>`;
}
if (config.stock.enabled && config.stock.units > 0) {
  const s = $("#stock");
  s.hidden = false;
  s.innerHTML = `${icon("alert")} Restam apenas ${Number(config.stock.units)} unidades no estoque de Natal!`;
}

/* ---------------- Galeria ---------------- */
const gallery = $("#gallery");
let current = 0;
function renderGallery() {
  const g = config.product.gallery;
  const main = g[current]
    ? `<img src="${esc(g[current])}" alt="${esc(config.product.name)} — foto ${current + 1}" width="800" height="800" ${current === 0 ? 'fetchpriority="high"' : ""}>`
    : placeholder(current === 0 ? "FOTO PRINCIPAL DO PRODUTO" : `FOTO ${current + 1} DO PRODUTO`);
  gallery.innerHTML = `<div class="gallery__main">${main}<span class="gallery__badge">${esc(config.product.discountBadge)}</span></div>
    <div class="gallery__thumbs">${g
      .map(
        (src, i) => `<button type="button" class="gallery__thumb" aria-label="Ver imagem ${i + 1}" aria-current="${i === current}" data-i="${i}">${
          src ? `<img src="${esc(src)}" alt="" loading="lazy" width="120" height="120">` : placeholder(`FOTO ${i + 1}`)
        }</button>`
      )
      .join("")}</div>`;
}
gallery.addEventListener("click", (e) => {
  const b = e.target.closest("[data-i]");
  if (!b) return;
  current = Number(b.dataset.i);
  renderGallery();
  gallery.querySelector(`[data-i="${current}"]`).focus();
});
renderGallery();

/* ---------------- Caixa de compra ---------------- */
const buybox = $("#buybox");
const first = variants.find((v) => v.price > 0) || variants[0];
let size = first.size;
let color = first.color;
let qty = 1;
const findVariant = () => variants.find((v) => v.size === size && v.color === color);

function renderBuybox() {
  const s = findVariant();
  const available = !!s && s.price > 0;
  const off = available && s.oldPrice ? Math.round((1 - s.price / s.oldPrice) * 100) : 0;
  const inst = config.product.installments;
  const sizeLabel = sizeOptions.find((o) => o.id === size)?.label;
  const colorLabel = colorOptions.find((o) => o.id === color)?.label;

  const priceHtml = available
    ? `${s.oldPrice ? `<p class="buybox__old">${money(s.oldPrice)}</p>` : ""}
       <div class="buybox__price-row"><p class="buybox__price">${money(s.price)}</p>${off > 0 ? `<span class="buybox__off">-${off}%</span>` : ""}</div>
       <p class="buybox__inst">em até <b>${inst}x de ${brl(Math.round(toCents(s.price) / inst))}</b> sem juros</p>`
    : `<p class="buybox__price" style="font-size:1.3rem;color:var(--muted)">Combinação indisponível</p>
       <p class="buybox__warn">Escolha outra combinação de tamanho e cor.</p>`;

  buybox.innerHTML = `${priceHtml}
    <p class="buybox__label">Tamanho: <span class="buybox__pick">${esc(sizeLabel)}</span></p>
    <div class="sizes" role="radiogroup" aria-label="Escolha o tamanho">
      ${sizeOptions.map((x) => `<button type="button" class="size" role="radio" aria-checked="${x.id === size}" data-size="${esc(x.id)}">${x.bestSeller ? '<span class="size__flag">MAIS VENDIDO</span>' : ""}${esc(x.label)}</button>`).join("")}
    </div>
    <p class="buybox__label">Cor da luz: <span class="buybox__pick">${esc(colorLabel)}</span></p>
    <div class="colors" role="radiogroup" aria-label="Escolha a cor da luz">
      ${colorOptions.map((x) => `<button type="button" class="color" role="radio" aria-checked="${x.id === color}" data-color="${esc(x.id)}"><span class="color__dot" style="background:${esc(x.swatch)}" aria-hidden="true"></span>${esc(x.label)}</button>`).join("")}
    </div>
    <div class="qty-row"><span id="qty-l">Quantidade</span>
      <div class="qty" role="group" aria-labelledby="qty-l">
        <button type="button" data-q="-1" aria-label="Diminuir quantidade" ${qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
        <output aria-live="polite">${qty}</output>
        <button type="button" data-q="1" aria-label="Aumentar quantidade" ${qty >= config.maxQty ? "disabled" : ""}>${icon("plus")}</button>
      </div>
    </div>
    <ul class="checks">
      <li>${icon("check")} Alimentação USB 5V + controle remoto incluso</li>
      <li>${icon("check")} 8 modos de iluminação e fio flexível</li>
      <li>${icon("check")} Liga em carregador USB ou power bank compatível</li>
    </ul>
    <p class="buybox__note">${icon("alert")} Fonte USB (carregador) e power bank não estão inclusos.</p>
    <button type="button" class="btn btn--buy btn--block" id="buy" ${available ? "" : "disabled"}>${icon("lock")} COMPRAR COM DESCONTO</button>
    <div class="minis"><span>${icon("truck")}Frete Grátis</span><span>${icon("lock")}Compra 100% Segura</span><span>${icon("shield-check")}Garantia legal</span></div>`;
}

buybox.addEventListener("click", (e) => {
  const sz = e.target.closest("[data-size]");
  const co = e.target.closest("[data-color]");
  const q = e.target.closest("[data-q]");
  if (sz) {
    size = sz.dataset.size;
    renderBuybox();
    $(`[data-size="${size}"]`, buybox).focus();
  } else if (co) {
    color = co.dataset.color;
    const ph = colorOptions.find((o) => o.id === color)?.photo;
    if (Number.isInteger(ph) && config.product.gallery[ph]) { current = ph; renderGallery(); }
    renderBuybox();
    $(`[data-color="${color}"]`, buybox).focus();
  } else if (q) {
    qty = Math.min(config.maxQty, Math.max(1, qty + Number(q.dataset.q)));
    renderBuybox();
    $(`[data-q="${q.dataset.q}"]:not(:disabled)`, buybox)?.focus();
  } else if (e.target.closest("#buy")) {
    const v = findVariant();
    if (!v || !(v.price > 0)) return;
    setSingleItem(v.id, qty);
    track("AddToCart", { value: v.price * qty, content_name: `${config.product.name} ${v.label}` });
    location.href = config.skipCart ? "/checkout/dados" : "/carrinho";
  }
});
renderBuybox();
{
  const s0 = variants.find((s) => s.price > 0);
  if (s0) track("ViewContent", { value: s0.price, content_name: config.product.name });
}

/* CTA final: leva ao carrinho/checkout com o 1º tamanho disponível */
$("#final-cta").addEventListener("click", (e) => {
  const s = findVariant()?.price > 0 ? findVariant() : variants.find((x) => x.price > 0);
  if (!s) return e.preventDefault();
  setSingleItem(s.id, 1);
  if (config.skipCart) {
    e.preventDefault();
    location.href = "/checkout/dados";
  }
});

/* ---------------- Números (só os preenchidos em config.stats) ---------------- */
{
  const labels = { sales: "vendas", satisfaction: "de satisfação", rating: "nota média", reviews: "avaliações" };
  const items = Object.entries(labels).filter(([k]) => config.stats[k]);
  if (items.length) {
    $("#stats").hidden = false;
    $("#stats-grid").innerHTML = items.map(([k, l]) => `<div><p class="stats__n">${esc(config.stats[k])}</p><p>${l}</p></div>`).join("");
  }
}

/* ---------------- Avaliações REAIS (public/data/reviews.json) ---------------- */
const stars = (n = 5) => `<span class="stars" aria-label="${n} de 5 estrelas">${Array.from({ length: 5 }, (_, i) => icon("star", i < n ? "" : "off")).join("")}</span>`;

async function loadReviews() {
  try {
    const res = await fetch("/data/reviews.json", { cache: "no-cache" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function renderVideoCarousel(list) {
  const box = $("#video-carousel");
  const vids = list.filter((r) => r.video);
  if (!vids.length) return ($("#sec-videos").hidden = true); // sem vídeos reais: a seção some
  let i = 0;
  const draw = () => {
    const r = vids[i];
    box.innerHTML = `<div class="vc">
      <div class="card vc__card">
        <video class="vc__video" src="${esc(r.video)}" ${r.poster ? `poster="${esc(r.poster)}"` : ""} controls playsinline preload="none" aria-label="Vídeo de ${esc(r.name)}"></video>
        <div class="vc__body">${stars(r.rating)}<p>${esc(r.text)}</p><p class="vc__name">${esc(r.name)} · <span style="font-weight:400">${esc(r.city)}</span></p><span class="badge-verified">${icon("badge-check")} Compra verificada</span></div>
      </div>
      ${vids.length > 1 ? `<button type="button" class="vc__arrow vc__arrow--prev" aria-label="Anterior">${icon("chevron-left")}</button><button type="button" class="vc__arrow vc__arrow--next" aria-label="Próximo">${icon("chevron-right")}</button>` : ""}
    </div>`;
  };
  box.addEventListener("click", (e) => {
    if (e.target.closest(".vc__arrow--prev")) i = (i - 1 + vids.length) % vids.length;
    else if (e.target.closest(".vc__arrow--next")) i = (i + 1) % vids.length;
    else return;
    draw();
  });
  draw();
}

/* Fileira de avaliações: mínimo de 4 cartões (foto OU vídeo + texto + nome).
   Avaliações reais vêm de /data/reviews.json; os cartões que faltarem aparecem como espaço reservado. */
const MIN_REVIEWS = 4;
function reviewCard(r) {
  const media = r.video
    ? `<video class="rcard__media" src="${esc(r.video)}" ${r.poster ? `poster="${esc(r.poster)}"` : ""} controls playsinline preload="none" aria-label="Vídeo de ${esc(r.name)}"></video>`
    : r.photo
      ? `<img class="rcard__media" src="${esc(r.photo)}" alt="Foto enviada por ${esc(r.name)}" loading="lazy" decoding="async">`
      : "";
  return `<article class="card rcard">${media}
    <div class="rcard__body">${stars(r.rating)}${r.title ? `<h3>${esc(r.title)}</h3>` : ""}<p>${esc(r.text)}</p>
      <p class="rcard__name">${esc(r.name)}${r.city ? ` · <span style="font-weight:400">${esc(r.city)}</span>` : ""}</p>
      <span class="badge-verified">${icon("badge-check")} Compra verificada</span></div>
  </article>`;
}
const reviewPlaceholder = () => `<article class="card rcard rcard--ph">
    ${placeholder("FOTO OU VÍDEO DO CLIENTE", "rcard__media")}
    <div class="rcard__body">${stars(5)}<p>[Depoimento real do cliente aqui]</p>
      <p class="rcard__name">[Nome do cliente] · <span style="font-weight:400">[Cidade]</span></p></div>
  </article>`;

function renderReviewGrid(list) {
  const box = $("#review-grid");
  const cards = list.slice(0, 8).map(reviewCard);
  while (cards.length < MIN_REVIEWS) cards.push(reviewPlaceholder());
  box.innerHTML = `<div class="rgrid">${cards.join("")}</div>`;
}

loadReviews().then((list) => {
  renderVideoCarousel(list);
  renderReviewGrid(list);
});

/* ---------------- FAQ ---------------- */
const faq = [
  ["Como a cortina é alimentada?", "Por conexão USB 5V. Você pode ligar em um carregador USB ou em um power bank compatível. Atenção: a fonte USB e o power bank não estão inclusos."],
  ["O que vem na embalagem?", "1 cortina de luz LED no tamanho e na cor que você escolheu e 1 controle remoto."],
  ["Quais tamanhos e cores existem?", "Dois tamanhos (3 m x 3 m e 4 m x 3 m) e três cores de luz: branco frio, branco quente e colorida. Escolha a combinação antes de finalizar a compra."],
  ["Quantos modos de iluminação tem?", "São 8 modos, que você troca pelo controle remoto."],
  ["Onde posso usar?", "No quarto, sala, janela, festas, casamentos e na decoração de Natal. Evite instalar perto de fontes de calor ou em locais sujeitos a imersão em água."],
  ["Como funciona a entrega e qual o prazo?", `Frete grátis para todo o Brasil com código de rastreio. Pedidos até ${config.christmasDeadline} chegam antes do Natal.`],
  ["Posso parcelar?", `Sim, em até ${config.product.installments}x sem juros no cartão.`],
  ["E se eu não gostar?", "Você tem 7 dias após o recebimento para devolver, conforme o Código de Defesa do Consumidor."],
];
$("#faq-list").innerHTML = faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");

/* ---------------- Fade-in no scroll ---------------- */
{
  const els = $$(".reveal");
  if ("IntersectionObserver" in window) {
    document.documentElement.classList.add("reveal-on");
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add("is-visible"));
}
