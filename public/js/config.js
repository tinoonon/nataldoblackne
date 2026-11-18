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
  slogan: "Transforme qualquer parede em um cenário de luz.",
  legalName: "[RAZÃO SOCIAL]",
  cnpj: "[CNPJ]",
  supportEmail: "[EMAIL DE SUPORTE]",
  supportWhatsapp: "", // só números com DDI+DDD, ex.: "5511999999999" (vazio = esconde o botão)
  orderPrefix: "NAT", // prefixo do número do pedido (NAT-XXXXXX)

  topBar: "BLACK FRIDAY: FRETE GRÁTIS PARA TODO O BRASIL",

  // ---------- Imagens (caminhos dentro de /public). null = mostra placeholder ----------
  images: {
    logo: null, // ex.: "/img/logo.png"
    logoLight: null, // logo para fundo escuro (rodapé); se null usa o texto da marca
    why1: "/img/cortina-4.jpg", // card "Branco frio"
    why2: "/img/cortina-3.jpg", // card "Branco quente"
    why3: "/img/cortina-2.jpg", // card "Multicolorido"
  },

  // ---------- Produto ----------
  product: {
    // Título completo (aparece no H1 da página).
    title: "Cortina de Luz LED 300 LEDs 3x3m ou 4x3m USB com Controle Remoto, 8 Modos, Branco Frio, Quente ou Colorida",
    // Nome curto (carrinho, checkout, e-mails, Pix).
    name: "Cortina de Luz LED USB com Controle Remoto",
    installments: 12,
    discountBadge: "Oferta Black Friday",
    // Galeria: 5 posições. null = placeholder "[FOTO n]". A 1ª aparece como principal.
    gallery: ["/img/cortina-1.jpg", "/img/cortina-2.jpg", "/img/cortina-3.jpg", "/img/cortina-4.jpg", "/img/cortina-5.jpg"],

    // Opções que o cliente escolhe na página (tamanho x cor). `photo` = índice da galeria que abre ao escolher a cor.
    sizeOptions: [
      { id: "3x3", label: "3 m x 3 m" },
      { id: "4x3", label: "4 m x 3 m", bestSeller: true },
    ],
    colorOptions: [
      { id: "frio", label: "Branco frio", swatch: "#e8f1ff", photo: 3 },
      { id: "quente", label: "Branco quente", swatch: "#ffc76b", photo: 2 },
      { id: "color", label: "Colorida", swatch: "linear-gradient(135deg,#ff4d6d,#ffd166,#06d6a0,#4dabf7,#b197fc)", photo: 1 },
    ],

    // Variações vendáveis (tamanho x cor). O `id` é o que vai para carrinho/pedido.
    // >>> CONFIRA OS PREÇOS ABAIXO <<< — são valores de exemplo; troque pelos seus.
    // Se price for 0, o botão de compra daquela variação fica bloqueado.
    variants: [
      { id: "33f", size: "3x3", color: "frio", label: "3 m x 3 m · Branco frio", price: 29.9, oldPrice: 59.9 },
      { id: "33q", size: "3x3", color: "quente", label: "3 m x 3 m · Branco quente", price: 29.9, oldPrice: 59.9 },
      { id: "33c", size: "3x3", color: "color", label: "3 m x 3 m · Colorida", price: 29.9, oldPrice: 59.9 },
      { id: "43f", size: "4x3", color: "frio", label: "4 m x 3 m · Branco frio", price: 39.9, oldPrice: 79.9 },
      { id: "43q", size: "4x3", color: "quente", label: "4 m x 3 m · Branco quente", price: 39.9, oldPrice: 79.9 },
      { id: "43c", size: "4x3", color: "color", label: "4 m x 3 m · Colorida", price: 39.9, oldPrice: 79.9 },
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

  //30/11 para entrega antes do Natal (baseada no prazo REAL da transportadora). Ex.: "05/12"
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
    // "total": cobra o valor total do pedido no Pix (produto + frete).
    chargeMode: "total",
    fixedAmount: 0, // só usado se chargeMode = "fixed"
    explanation: "", // só aparece se chargeMode = "fixed"
    chargeLabel: "Total a pagar",
  },

  // ---------- Rastreamento (carrega só após aceitar cookies) ----------
  tracking: {
    metaPixelId: "", // ex.: "1234567890"
    gaId: "", // ex.: "G-XXXXXXXXXX"
  },
};
