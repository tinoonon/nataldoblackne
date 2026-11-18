/**
 * ============================================================
 *  ARQUIVO ÚNICO DE CONFIGURAÇÃO DA LOJA
 *  Edite aqui: textos, preços, estoque, prazos, frete, Pix e IDs de rastreamento.
 *  Este arquivo é lido pelo site (navegador) E pelo servidor (que recalcula
 *  preços e frete — o front nunca decide quanto o cliente paga).
 *
 *  Não coloque chaves secretas aqui! Elas ficam no arquivo .env
 *  Campos entre [COLCHETES] são placeholders a substituir.
 * ============================================================
 */
export const config = {
  // ---------- Marca / empresa ----------
  brand: "[NOME DA MARCA]",
  slogan: "A magia do Natal, acesa em cada galho.",
  legalName: "[RAZÃO SOCIAL]",
  cnpj: "[CNPJ]",
  supportEmail: "[EMAIL DE SUPORTE]",
  supportWhatsapp: "", // só números com DDI+DDD, ex.: "5511999999999" (vazio = esconde o botão)
  orderPrefix: "NAT", // prefixo do número do pedido (NAT-1001)

  topBar: "BLACK FRIDAY: FRETE GRÁTIS PARA TODO BRASIL",

  // ---------- Imagens (caminhos dentro de /public). null = mostra placeholder ----------
  images: {
    logo: null, // ex.: "/img/logo.png"
    logoLight: null, // logo para fundo escuro (rodapé); se null usa o texto da marca
    why1: null, // card "LEDs dourados embutidos"
    why2: null, // card "Folhagem cheia e realista"
    why3: null, // card "Montagem em 5 minutos"
    before: null, // foto ANTES
    after: null, // foto DEPOIS
  },

  // ---------- Produto ----------
  product: {
    name: "Árvore de Natal Pré-iluminada +900 LEDs",
    installments: 12,
    discountBadge: "Black Friday 60% OFF",
    // Galeria: 5 posições. null = placeholder "[FOTO n]". A 1ª aparece como principal.
    gallery: ["/img/arvore-hero.jpg", null, null, null, null],
    sizes: [
      { id: "180", label: "1,80 m", price: 129.9, oldPrice: 324.78, bestSeller: false },
      // [PREÇO] do 2,10 m: preencha price e oldPrice. Enquanto for 0, o botão de compra fica bloqueado.
      { id: "210", label: "2,10 m", price: 0, oldPrice: 0, bestSeller: true },
    ],
  },
  maxQty: 10,

  // true = o botão "Comprar" da página leva direto ao checkout (pula o carrinho)
  skipCart: false,

  // ---------- Prova social (só números REAIS; null = esconde) ----------
  approvedFamilies: null, // ex.: 1280
  stats: { sales: null, satisfaction: null, rating: null, reviews: null }, // ex.: "+2.300", "98%", "4,9", "540"

  // Aviso de estoque: só ative se estiver ligado a um estoque real.
  stock: { enabled: false, units: 0 },

  // Data-limite para entrega antes do Natal (baseada no prazo REAL da transportadora). Ex.: "05/12"
  christmasDeadline: "[DATA-LIMITE]",

  // ---------- Frete ----------
  // minDays/maxDays = dias úteis. >>> AJUSTE com o prazo real da sua transportadora <<<
  shipping: {
    options: [
      { id: "padrao", label: "Frete Grátis", description: "Entrega para todo o Brasil", price: 0, minDays: 7, maxDays: 12, enabled: true },
      // Exemplo de opção paga (ative com enabled: true):
      { id: "expresso", label: "Frete Expresso", description: "Entrega mais rápida", price: 29.9, minDays: 3, maxDays: 6, enabled: false },
    ],
  },

  // ---------- Pix ----------
  pix: {
    expiresMinutes: 30,
    // "total": cobra o valor total do pedido no Pix.
    // "fixed": cobra apenas fixedAmount agora (ex.: taxa de frete/sinal) — explique abaixo.
    chargeMode: "fixed",
    fixedAmount: 19.9,
    // Texto mostrado ao cliente na tela de pagamento (obrigatório quando chargeMode = "fixed").
    // >>> SUBSTITUA descrevendo claramente o que é esse valor e o que acontece com o restante <<<
    explanation: "[TEXTO EXPLICATIVO: descreva o que este valor representa (ex.: taxa de frete ou sinal) e o que acontece com o restante]",
    chargeLabel: "Valor a pagar agora",
  },

  // ---------- Rastreamento (carrega só após aceitar cookies) ----------
  tracking: {
    metaPixelId: "", // ex.: "1234567890"
    gaId: "", // ex.: "G-XXXXXXXXXX"
  },
};
