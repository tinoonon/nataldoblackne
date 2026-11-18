/**
 * Estado do cliente (carrinho + dados do checkout) em localStorage.
 * Tudo com try/catch: modo privado pode bloquear o storage.
 */
import { config } from "../config.js";

const KEYS = { cart: "nat.cart", checkout: "nat.checkout" };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage indisponível: o fluxo continua só em memória da página */
  }
}

/* ---------- Carrinho: [{ size: <id da variação>, qty }] ---------- */
export function getCart() {
  const cart = read(KEYS.cart, []);
  return Array.isArray(cart) ? cart.filter((i) => config.product.variants.some((s) => s.id === i.size && s.price > 0)) : [];
}
export const setCart = (cart) => write(KEYS.cart, cart);

export function addToCart(size, qty) {
  const cart = getCart();
  const found = cart.find((i) => i.size === size);
  if (found) found.qty = Math.min(config.maxQty, found.qty + qty);
  else cart.push({ size, qty: Math.min(config.maxQty, qty) });
  setCart(cart);
}

/** Define o carrinho com UM item (botão "Comprar" da página: variação + quantidade escolhidas). */
export const setSingleItem = (size, qty) => setCart([{ size, qty }]);

export function cartCount() {
  return getCart().reduce((a, i) => a + i.qty, 0);
}

/* ---------- Checkout: { orderId, customer, address, shippingId } ---------- */
export const getCheckout = () => read(KEYS.checkout, { orderId: null, customer: {}, address: {}, shippingId: null });
export const setCheckout = (data) => write(KEYS.checkout, data);
export function patchCheckout(patch) {
  const next = { ...getCheckout(), ...patch };
  setCheckout(next);
  return next;
}
export function clearAll() {
  try {
    localStorage.removeItem(KEYS.cart);
    localStorage.removeItem(KEYS.checkout);
  } catch {
    /* noop */
  }
}
