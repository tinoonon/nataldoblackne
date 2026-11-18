/** Página do carrinho: editar quantidade, remover, adicionar outro tamanho. */
import { config } from "./config.js";
import "./lib/layout.js";
import { $, esc, icon } from "./lib/dom.js";
import { brl, calcTotals, toCents } from "./lib/shared.js";
import { getCart, setCart } from "./lib/state.js";
import { renderSummary } from "./lib/summary.js";

const itemsEl = $("#cart-items");
const addEl = $("#cart-add");
const asideActions = $(".co__actions");

function render() {
  const cart = getCart();

  if (!cart.length) {
    itemsEl.innerHTML = `<div class="cart-empty">${icon("cart", "")}<p>Seu carrinho está vazio.</p><a class="btn btn--buy" href="/">Ver o produto</a></div>`;
    addEl.innerHTML = "";
    $("#summary").innerHTML = "";
    asideActions.hidden = true;
    return;
  }
  asideActions.hidden = false;

  itemsEl.innerHTML = cart
    .map((it) => {
      const s = config.product.sizes.find((x) => x.id === it.size);
      const img = config.product.gallery[0];
      return `<div class="cart-item" data-size="${esc(it.size)}">
        ${img ? `<img class="cart-item__img" src="${esc(img)}" alt="" width="84" height="84">` : `<div class="cart-item__img" aria-hidden="true">🎄</div>`}
        <div>
          <p class="cart-item__name">${esc(config.product.name)}</p>
          <p class="cart-item__size">${esc(s.label)} de altura</p>
          <div class="cart-item__row">
            <div class="qty" role="group" aria-label="Quantidade">
              <button type="button" data-q="-1" aria-label="Diminuir quantidade" ${it.qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
              <output aria-live="polite">${it.qty}</output>
              <button type="button" data-q="1" aria-label="Aumentar quantidade" ${it.qty >= config.maxQty ? "disabled" : ""}>${icon("plus")}</button>
            </div>
            <p class="cart-item__price">${s.oldPrice ? `<span class="cart-item__old">${brl(toCents(s.oldPrice) * it.qty)}</span>` : ""}${brl(toCents(s.price) * it.qty)}</p>
          </div>
          <button type="button" class="link-btn" data-remove>${icon("trash")} Remover</button>
        </div>
      </div>`;
    })
    .join("");

  // Oferece o outro tamanho, se disponível e ainda fora do carrinho
  const others = config.product.sizes.filter((s) => s.price > 0 && !cart.some((i) => i.size === s.id));
  addEl.innerHTML = others
    .map((s) => `<div class="cart-add"><span>Adicionar também a versão <b>${esc(s.label)}</b> — ${brl(toCents(s.price))}</span><button type="button" class="btn btn--ghost btn--sm" data-add="${esc(s.id)}">Adicionar</button></div>`)
    .join("");

  renderSummary($("#summary"), { items: cart, shippingId: null });
}

document.addEventListener("click", (e) => {
  const row = e.target.closest("[data-size]");
  const cart = getCart();
  const q = e.target.closest("[data-q]");
  const add = e.target.closest("[data-add]");

  if (q && row) {
    const it = cart.find((i) => i.size === row.dataset.size);
    it.qty = Math.min(config.maxQty, Math.max(1, it.qty + Number(q.dataset.q)));
    setCart(cart);
  } else if (e.target.closest("[data-remove]") && row) {
    setCart(cart.filter((i) => i.size !== row.dataset.size));
  } else if (add) {
    setCart([...cart, { size: add.dataset.add, qty: 1 }]);
  } else return;
  render();
});

render();
