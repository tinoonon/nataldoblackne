/**
 * Meta Pixel + Google Analytics, carregados SOMENTE após consentimento (LGPD).
 * Sem scripts inline (compatível com a CSP do servidor).
 */
import { config } from "../config.js";

const CONSENT_KEY = "nat.cookies";
let loaded = false;

export const getConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
};
export const setConsent = (v) => {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* noop */
  }
};

export function loadTracking() {
  if (loaded) return;
  loaded = true;
  const { metaPixelId, gaId } = config.tracking;

  if (metaPixelId) {
    const f = window;
    if (!f.fbq) {
      const n = (f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(s);
    }
    window.fbq("init", metaPixelId);
    window.fbq("track", "PageView");
  }

  if (gaId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(s);
    window.gtag("js", new Date());
    window.gtag("config", gaId);
  }
}

/**
 * Dispara evento padrão (ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase...).
 * Se ainda não houver consentimento, simplesmente não faz nada.
 */
export function track(event, params = {}, eventId) {
  if (getConsent() !== "yes") return;
  if (window.fbq) window.fbq("track", event, { currency: "BRL", ...params }, eventId ? { eventID: eventId } : undefined);
  if (window.gtag) {
    const map = { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", AddPaymentInfo: "add_payment_info", Purchase: "purchase" };
    window.gtag("event", map[event] || event, { currency: "BRL", value: params.value, transaction_id: eventId });
  }
}

/** Evita disparar o mesmo evento duas vezes (ex.: recarregar a confirmação). */
export function trackOnce(key, event, params, eventId) {
  try {
    if (sessionStorage.getItem(`nat.ev.${key}`)) return;
    sessionStorage.setItem(`nat.ev.${key}`, "1");
  } catch {
    /* noop */
  }
  track(event, params, eventId);
}
